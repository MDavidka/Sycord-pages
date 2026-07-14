// useSyraAgent — the client half of the rebuilt Syra backend.
//
// Responsibilities:
//   1. Prewarm the per-project Syte runtime when the chat opens.
//   2. Submit a change message (POST /api/syra/[id]/change → request_id).
//   3. Consume the durable activity SSE stream via a same-origin EventSource,
//      decoding the tagged frames into a per-turn model the UI renders.
//   4. Correlate every frame by request_id and resume with since_id on reconnect.
//
// The heavy lifting (file edits, commands, preview reload) happens server-side
// in the Syte cloud runtime; the browser is a thin, resumable stream consumer.

import { useCallback, useEffect, useRef, useState } from "react"
import {
  extractDetail,
  parseTaggedFrame,
  toolKind,
  type SyraActivity,
  type SyraPhase,
} from "./syra-agent-events"
import type { SyraModelProfile } from "./syra-model-profiles"

export interface SyraTurn {
  /** Client id until the runtime assigns a request_id, then that. */
  id: string
  requestId?: string
  role: "user" | "assistant"
  userMessage?: string
  phase: SyraPhase
  thinking: string
  activities: SyraActivity[]
  reply?: string
  error?: string
  createdAt: number
}

export interface UseSyraAgentOptions {
  projectId: string
  uuid?: string
  autoWarm?: boolean
}

export interface UseSyraAgentResult {
  turns: SyraTurn[]
  phase: SyraPhase
  isBusy: boolean
  connected: boolean
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
  const { projectId, uuid, autoWarm = true } = opts

  const [turns, setTurns] = useState<SyraTurn[]>([])
  const [phase, setPhase] = useState<SyraPhase>("idle")
  const [connected, setConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const esRef = useRef<EventSource | null>(null)
  const lastIdRef = useRef<number>(0)
  const activeRequestRef = useRef<string | null>(null)
  const closedRef = useRef(false)
  // Points to the latest reopen() so handleRecord can trigger a resume on a
  // [reconnect] frame without a declaration-order dependency.
  const reopenRef = useRef<() => void>(() => {})

  const streamBase = `/api/syra/${encodeURIComponent(projectId)}/stream`

  // -----------------------------------------------------------------------
  // Turn helpers
  // -----------------------------------------------------------------------

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

  /** Locate the turn for a request_id, falling back to the latest pending turn. */
  const bindTurn = useCallback((requestId: string, userMessage?: string) => {
    setTurns((prev) => {
      // Already bound?
      if (prev.some((t) => t.requestId === requestId)) return prev
      // Bind to the most recent local turn awaiting a request_id.
      const idx = [...prev]
        .reverse()
        .findIndex((t) => t.role === "user" && !t.requestId)
      if (idx !== -1) {
        const realIdx = prev.length - 1 - idx
        const next = [...prev]
        next[realIdx] = {
          ...next[realIdx],
          requestId,
          phase: "starting",
          userMessage: userMessage ?? next[realIdx].userMessage,
        }
        return next
      }
      // No pending turn (e.g. resumed history) — create one.
      return [
        ...prev,
        {
          id: nextClientId(),
          requestId,
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

  // -----------------------------------------------------------------------
  // Frame handling
  // -----------------------------------------------------------------------

  const handleRecord = useCallback(
    (tag: string, data: Record<string, any>) => {
      if (typeof data?.id === "number" && data.id > lastIdRef.current) {
        lastIdRef.current = data.id
      }
      const requestId: string | undefined = data?.request_id

      switch (tag) {
        case "session":
        case "status":
          return
        case "ping":
          if (typeof data?.since_id === "number" && data.since_id > lastIdRef.current) {
            lastIdRef.current = data.since_id
          }
          return
        case "reconnect":
          // Server asked us to reopen from the given point (per-connection deadline).
          if (typeof data?.since_id === "number") lastIdRef.current = data.since_id
          reopenRef.current()
          return

        case "start": {
          if (requestId) {
            activeRequestRef.current = requestId
            bindTurn(requestId, data?.text)
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
            (t) => ({ ...t, phase: kind === "plan" ? "planning" : "working", activities: [...t.activities, activity] }),
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
              // Match the last still-running activity with this tool name.
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
          // Reserved token-streaming path — append if a provider ever emits it.
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
    // reopen is defined below; it's stable via ref usage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bindTurn, patchTurn],
  )

  // -----------------------------------------------------------------------
  // EventSource lifecycle
  // -----------------------------------------------------------------------

  const openStream = useCallback(() => {
    if (typeof window === "undefined" || closedRef.current) return
    // Tear down any existing connection first.
    if (esRef.current) {
      try {
        esRef.current.close()
      } catch {
        /* ignore */
      }
      esRef.current = null
    }

    const params = new URLSearchParams({ format: "tagged" })
    if (lastIdRef.current > 0) params.set("since_id", String(lastIdRef.current))
    if (uuid) params.set("uuid", uuid)

    const es = new EventSource(`${streamBase}?${params.toString()}`)
    esRef.current = es

    es.onopen = () => {
      setConnected(true)
      setError(null)
    }
    es.onmessage = (evt) => {
      const record = parseTaggedFrame(evt.data)
      if (!record) return
      handleRecord(record.tag, record.data)
    }
    es.onerror = () => {
      setConnected(false)
      // EventSource retries automatically and resends Last-Event-ID, so we let
      // it recover on its own for transient errors.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streamBase, uuid, handleRecord])

  // Keep the reopen ref fresh so handleRecord's closure triggers the latest
  // openStream when a [reconnect] frame arrives.
  reopenRef.current = openStream

  useEffect(() => {
    closedRef.current = false

    // 1) Prewarm the runtime (non-blocking).
    if (autoWarm) {
      fetch(`/api/syra/${encodeURIComponent(projectId)}/warm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(uuid ? { uuid } : {}),
      }).catch(() => {
        /* warm is best-effort */
      })
    }

    // 2) Open the durable activity stream.
    openStream()

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
  }, [projectId, uuid, autoWarm])

  // -----------------------------------------------------------------------
  // Public actions
  // -----------------------------------------------------------------------

  const submit = useCallback(
    async (message: string, modelProfile?: SyraModelProfile) => {
      const text = message.trim()
      if (!text) return
      setError(null)
      setPhase("starting")

      // Optimistic local turn — bound to the runtime once request_started arrives.
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
        // Bind the returned request_id so subsequent frames land on this turn.
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
    // The runtime turn is durable server-side; locally we just stop reflecting
    // it as busy and detach from the active request.
    activeRequestRef.current = null
    setPhase((p) => (p === "done" || p === "error" ? p : "idle"))
  }, [])

  const isBusy =
    phase === "starting" || phase === "thinking" || phase === "planning" || phase === "working"

  return { turns, phase, isBusy, connected, error, submit, stop }
}
