import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import {
  syteAgentChange,
  syteAgentSession,
  syteAgentSessions,
  type SyteTursoSessionEvent,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const MODEL_PROFILES = new Set(["syra-nano", "syra-base", "syra-havy"])
const POLL_INTERVAL_MS = 1500
const MAX_POLL_MS = 280_000

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"))
      return
    }
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException("Aborted", "AbortError"))
    }
    signal?.addEventListener("abort", onAbort, { once: true })
  })
}

async function loadLatestSessionNumber(uuid: string, afterSession: number): Promise<number> {
  const listed = await syteAgentSessions(uuid, { limit: 1 })
  if (!listed.ok || !listed.data?.sessions?.length) return afterSession
  const latest = Number(listed.data.sessions[0]?.session_number) || 0
  return Math.max(afterSession, latest)
}

function eventText(event: SyteTursoSessionEvent): string {
  const payload = event.payload || {}
  const preferred =
    payload.reply ?? payload.error ?? payload.delta ?? payload.text ?? event.detail ?? ""
  return typeof preferred === "string" ? preferred : JSON.stringify(preferred)
}

function normalizeTursoEvent(event: SyteTursoSessionEvent, session: number) {
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
    case "request_started":
      return { type: "processing", ...common }
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

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  const body = (await request.json().catch(() => null)) as {
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

  const latestSavedSession = await loadLatestSessionNumber(workspace.uuid, afterSession)

  const change = await syteAgentChange(workspace.uuid, message, modelProfile)
  const requestId = change.data?.request_id
  const tursoSessionId = change.data?.turso_session_id
  if (!change.ok || !requestId) {
    return Response.json(
      { message: change.error || "Syte agent did not accept the request." },
      { status: change.status || 502 },
    )
  }

  // Without Turso we cannot stream a durable turn record — fail clearly.
  if (!tursoSessionId) {
    return Response.json(
      {
        message:
          "Syte agent accepted the request but did not return turso_session_id. " +
          "Configure turso_database_url in the Syte AI tab, or upgrade the deployer.",
        request_id: requestId,
        status: change.data?.status ?? "accepted",
      },
      { status: 503 },
    )
  }

  let agentSession = latestSavedSession + 1
  const encoder = new TextEncoder()
  let stopped = false

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (value: unknown) => {
        if (!stopped) controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`))
      }
      const stop = () => {
        if (stopped) return
        stopped = true
        try {
          controller.close()
        } catch {
          /* client may have disconnected */
        }
      }

      let sinceId = 0
      let sessionEmitted = false
      let sessionAuthoritative = false
      let terminal = false
      let highestEventId = 0
      const startedAt = Date.now()

      try {
        emit({
          type: "session",
          session: agentSession,
          sessionAuthoritative: false,
          requestId,
          tursoSessionId,
        })
        sessionEmitted = true

        while (!stopped && !terminal) {
          if (request.signal.aborted) break
          if (Date.now() - startedAt > MAX_POLL_MS) {
            emit({
              type: "error",
              session: agentSession,
              eventId: highestEventId || undefined,
              text: "Timed out waiting for the Turso agent session to finish.",
              tursoSessionId,
              requestId,
            })
            break
          }

          const snap = await syteAgentSession(tursoSessionId, { sinceId })
          if (!snap.ok || !snap.data) {
            // Transient Turso/network errors — keep polling until timeout.
            await sleep(POLL_INTERVAL_MS, request.signal).catch(() => undefined)
            continue
          }

          const doc = snap.data
          const durableSession = Number(doc.session_number) || 0
          if (durableSession > 0 && (!sessionAuthoritative || agentSession !== durableSession)) {
            agentSession = durableSession
            sessionAuthoritative = true
            emit({
              type: "session",
              session: agentSession,
              sessionAuthoritative: true,
              eventId: highestEventId || undefined,
              requestId,
              tursoSessionId,
            })
            sessionEmitted = true
          } else if (!sessionEmitted) {
            emit({
              type: "session",
              session: agentSession,
              sessionAuthoritative: false,
              requestId,
              tursoSessionId,
            })
            sessionEmitted = true
          }

          for (const event of doc.events || []) {
            const eventId = Number(event.id) || 0
            if (eventId && eventId <= sinceId) continue
            if (eventId) {
              sinceId = Math.max(sinceId, eventId)
              highestEventId = Math.max(highestEventId, eventId)
            }

            const eventRequestId = event.payload?.request_id
            if (
              typeof eventRequestId === "string" &&
              eventRequestId &&
              eventRequestId !== requestId
            ) {
              continue
            }

            const normalized = normalizeTursoEvent(event, agentSession)
            if (!normalized) continue
            emit(normalized)

            if (normalized.type === "done" || normalized.type === "error") {
              terminal = true
              break
            }
          }

          if (terminal) break

          if (doc.status && doc.status !== "open") {
            // Session closed without an explicit request_completed/failed event.
            if (doc.status === "failed" || doc.status === "cancelled") {
              emit({
                type: "error",
                session: agentSession,
                eventId: highestEventId || undefined,
                text: `Agent session ${doc.status}.`,
                tursoSessionId,
                requestId,
              })
            } else {
              emit({
                type: "done",
                session: agentSession,
                eventId: highestEventId || undefined,
                text: "",
                tursoSessionId,
                requestId,
              })
            }
            terminal = true
            break
          }

          await sleep(POLL_INTERVAL_MS, request.signal)
        }
      } catch (error) {
        if (!stopped && !(error instanceof DOMException && error.name === "AbortError")) {
          emit({
            type: "error",
            session: agentSession,
            eventId: highestEventId || undefined,
            text: error instanceof Error ? error.message : "Turso agent session poll failed.",
            tursoSessionId,
            requestId,
          })
        }
      } finally {
        stop()
      }
    },
    cancel() {
      stopped = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Turso-Session-Id": tursoSessionId,
      "X-Request-Id": requestId,
    },
  })
}
