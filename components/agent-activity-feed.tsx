"use client"

import * as React from "react"
import {
  Activity,
  Bot,
  CheckCircle2,
  FileCode2,
  Lightbulb,
  MessageSquare,
  PenLine,
  User,
  Wrench,
  AlertTriangle,
  Radio,
  Loader2,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineTitle,
  TimelineDescription,
  TimelineTime,
} from "@/components/ui/timeline"

interface AgentEvent {
  id: number
  project_id?: string
  event_type?: string
  role?: string
  title?: string
  detail?: string
  payload?: Record<string, unknown>
  source?: string
  created_at?: string
}

type Tone = "default" | "agent" | "user" | "success" | "warn" | "error"

function pickVisual(e: AgentEvent): { Icon: React.ComponentType<{ className?: string }>; tone: Tone } {
  const type = (e.event_type || "").toLowerCase()
  const role = (e.role || "").toLowerCase()
  if (role === "user") return { Icon: User, tone: "user" }
  if (type.includes("error") || type.includes("fail")) return { Icon: AlertTriangle, tone: "error" }
  if (type.includes("file") || type.includes("write") || type.includes("edit"))
    return { Icon: FileCode2, tone: "agent" }
  if (type.includes("tool") || type.includes("action")) return { Icon: Wrench, tone: "agent" }
  if (type.includes("plan")) return { Icon: Lightbulb, tone: "agent" }
  if (type.includes("done") || type.includes("complete") || type.includes("success"))
    return { Icon: CheckCircle2, tone: "success" }
  if (type.includes("think")) return { Icon: PenLine, tone: "default" }
  if (type.includes("message") || type.includes("chat")) return { Icon: MessageSquare, tone: "agent" }
  if (e.source === "user") return { Icon: User, tone: "user" }
  return { Icon: Bot, tone: "agent" }
}

