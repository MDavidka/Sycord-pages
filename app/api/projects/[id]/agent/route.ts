import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { getSyteConfig, syteAgentChange, syteAgentStatus } from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const MODEL_PROFILES = new Set(["syra-nano", "syra-base", "syra-havy"])

type ActivityEvent = {
  id?: number
  event_type?: string
  title?: string
  detail?: string
  payload?: Record<string, unknown>
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

  // Decide whether we can submit a fresh change or must resume an in-flight task.
  let observeMode = false
  let requestId: string | undefined

  let busy = false
  try {
    const status = await syteAgentStatus(workspace.uuid)
    const d = status.data as
      | { agent_running?: boolean; agent_status?: string }
      | undefined
    busy =
      d?.agent_running === true ||
      d?.agent_status === "running" ||
      d?.agent_status === "busy"
  } catch {
    busy = false
  }

  if (busy) {
    observeMode = true
  } else {
    const change = await syteAgentChange(workspace.uuid, message, modelProfile)
    requestId = change.data?.request_id
    if (!change.ok || !requestId) {
      observeMode = true
    }
  }

  // In observe mode (resuming an already-running task) we must not replay events
  // the browser has already seen, otherwise a previous task's output gets
  // re-applied to the new message. Start the stream just after the last event we
  // have persisted for this project.
  let sinceId = 0
  if (observeMode) {
    try {
      const last = await db
        .collection("agentActivity")
        .find({ userId: session.user.id, projectId })
        .sort({ eventId: -1 })
        .limit(1)
        .toArray()
      if (last.length && typeof last[0].eventId === "number") sinceId = last[0].eventId
    } catch {
      /* start from 0 */
    }
  }

  // Open SSE after the decision so observe mode can use a sensible since_id.
  const upstream = await openActivityStream(sinceId)
  if (!upstream?.ok || !upstream.body) {
    return Response.json(
      { message: `Unable to open Syte agent activity stream${upstream ? ` (HTTP ${upstream.status})` : ""}.` },
      { status: 502 },
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

            // In observe mode (resuming an already-running task) we forward all
            // activity; otherwise we only forward events for this request.
            const eventRequestId = parsed.event.payload?.request_id
            if (!observeMode && eventRequestId !== requestId) continue

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
