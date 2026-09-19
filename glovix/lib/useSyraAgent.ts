// useSyraAgent — thin client over Syte's marked agent activity SSE stream.
//
// Docs: https://sycord.site/api/#agent
//   GET /api/projects/{uuid}/agent/activity/stream?live=1&since_id=0&format=marked
//
// Responsibilities:
//   1. Prewarm the per-project Syte runtime when the chat opens.
//   2. Submit a change message (POST /api/syra/[id]/change → request_id).
//   3. Consume the durable activity SSE stream (marked encoding) and render
//      only the latest `[sessionN]` — older sessions that are already saved are
//      never re-fetched (snapshots use session=last).
//   4. Resume with since_id / Last-Event-ID on reconnect.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  buildTurnsFromEvents,
  extractDetail,
  parseAgentStreamFrame,
  toolKind,
  type SyraActivity,
  type SyraPhase,
  type SyraTurn,
  type SyteActivityEvent,
} from "./syra-agent-events"
import type { SyraModelProfile } from "./syra-model-profiles"

export type { SyraTurn } from "./syra-agent-events"

export interface UseSyraAgentOptions {
  projectId: string
  uuid?: string
  autoWarm?: boolean
  /**
   * When true (a newly created project), skip even the latest-session snapshot
   * and connect at the stream tip — a fresh start with nothing loaded.
   */
  freshStart?: boolean
}

export interface UseSyraAgentResult {
  turns: SyraTurn[]
  phase: SyraPhase
  isBusy: boolean
  connected: boolean
  /** True while the latest `[sessionN]` snapshot is being fetched on open. */
  loadingHistory: boolean
  error: string | null
  submit: (message: string, modelProfile?: SyraModelProfile) => Promise<void>
  stop: () => void
}

let clientTurnSeq = 0
function nextClientId() {
  clientTurnSeq += 1
  return `local-${Date.now()}-${clientTurnSeq}`
}