function formatTime(ts?: string): string {
  if (!ts) return ""
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ""
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function AgentActivityFeed({ projectId }: { projectId: string }) {
  const [events, setEvents] = React.useState<AgentEvent[]>([])
  const [status, setStatus] = React.useState<"loading" | "live" | "idle" | "error">("loading")
  const seenRef = React.useRef<Set<number>>(new Set())
  const esRef = React.useRef<EventSource | null>(null)
  const disabledRef = React.useRef(false)

  const persist = React.useCallback(
    async (e: AgentEvent) => {
      if (typeof e.id !== "number") return
      try {
        await fetch("/api/workspace/sycord/agent-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, event: e }),
        })
      } catch {
        /* best-effort persistence */
      }
    },
    [projectId],
  )

  const upsert = React.useCallback(
    (e: AgentEvent) => {
      if (typeof e.id !== "number" || seenRef.current.has(e.id)) return
      seenRef.current.add(e.id)
      setEvents((prev) => {
        if (prev.some((p) => p.id === e.id)) return prev
        return [...prev, e].sort((a, b) => (a.id || 0) - (b.id || 0))
      })
      void persist(e)
    },
    [persist],
  )

  React.useEffect(() => {
    if (!projectId) return
    let cancelled = false

    const loadHistory = async () => {
      try {
        const res = await fetch(
          `/api/workspace/sycord/agent-activity?projectId=${encodeURIComponent(projectId)}&history=1`,
        )
        if (res.status === 409 || res.status === 503) {
          disabledRef.current = true
          return
        }
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const evs: AgentEvent[] = Array.isArray(data?.events) ? data.events : []
        evs.forEach((e) => seenRef.current.add(e.id))
        setEvents((prev) => {
          const map = new Map<number, AgentEvent>()
          ;[...prev, ...evs].forEach((e) => map.set(e.id, e))
          return Array.from(map.values()).sort((a, b) => (a.id || 0) - (b.id || 0))
        })
      } catch {
        /* ignore */
      }
    }

    const catchUp = async () => {
      const lastId = events.length ? Math.max(...events.map((e) => e.id || 0)) : 0
      try {
        const res = await fetch(
          `/api/workspace/sycord/agent-activity?projectId=${encodeURIComponent(
            projectId,
          )}&since_id=${lastId}`,
        )
        if (res.status === 409 || res.status === 503) {
          disabledRef.current = true
          return
        }
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        const evs: AgentEvent[] = Array.isArray(data?.events) ? data.events : []
        evs.forEach(upsert)
      } catch {
        /* ignore */
      }
    }

    let reconnectTimer = 0

    const connect = () => {
      if (disabledRef.current) return
      const lastId = events.length ? Math.max(...events.map((e) => e.id || 0)) : 0
      const url = `/api/workspace/sycord/agent-activity?projectId=${encodeURIComponent(
        projectId,
      )}&live=1&since_id=${lastId}`
      const es = new EventSource(url)
      esRef.current = es

      es.onopen = () => !cancelled && setStatus("live")
      es.onmessage = (ev) => {
        if (cancelled) return
        try {
          const parsed = JSON.parse(ev.data) as AgentEvent
          upsert(parsed)
        } catch {
          /* not JSON — ignore */
        }
      }
      es.onerror = () => {
        if (cancelled || disabledRef.current) return
        setStatus("idle")
        es.close()
        // Auto-reconnect after a short delay so the feed stays continuous.
        reconnectTimer = window.setTimeout(connect, 3000)
      }
    }

    setStatus("loading")
    void loadHistory().then(() => {
      if (cancelled) return
      void catchUp().then(() => {
        if (cancelled) return
        connect()
      })
    })

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      esRef.current?.close()
    }
  }, [projectId, upsert])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-zinc-500" />
          <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">
            Agent activity
          </h3>
        </div>
        <StatusPill status={status} count={events.length} />
      </div>

      <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-white/[0.06] bg-white/[0.015] p-4">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#2e2e30]">
              <Bot className="h-4 w-4 text-zinc-500" />
            </div>
            <p className="text-[13px] text-zinc-500">
              {status === "loading" ? "Connecting to agent…" : "No agent activity yet"}
            </p>
          </div>
        ) : (
          <Timeline>
            {events.map((e, i) => {
              const { Icon, tone } = pickVisual(e)
              return (
                <TimelineItem key={e.id ?? i} className={i === events.length - 1 ? "pb-0" : ""}>
                  {i !== events.length - 1 && <TimelineConnector />}
                  <TimelineDot tone={tone}>
                    <Icon className="h-3.5 w-3.5" />
                  </TimelineDot>
                  <TimelineContent>
                    <div className="flex items-center justify-between gap-2">
                      <TimelineTitle>{e.title || e.event_type || "Agent event"}</TimelineTitle>
                      {e.created_at && <TimelineTime>{formatTime(e.created_at)}</TimelineTime>}
                    </div>
                    {e.detail ? <TimelineDescription>{e.detail}</TimelineDescription> : null}
                  </TimelineContent>
                </TimelineItem>
              )
            })}
          </Timeline>
        )}
      </div>
    </div>
  )
}

function StatusPill({
  status,
  count,
}: {
  status: "loading" | "live" | "idle" | "error"
  count: number
}) {
  const map = {
    loading: { label: "Connecting", cls: "text-zinc-400", Icon: Loader2, spin: true },
    live: { label: "Live", cls: "text-emerald-400", Icon: Radio, spin: false },
    idle: { label: "Offline", cls: "text-zinc-500", Icon: Radio, spin: false },
    error: { label: "Error", cls: "text-red-400", Icon: AlertTriangle, spin: false },
  } as const
  const { label, cls, Icon, spin } = map[status]
  return (
    <span className={cn("flex items-center gap-1.5 text-[11px] font-medium", cls)}>
      <Icon className={cn("h-3 w-3", spin && "animate-spin")} />
      {label}
      {count > 0 && <span className="text-zinc-600">· {count}</span>}
    </span>
  )
}
