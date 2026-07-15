import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { getSyteConfig, syteAgentChange } from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const MODEL_PROFILES = new Set(["syra-nano", "syra-base", "syra-havy"])

type ActivityEvent = {
  id?: number
  event_type?: string
  role?: string
  title?: string
  detail?: string
  payload?: Record<string, unknown>
  created_at?: string
}

function syteHeaders(apiKey: string, accept: string): HeadersInit {
  return {
    Accept: accept,
    "X-API-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  }
}

function getLatestMarkedSession(text: string): number {
  let latest = 0
  for (const match of text.matchAll(/\[session(\d+)\]/g)) {
    latest = Math.max(latest, Number(match[1]) || 0)
  }
  for (const match of text.matchAll(/"session"\s*:\s*(\d+)/g)) {
    latest = Math.max(latest, Number(match[1]) || 0)
  }
  return latest
}

async function loadLatestSession(uuid: string, afterSession: number): Promise<number> {
  const config = getSyteConfig()
  const url = new URL(
    `${config.baseUrl}/api/projects/${encodeURIComponent(uuid)}/agent/activity`,
  )
  url.searchParams.set("format", "marked")
  url.searchParams.set("session", "last")

  try {
    const response = await fetch(url, {
      headers: syteHeaders(config.apiKey, "text/event-stream, text/plain, application/json"),
      cache: "no-store",
    })
    if (!response.ok) return afterSession
    return Math.max(afterSession, getLatestMarkedSession(await response.text()))
  } catch {
    return afterSession
  }
}

function eventText(event: ActivityEvent): string {
  const payload = event.payload || {}
  const preferred =
    payload.reply ?? payload.error ?? payload.delta ?? payload.text ?? event.detail ?? ""
  return typeof preferred === "string" ? preferred : JSON.stringify(preferred)
}

function normalizeActivity(event: ActivityEvent, session: number) {
  const payload = event.payload || {}
  const rawToolCallId = payload.tool_call_id ?? payload.call_id
  const common = {
    session,
    eventId: Number(event.id) || undefined,
    text: eventText(event),
    title: event.title,
    payload,
    createdAt: event.created_at,
    toolCallId:
      typeof rawToolCallId === "string" || typeof rawToolCallId === "number"
        ? String(rawToolCallId)
        : undefined,
  }

  switch (event.event_type) {
    case "processing":
      return { type: "processing", ...common }
    case "thinking":
      return { type: "thinking", ...common }
    case "tool_call":
      return {
        type: payload.phase === "finished" ? "tool_finished" : "tool_started",
        ...common,
        tool: typeof payload.tool === "string" ? payload.tool : event.title,
        arguments: payload.arguments,
        ok: payload.ok === true,
      }
    case "tool_call_started":
      return {
        type: "tool_started",
        ...common,
        tool: typeof payload.tool === "string" ? payload.tool : event.title,
        arguments: payload.arguments,
      }
    case "tool_call_finished":
      return {
        type: "tool_finished",
        ...common,
        tool: typeof payload.tool === "string" ? payload.tool : event.title,
        ok: payload.ok === true,
      }
    case "file_created":
    case "file_modified":
    case "file_deleted":
    case "command_run":
      return {
        type: "tool_finished",
        ...common,
        tool: event.event_type,
        ok: payload.ok !== false,
      }
    case "token_delta":
      return { type: "delta", ...common }
    case "message_snapshot":
      return { type: "message", ...common }
    case "request_completed":
      return { type: "done", ...common }
    case "request_failed":
      return { type: "error", ...common }
    default:
      return null
  }
}

function parseSseData(frame: string): unknown {
  const data = frame
    .split(/\r?\n/)
    .filter(line => line.startsWith("data:"))
    .map(line => line.slice(5).trimStart())
    .join("\n")
  if (!data) return null
  try {
    return JSON.parse(data)
  } catch {
    return null
  }
}

type DurableSessionDocument = {
  id?: string
  project_id?: string
  session_number?: number
  model_profile?: string
  status?: "open" | "completed" | "failed" | "cancelled"
  events?: ActivityEvent[]
}

function activityDisplayName(tool: string, args: unknown): string {
  const values = args && typeof args === "object" ? args as Record<string, unknown> : {}
  const path = values.path ?? values.file_path ?? values.file
  if (typeof path === "string") return path
  const command = values.command ?? values.cmd ?? values.script
  if (typeof command === "string") return command
  if (Array.isArray(values.paths)) return `${values.paths.length} files`
  if (Array.isArray(values.files)) return `${values.files.length} files`
  return tool
}

function durableSessionToTurn(document: DurableSessionDocument) {
  const events = Array.isArray(document.events) ? document.events : []
  const actions: Array<Record<string, unknown>> = []
  const pendingByTool = new Map<string, number[]>()
  const pendingByCallId = new Map<string, number>()
  const thinking: string[] = []
  let userMessage = ""
  let reply = ""
  let highestEventId = 0

  for (const event of events) {
    highestEventId = Math.max(highestEventId, Number(event.id) || 0)
    const payload = event.payload || {}
    const tool = typeof payload.tool === "string" ? payload.tool : (event.title || "Agent tool")
    const callValue = payload.tool_call_id ?? payload.call_id
    const callId = typeof callValue === "string" || typeof callValue === "number"
      ? String(callValue)
      : undefined

    if (event.event_type === "request_started") {
      userMessage = eventText(event)
    } else if (event.event_type === "thinking") {
      const text = eventText(event)
      if (text) thinking.push(text)
    } else if (event.event_type === "tool_call_started" || (event.event_type === "tool_call" && payload.phase !== "finished")) {
      const index = actions.push({
        id: `${document.id || "session"}-${event.id || actions.length}`,
        toolName: tool,
        displayName: activityDisplayName(tool, payload.arguments),
        status: "running",
        args: payload.arguments,
        toolCallId: callId,
        session: document.session_number,
        eventId: event.id,
      }) - 1
      if (callId) pendingByCallId.set(callId, index)
      const queue = pendingByTool.get(tool) || []
      queue.push(index)
      pendingByTool.set(tool, queue)
    } else if (event.event_type === "tool_call_finished" || (event.event_type === "tool_call" && payload.phase === "finished")) {
      let index = callId ? pendingByCallId.get(callId) : undefined
      if (index === undefined) {
        const queue = pendingByTool.get(tool) || []
        index = queue.shift()
        if (queue.length) pendingByTool.set(tool, queue)
        else pendingByTool.delete(tool)
      }
      if (index === undefined) {
        index = actions.push({
          id: `${document.id || "session"}-${event.id || actions.length}`,
          toolName: tool,
          displayName: activityDisplayName(tool, payload.arguments),
          status: payload.ok === false ? "error" : "done",
          args: payload.arguments,
          toolCallId: callId,
          session: document.session_number,
          eventId: event.id,
        }) - 1
      } else {
        actions[index] = {
          ...actions[index],
          status: payload.ok === false ? "error" : "done",
          result: eventText(event),
        }
      }
    } else if (["file_created", "file_modified", "file_deleted", "command_run"].includes(event.event_type || "")) {
      actions.push({
        id: `${document.id || "session"}-${event.id || actions.length}`,
        toolName: event.event_type,
        displayName: activityDisplayName(event.event_type || "command_run", payload),
        status: payload.ok === false ? "error" : "done",
        args: payload,
        session: document.session_number,
        eventId: event.id,
      })
    } else if (event.event_type === "request_completed") {
      reply = eventText(event)
    } else if (event.event_type === "request_failed") {
      reply = eventText(event)
    }
  }

  return {
    id: document.id,
    session: Number(document.session_number) || undefined,
    status: document.status || "completed",
    modelProfile: document.model_profile,
    userMessage,
    reply,
    thinking: thinking.join("\n\n"),
    actions,
    eventId: highestEventId || undefined,
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { id: projectId } = await params
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, projectId)
  if (!project) return Response.json({ message: "Project not found" }, { status: 404 })

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) return Response.json({ message: workspace.error, turns: [] }, { status: 409 })

  const config = getSyteConfig()
  const requestedSessionId = new URL(_request.url).searchParams.get("sessionId")?.trim()
  const fetchDocument = async (sessionId: string): Promise<DurableSessionDocument | null> => {
    const detailResponse = await fetch(
      `${config.baseUrl}/api/agent_session/${encodeURIComponent(sessionId)}`,
      {
        headers: syteHeaders(config.apiKey, "application/json"),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      },
    ).catch(() => null)
    if (!detailResponse?.ok) return null
    return detailResponse.json().catch(() => null) as Promise<DurableSessionDocument | null>
  }

  if (requestedSessionId) {
    const document = await fetchDocument(requestedSessionId)
    const belongsToProject = document?.project_id === workspace.uuid
    return Response.json({ turns: belongsToProject ? [durableSessionToTurn(document)] : [] })
  }

  const listUrl = new URL(`${config.baseUrl}/api/agent_sessions`)
  listUrl.searchParams.set("uuid", workspace.uuid)
  const listResponse = await fetch(listUrl, {
    headers: syteHeaders(config.apiKey, "application/json"),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)

  if (!listResponse?.ok) {
    return Response.json({
      message: `Unable to restore durable agent sessions${listResponse ? ` (HTTP ${listResponse.status})` : ""}.`,
      turns: [],
    }, { status: listResponse?.status || 502 })
  }

  const list = await listResponse.json().catch(() => null) as {
    sessions?: Array<{ id?: string; session_number?: number }>
  } | null
  const summaries = Array.isArray(list?.sessions) ? list.sessions.slice(0, 50) : []
  const documents: Array<DurableSessionDocument | null> = []
  for (let index = 0; index < summaries.length; index += 5) {
    const batch = summaries.slice(index, index + 5)
    documents.push(...await Promise.all(batch.map(summary =>
      summary.id ? fetchDocument(summary.id) : Promise.resolve(null),
    )))
  }

  const turns = documents
    .filter((document): document is DurableSessionDocument => Boolean(document?.id))
    .map(durableSessionToTurn)
    .sort((a, b) => (a.session || 0) - (b.session || 0))

  return Response.json({ turns })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  const body = await request.json().catch(() => null) as {
    message?: unknown
    modelProfile?: unknown
    afterSession?: unknown
  } | null
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const requestedProfile = typeof body?.modelProfile === "string" ? body.modelProfile : ""
  const modelProfile = MODEL_PROFILES.has(requestedProfile) ? requestedProfile : "syra-base"
  const afterSession = Math.max(0, Math.floor(Number(body?.afterSession) || 0))

  if (!projectId || !message) {
    return Response.json({ message: "Project ID and message are required." }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, projectId)
  if (!project) {
    return Response.json({ message: "Project not found" }, { status: 404 })
  }

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) {
    return Response.json({ message: workspace.error, needsCreate: true }, { status: 409 })
  }

  const latestSavedSession = await loadLatestSession(workspace.uuid, afterSession)
  const config = getSyteConfig()

  const openActivityStream = async (sinceId: number) => {
    const activityUrl = new URL(
      `${config.baseUrl}/api/projects/${encodeURIComponent(workspace.uuid)}/agent/activity/stream`,
    )
    activityUrl.searchParams.set("live", "1")
    activityUrl.searchParams.set("since_id", String(sinceId))
    return fetch(activityUrl, {
      headers: syteHeaders(config.apiKey, "text/event-stream"),
      cache: "no-store",
      signal: request.signal,
    }).catch(() => null)
  }

  // Open SSE before submitting the durable change. This avoids accepting a job
  // that the browser cannot observe; since_id=0 replay is filtered by request_id.
  const upstream = await openActivityStream(0)
  if (!upstream?.ok || !upstream.body) {
    return Response.json(
      { message: `Unable to open Syte agent activity stream${upstream ? ` (HTTP ${upstream.status})` : ""}.` },
      { status: 502 },
    )
  }

  const change = await syteAgentChange(workspace.uuid, message, modelProfile)
  const requestId = change.data?.request_id
  const tursoSessionId = change.data?.turso_session_id
  if (!change.ok || !requestId) {
    try { await upstream.body.cancel() } catch { /* ignore */ }
    return Response.json(
      { message: change.error || "Syte agent did not accept the request." },
      { status: change.status || 502 },
    )
  }

  let agentSession = latestSavedSession + 1
  const encoder = new TextEncoder()
  let reader = upstream.body.getReader()
  let stopped = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (value: unknown) => {
        if (!stopped) controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
      }
      const stop = async () => {
        if (stopped) return
        stopped = true
        try { await reader.cancel() } catch { /* upstream may already be closed */ }
        try { controller.close() } catch { /* client may have disconnected */ }
      }

      let buffer = ""
      let decoder = new TextDecoder()
      let highestEventId = 0
      let reconnectAttempts = 0
      let sessionEmitted = false
      let sessionAuthoritative = false
      let terminal = false

      emit({
        type: "session",
        session: agentSession,
        sessionAuthoritative: false,
        tursoSessionId,
        requestId,
      })
      sessionEmitted = true

      try {
        while (!stopped && !terminal) {
          let chunk: ReadableStreamReadResult<Uint8Array>
          try {
            chunk = await reader.read()
          } catch {
            chunk = { done: true, value: undefined }
          }

          if (chunk.done) {
            if (reconnectAttempts >= 4) {
              emit({
                type: "error",
                session: agentSession,
                eventId: highestEventId || undefined,
                text: "Agent activity stream disconnected before the request completed.",
              })
              break
            }

            reconnectAttempts++
            await new Promise(resolve => setTimeout(resolve, reconnectAttempts * 1000))
            const resumed = await openActivityStream(highestEventId)
            if (!resumed?.ok || !resumed.body) continue
            reader = resumed.body.getReader()
            decoder = new TextDecoder()
            buffer = ""
            continue
          }

          buffer += decoder.decode(chunk.value, { stream: true })
          const frames = buffer.split(/\r?\n\r?\n/)
          buffer = frames.pop() || ""

          for (const frame of frames) {
            const parsed = parseSseData(frame) as {
              type?: string
              event?: ActivityEvent
              since_id?: number
            } | null

            if (parsed?.type === "ping") {
              controller.enqueue(encoder.encode(": ping\n\n"))
              continue
            }
            if (parsed?.type !== "activity" || !parsed.event) continue

            const eventRequestId = parsed.event.payload?.request_id
            if (eventRequestId !== requestId) continue

            const eventId = Number(parsed.event.id) || 0
            if (eventId && eventId <= highestEventId) continue
            highestEventId = Math.max(highestEventId, eventId)

            const durableSession = Number(parsed.event.payload?.session)
            const hasDurableSession = Number.isSafeInteger(durableSession) && durableSession > 0
            if (hasDurableSession && (!sessionAuthoritative || agentSession !== durableSession)) {
              agentSession = durableSession
              sessionAuthoritative = true
              emit({
                type: "session",
                session: agentSession,
                sessionAuthoritative: true,
                eventId: highestEventId,
                requestId,
              })
              sessionEmitted = true
            } else if (!sessionEmitted) {
              emit({
                type: "session",
                session: agentSession,
                sessionAuthoritative: false,
                eventId: highestEventId,
                requestId,
              })
              sessionEmitted = true
            }

            const normalized = normalizeActivity(parsed.event, agentSession)
            if (!normalized) continue
            emit(normalized)

            if (normalized.type === "done" || normalized.type === "error") {
              terminal = true
              break
            }
          }
        }
      } catch (error) {
        if (!stopped) {
          emit({
            type: "error",
            session: agentSession,
            eventId: highestEventId || undefined,
            text: error instanceof Error ? error.message : "Agent activity stream failed.",
          })
        }
      } finally {
        await stop()
      }
    },
    async cancel() {
      stopped = true
      try { await reader.cancel() } catch { /* ignore */ }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