export function useSyraAgent(opts: UseSyraAgentOptions): UseSyraAgentResult {
  const { projectId, uuid, autoWarm = true, freshStart = false } = opts

  const [turns, setTurns] = useState<SyraTurn[]>([])
  const [phase, setPhase] = useState<SyraPhase>("idle")
  const [connected, setConnected] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(!freshStart)
  const [error, setError] = useState<string | null>(null)

  const esRef = useRef<EventSource | null>(null)
  const lastIdRef = useRef<number>(0)
  const activeRequestRef = useRef<string | null>(null)
  /** Highest `[sessionN]` we are willing to render — older sessions are ignored. */
  const latestSessionRef = useRef<number>(0)
  const activeSessionRef = useRef<number | null>(null)
  const closedRef = useRef(false)
  const reopenRef = useRef<() => void>(() => {})

  const streamBase = `/api/syra/${encodeURIComponent(projectId)}/stream`

  const patchTurn = useCallback(
    (predicate: (t: SyraTurn) => boolean, patch: (t: SyraTurn) => SyraTurn) => {
      setTurns((prev) => {
        const idx = [...prev].reverse().findIndex(predicate)
        if (idx === -1) return prev
        const realIdx = prev.length - 1 - idx
        const next = [...prev]
        next[realIdx] = patch(next[realIdx])
        return next
      })
    },
    [],
  )

  /** Locate the turn for a request_id / session, falling back to the latest pending turn. */
  const bindTurn = useCallback((requestId: string, userMessage?: string, session?: number) => {
    setTurns((prev) => {
      if (prev.some((t) => t.requestId === requestId)) {
        if (session == null) return prev
        return prev.map((t) => (t.requestId === requestId ? { ...t, session: t.session ?? session } : t))
      }
      const idx = [...prev]
        .reverse()
        .findIndex((t) => t.role === "user" && !t.requestId)
      if (idx !== -1) {
        const realIdx = prev.length - 1 - idx
        const next = [...prev]
        next[realIdx] = {
          ...next[realIdx],
          requestId,
          session: session ?? next[realIdx].session,
          phase: "starting",
          userMessage: userMessage ?? next[realIdx].userMessage,
        }
        return next
      }
      return [
        ...prev,
        {
          id: nextClientId(),
          requestId,
          session,
          role: "user",
          userMessage,
          phase: "starting",
          thinking: "",
          activities: [],
          createdAt: Date.now(),
        },
      ]
    })
  }, [])

  const handleRecord = useCallback(
    (tag: string, data: Record<string, any>) => {
      if (typeof data?.id === "number" && data.id > lastIdRef.current) {
        lastIdRef.current = data.id
      }

      // Marked `[sessionN]` — adopt as latest; drop older sessions from the UI.
      if (tag === "session" && typeof data?.session === "number") {
        const session = data.session as number
        if (session > latestSessionRef.current) {
          latestSessionRef.current = session
          // Drop any turns belonging to older `[sessionN]` blocks that may have
          // been replayed before we discovered the true tip session.
          setTurns((prev) =>
            prev.filter((t) => t.session == null || t.session >= session || !t.requestId),
          )
        }
        if (session >= latestSessionRef.current) {
          activeSessionRef.current = session
          bindTurn(`session-${session}`, undefined, session)
          setPhase("starting")
        }
        return
      }

      if (tag === "boot") return

      const sessionNum: number | undefined =
        typeof data?.session === "number" ? data.session : undefined
      if (
        sessionNum != null &&
        latestSessionRef.current > 0 &&
        sessionNum < latestSessionRef.current
      ) {
        // Older saved session — skip; only stream the latest `[sessionN]`.
        return
      }

      const requestId: string | undefined =
        data?.request_id ||
        (sessionNum != null ? `session-${sessionNum}` : undefined) ||
        (activeSessionRef.current != null ? `session-${activeSessionRef.current}` : undefined)

      switch (tag) {
        case "status":
          return
        case "ping":
          if (typeof data?.since_id === "number" && data.since_id > lastIdRef.current) {
            lastIdRef.current = data.since_id
          }
          return
        case "reconnect":
          if (typeof data?.since_id === "number") lastIdRef.current = data.since_id
          reopenRef.current()
          return

        case "start": {
          if (requestId) {
            activeRequestRef.current = requestId
            bindTurn(requestId, data?.text, sessionNum)
          }
          setPhase("starting")
          return
        }

        case "processing": {
          if (requestId) activeRequestRef.current = requestId
          patchTurn(
            (t) => t.requestId === requestId,
            (t) => ({ ...t, phase: t.phase === "idle" ? "starting" : t.phase }),
          )
          return
        }

        case "think": {
          const text: string = data?.text || ""
          patchTurn(
            (t) => t.requestId === requestId || t.requestId === activeRequestRef.current,
            (t) => ({
              ...t,
              phase: "thinking",
              thinking: t.thinking ? `${t.thinking}${text}` : text,
            }),
          )
          setPhase("thinking")
          return
        }

        case "tool:start": {
          const tool: string = data?.tool || data?.title || "tool"
          const kind = toolKind(tool)
          const activity: SyraActivity = {
            id: String(data?.id ?? `${tool}-${Date.now()}`),
            kind,
            tool,
            status: "running",
            detail: extractDetail(kind, data?.arguments ?? data?.text),
            requestId,
            createdAt: Date.now(),
          }
          patchTurn(
            (t) => t.requestId === requestId || t.requestId === activeRequestRef.current,
            (t) => ({
              ...t,
              phase: kind === "plan" ? "planning" : "working",
              activities: [...t.activities, activity],
            }),
          )
          setPhase((p) => (p === "done" || p === "error" ? p : "working"))
          return
        }

        case "tool:result": {
          const tool: string = data?.tool || data?.title || "tool"
          const isError = data?.is_error === true || data?.ok === false
          patchTurn(
            (t) => t.requestId === requestId || t.requestId === activeRequestRef.current,
            (t) => {
              const activities = [...t.activities]
              for (let i = activities.length - 1; i >= 0; i--) {
                if (activities[i].tool === tool && activities[i].status === "running") {
                  activities[i] = { ...activities[i], status: isError ? "error" : "done" }
                  break
                }
              }
              return { ...t, activities }
            },
          )
          return
        }

        case "delta":
        case "message": {
          const text: string = data?.text || ""
          if (!text) return
          patchTurn(
            (t) => t.requestId === requestId || t.requestId === activeRequestRef.current,
            (t) => ({ ...t, reply: (t.reply || "") + text }),
          )
          return
        }

        case "done": {
          patchTurn(
            (t) => t.requestId === requestId || t.requestId === activeRequestRef.current,
            (t) => ({
              ...t,
              phase: "done",
              reply: data?.text || data?.reply || t.reply,
              activities: t.activities.map((a) =>
                a.status === "running" ? { ...a, status: "done" } : a,
              ),
            }),
          )
          activeRequestRef.current = null
          setPhase("done")
          return
        }

        case "error": {
          const message: string = data?.error || data?.text || "Request failed"
          patchTurn(
            (t) => t.requestId === requestId || t.requestId === activeRequestRef.current,
            (t) => ({ ...t, phase: "error", error: message }),
          )
          activeRequestRef.current = null
          setError(message)
          setPhase("error")
          return
        }

        default:
          return
      }
    },
    [bindTurn, patchTurn],
  )

  const openStream = useCallback(() => {
    if (typeof window === "undefined" || closedRef.current) return
    if (esRef.current) {
      try {
        esRef.current.close()
      } catch {
        /* ignore */
      }
      esRef.current = null
    }

    // Always ask for marked encoding + an explicit since_id (incl. 0).
    const params = new URLSearchParams({
      format: "marked",
      since_id: String(lastIdRef.current || 0),
      live: "1",
    })
    if (uuid) params.set("uuid", uuid)

    const es = new EventSource(`${streamBase}?${params.toString()}`)
    esRef.current = es

    es.onopen = () => {
      setConnected(true)
      setError(null)
    }
    es.onmessage = (evt) => {
      const record = parseAgentStreamFrame(evt.data)
      if (!record) return
      handleRecord(record.tag, record.data)
    }
    es.onerror = () => {
      setConnected(false)
      // EventSource retries automatically and resends Last-Event-ID.
    }
  }, [streamBase, uuid, handleRecord])

  reopenRef.current = openStream

  /**
   * Fetch only the latest `[sessionN]` snapshot (`session=last`). Older saved
   * sessions are intentionally not requested.
   */
  const fetchLatestSessionEvents = useCallback(async (): Promise<SyteActivityEvent[]> => {
    const base = `/api/syra/${encodeURIComponent(projectId)}/activity`
    const params = new URLSearchParams({
      since_id: "0",
      session: "last",
    })
    if (uuid) params.set("uuid", uuid)
    const res = await fetch(`${base}?${params.toString()}`, { cache: "no-store" })
    if (!res.ok) return []
    const data = await res.json().catch(() => null)
    return Array.isArray(data?.events) ? (data.events as SyteActivityEvent[]) : []
  }, [projectId, uuid])

  useEffect(() => {
    closedRef.current = false
    lastIdRef.current = 0
    latestSessionRef.current = 0
    activeSessionRef.current = null
    setTurns([])
    setLoadingHistory(!freshStart)

    if (autoWarm) {
      fetch(`/api/syra/${encodeURIComponent(projectId)}/warm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uuid ? { uuid } : {}),
      }).catch(() => {
        /* warm is best-effort */
      })
    }

    ;(async () => {
      try {
        const events = await fetchLatestSessionEvents()
        if (closedRef.current) return

        // Always advance the resume tip past whatever the latest session has,
        // so the live stream does not re-emit already-saved frames.
        const tip = events.reduce((m, e) => (e.id > m ? e.id : m), 0)
        lastIdRef.current = tip

        // Infer the latest session number from event payloads when present.
        for (const ev of events) {
          const s = (ev.payload as { session?: number } | undefined)?.session
          if (typeof s === "number" && s > latestSessionRef.current) {
            latestSessionRef.current = s
          }
        }

        if (freshStart) {
          // Fresh start: render nothing; tip already jumped past the latest session.
        } else if (events.length > 0) {
          // Only hydrate when the latest session is still in flight — completed
          // sessions are already saved and must not be re-pulled into the UI.
          const hasTerminal = events.some(
            (e) => e.event_type === "request_completed" || e.event_type === "request_failed",
          )
          if (!hasTerminal) {
            const { turns: history, lastId } = buildTurnsFromEvents(events)
            if (closedRef.current) return
            const hydrated = history.map((t) =>
              t.phase === "done" ? { ...t, phase: "working" as SyraPhase } : t,
            )
            setTurns(hydrated)
            lastIdRef.current = Math.max(lastId, tip)
            if (hydrated.length > 0) {
              activeRequestRef.current = hydrated[hydrated.length - 1]?.requestId ?? null
              setPhase("working")
            }
          }
        }
      } catch {
        /* latest-session snapshot is best-effort */
      } finally {
        if (!closedRef.current) setLoadingHistory(false)
      }
      if (closedRef.current) return
      openStream()
    })()

    return () => {
      closedRef.current = true
      if (esRef.current) {
        try {
          esRef.current.close()
        } catch {
          /* ignore */
        }
        esRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, uuid, autoWarm, freshStart])

  const submit = useCallback(
    async (message: string, modelProfile?: SyraModelProfile) => {
      const text = message.trim()
      if (!text) return
      setError(null)
      setPhase("starting")

      const localId = nextClientId()
      setTurns((prev) => [
        ...prev,
        {
          id: localId,
          role: "user",
          userMessage: text,
          phase: "starting",
          thinking: "",
          activities: [],
          createdAt: Date.now(),
        },
      ])

      try {
        const res = await fetch(`/api/syra/${encodeURIComponent(projectId)}/change`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            ...(modelProfile ? { model_profile: modelProfile } : {}),
            ...(uuid ? { uuid } : {}),
          }),
        })
        const data = await res.json().catch(() => null)
        if (!res.ok || !data?.ok) {
          const message = data?.error || `Request failed (${res.status})`
          patchTurn(
            (t) => t.id === localId,
            (t) => ({ ...t, phase: "error", error: message }),
          )
          setError(message)
          setPhase("error")
          return
        }
        if (data.request_id) {
          patchTurn(
            (t) => t.id === localId && !t.requestId,
            (t) => ({ ...t, requestId: data.request_id }),
          )
          activeRequestRef.current = data.request_id
        }
      } catch (err: any) {
        const message = err?.message || "Network error"
        patchTurn(
          (t) => t.id === localId,
          (t) => ({ ...t, phase: "error", error: message }),
        )
        setError(message)
        setPhase("error")
      }
    },
    [projectId, uuid, patchTurn],
  )

  const stop = useCallback(() => {
    activeRequestRef.current = null
    setPhase((p) => (p === "done" || p === "error" ? p : "idle"))
  }, [])

  const isBusy =
    phase === "starting" || phase === "thinking" || phase === "planning" || phase === "working"

  return { turns, phase, isBusy, connected, loadingHistory, error, submit, stop }
}
