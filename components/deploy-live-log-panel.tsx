"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Loader2, Terminal, XCircle, Clock, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type StageId =
  | "queued"
  | "github"
  | "runner-git"
  | "installing"
  | "building"
  | "starting-server"
  | "configuring-proxy"
  | "public-health"
  | "complete"

type DeployStreamEvent =
  | {
      type: "stage"
      stage: string
      status: "pending" | "running" | "success" | "error"
      message: string
      timestamp: string
    }
  | {
      type: "log"
      source: string
      line: string
      timestamp: string
    }
  | {
      type: "result"
      success: true
      url: string
      domain: string
      port?: number
      health?: any
      timestamp: string
    }
  | {
      type: "error"
      error: string
      stage?: string
      logs?: string[]
      timestamp: string
    }

export type DeployLiveLogPanelProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectName?: string
  onSuccess?: (result: { url: string; domain: string }) => void
  onFinish?: (outcome: { success: boolean; result?: { url: string; domain: string }; error?: string; stage?: string }) => void
  onStageChange?: (stage: string, status: "pending" | "running" | "success" | "error") => void
}

const STAGES: Array<{ id: StageId; label: string; description: string }> = [
  { id: "queued", label: "Queued", description: "Deployment request received" },
  { id: "github", label: "GitHub push", description: "Writing generated source to GitHub" },
  { id: "runner-git", label: "Runner git pull", description: "Cloning or resetting the VM checkout" },
  { id: "installing", label: "Install", description: "Running npm install" },
  { id: "building", label: "Build", description: "Running npm run build" },
  { id: "starting-server", label: "Server", description: "Launching Next.js via PM2" },
  { id: "configuring-proxy", label: "Proxy", description: "Configuring nginx" },
  { id: "public-health", label: "Public health", description: "Checking sycord.site HTML" },
  { id: "complete", label: "Complete", description: "Site is live" },
]

const KNOWN_STAGES = new Set(STAGES.map((s) => s.id))

function normalizeStage(stage: string): StageId {
  // Map runner stage names to UI stage ids
  const map: Record<string, StageId> = {
    queued: "queued",
    github: "github",
    "github-push": "github",
    "vm-connect": "runner-git",
    "runner-git": "runner-git",
    "git-sync": "runner-git",
    installing: "installing",
    building: "building",
    "allocating-port": "starting-server",
    "starting-server": "starting-server",
    "configuring-proxy": "configuring-proxy",
    "health-check": "public-health",
    "public-health": "public-health",
    "public-health-check": "public-health",
    complete: "complete",
    failed: "complete",
  }
  const normalized = map[stage]
  if (normalized && KNOWN_STAGES.has(normalized)) return normalized
  // For any unknown stage, don't normalize — use as-is and add to stages dynamically
  return "runner-git"
}

export function DeployLiveLogPanel({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSuccess,
  onFinish,
  onStageChange,
}: DeployLiveLogPanelProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [stageState, setStageState] = useState<Record<string, "pending" | "running" | "success" | "error">>(() => {
    const initial: Record<string, "pending" | "running" | "success" | "error"> = {}
    for (const s of STAGES) initial[s.id] = "pending"
    return initial
  })
  const [stageTimes, setStageTimes] = useState<Record<string, number>>({})
  const [result, setResult] = useState<{ url: string; domain: string } | null>(null)
  const [error, setError] = useState<{ stage?: string; message: string } | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [isRunning, setIsRunning] = useState(false)
  const [lastMessage, setLastMessage] = useState("Waiting for deploy stream")
  const [attempt, setAttempt] = useState(0)
  const logViewportRef = useRef<HTMLDivElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (!open || !projectId) return

    setLogs([])
    setResult(null)
    setError(null)
    setIsRunning(true)
    setLastMessage("Connecting to deploy stream")
    const initial: Record<string, "pending" | "running" | "success" | "error"> = {}
    for (const s of STAGES) initial[s.id] = "pending"
    initial.queued = "running"
    setStageState(initial)
    setStageTimes({})

    const abortController = new AbortController()
    abortRef.current = abortController

    const run = async () => {
      try {
        const response = await fetch("/api/deploy/stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
          signal: abortController.signal,
        })

        if (!response.ok || !response.body) {
          const text = await response.text().catch(() => "")
          throw new Error(text || "Failed to start deploy stream")
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const blocks = buffer.split("\n\n")
          buffer = blocks.pop() || ""

          for (const block of blocks) {
            const event = parseSseBlock(block)
            if (!event) continue
            consumeEvent(event)
          }
        }
      } catch (streamError: any) {
        if (abortController.signal.aborted) return
        const message = streamError?.message || "Deployment failed"
        setError({ message })
        setIsRunning(false)
        onFinish?.({ success: false, error: message })
      }
    }

    run()

    return () => {
      abortController.abort()
      abortRef.current = null
    }
  }, [open, projectId, attempt])

  useEffect(() => {
    if (!autoScroll || !logViewportRef.current) return
    logViewportRef.current.scrollTop = logViewportRef.current.scrollHeight
  }, [logs, autoScroll])

  function consumeEvent(event: DeployStreamEvent) {
    if (event.type === "stage") {
      const normalized = normalizeStage(event.stage)
      setLastMessage(event.message)
      if (normalized !== "queued" && normalized !== "complete") {
        onStageChange?.(normalized, event.status)
      }
      setStageState((current) => {
        const next = { ...current, [normalized]: event.status }
        // Mark all previous stages as success when a new stage starts
        const stageOrder = STAGES.map((s) => s.id)
        const idx = stageOrder.indexOf(normalized)
        if (idx >= 0 && event.status === "running") {
          for (let i = 0; i < idx; i++) {
            const prevStage = stageOrder[i]
            if (next[prevStage] === "running") {
              next[prevStage] = "success"
              if (prevStage !== "queued" && prevStage !== "complete") {
                onStageChange?.(prevStage, "success")
              }
            }
          }
        }
        return next
      })
      // Track stage timing
      setStageTimes((current) => {
        const next = { ...current }
        if (!next[normalized] && event.status === "running") {
          next[normalized] = Date.now()
        }
        return next
      })
      if (event.status === "error") {
        setError({ stage: event.stage, message: event.message })
        setIsRunning(false)
      }
      return
    }

    if (event.type === "log") {
      setLogs((current) => current.concat(`[${event.source}] ${event.line}`))
      return
    }

    if (event.type === "result") {
      setResult({ url: event.url, domain: event.domain })
      for (const stage of STAGES) {
        if (stage.id !== "queued" && stage.id !== "complete") onStageChange?.(stage.id, "success")
      }
      setStageState((current) => {
        const next = { ...current }
        for (const s of STAGES) {
          if (next[s.id] === "running" || next[s.id] === "pending") {
            next[s.id] = "success"
          }
        }
        return next
      })
      setLastMessage("Deployment complete")
      setIsRunning(false)
      onSuccess?.({ url: event.url, domain: event.domain })
      onFinish?.({ success: true, result: { url: event.url, domain: event.domain } })
      return
    }

    // type === "error"
    setError({ stage: event.stage, message: event.error })
    const errorLogs = "logs" in event ? event.logs : undefined
    if (Array.isArray(errorLogs) && errorLogs.length > 0) {
      setLogs((current) => current.concat(errorLogs.map((line) => `[error] ${line}`)))
    }
    setIsRunning(false)
    onFinish?.({ success: false, error: event.error, stage: event.stage })
  }

  function parseSseBlock(block: string): DeployStreamEvent | null {
    const eventLine = block.split("\n").find((line) => line.startsWith("event:"))
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"))
    if (!eventLine || !dataLine) return null
    try {
      const parsed = JSON.parse(dataLine.slice(5).trim())
      // Ensure type field exists - it may be embedded in data
      if (!parsed.type) {
        const eventType = eventLine.slice(6).trim()
        return { type: eventType, ...parsed } as DeployStreamEvent
      }
      return parsed as DeployStreamEvent
    } catch {
      return null
    }
  }

  function copyLogs() {
    navigator.clipboard.writeText(logs.join("\n"))
  }

  function downloadLogs() {
    const blob = new Blob([logs.join("\n")], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${projectId}-deploy.log`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function closePanel(nextOpen: boolean) {
    if (!nextOpen && isRunning) {
      abortRef.current?.abort()
    }
    onOpenChange(nextOpen)
  }

  function getStageDuration(stageId: StageId): string {
    const start = stageTimes[stageId]
    if (!start) return ""
    const ms = Date.now() - start
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  return (
    <Dialog open={open} onOpenChange={closePanel}>
      <DialogContent
        showCloseButton={!isRunning}
        className="h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] max-w-[calc(100vw-1rem)] overflow-hidden border-zinc-800 bg-[#05070b] p-0 text-zinc-100 shadow-[0_40px_120px_rgba(0,0,0,0.65)] sm:h-[min(760px,calc(100dvh-2rem))] sm:max-w-5xl"
      >
        <div className="relative flex h-full min-h-0 flex-col overflow-hidden sm:rounded-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(66,153,225,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%)]" />
          <div className="relative flex shrink-0 flex-col gap-3 border-b border-white/8 px-3 py-3 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:py-5">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.24em] text-zinc-500 sm:text-xs sm:tracking-[0.28em]">Deploying</p>
              <h2 className="mt-1 truncate text-lg font-semibold text-white sm:mt-2 sm:text-2xl">{projectName || projectId}</h2>
              <p className="mt-1 truncate text-xs text-zinc-400 sm:text-sm">{result?.domain || `${projectId}.sycord.site`}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
              <Button variant="ghost" size="sm" onClick={copyLogs} className="h-8 justify-start text-xs text-zinc-300 hover:bg-white/8 sm:h-9 sm:justify-center sm:text-sm">
                <Copy className="mr-2 h-4 w-4" />
                Copy logs
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadLogs} className="h-8 justify-start text-xs text-zinc-300 hover:bg-white/8 sm:h-9 sm:justify-center sm:text-sm">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCollapsed((value) => !value)} className="col-span-2 h-8 justify-start text-xs text-zinc-300 hover:bg-white/8 sm:col-span-1 sm:h-9 sm:justify-center sm:text-sm">
                {collapsed ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronUp className="mr-2 h-4 w-4" />}
                {collapsed ? "Expand" : "Collapse"}
              </Button>
            </div>
          </div>

          <div className="relative grid min-h-0 flex-1 gap-0 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Stage panel */}
            <div className="max-h-[36dvh] overflow-y-auto border-b border-white/6 bg-white/[0.02] px-3 py-3 lg:max-h-none lg:border-r lg:border-b-0 lg:px-5 lg:py-5">
              <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:mb-4 sm:text-xs">Stages</p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:block lg:space-y-1">
                {STAGES.map((stage) => {
                  const state = stageState[stage.id] || "pending"
                  const StageIcon =
                    state === "success" ? CheckCircle2 :
                    state === "running" ? Loader2 :
                    state === "error" ? XCircle :
                    Clock
                  return (
                    <div
                      key={stage.id}
                      className={cn(
                        "flex items-start gap-2 rounded-xl border px-2.5 py-2 transition-colors sm:gap-3 sm:px-3 sm:py-3",
                        state === "running" && "border-amber-500/40 bg-amber-500/5",
                        state === "success" && "border-emerald-500/20 bg-emerald-500/5",
                        state === "error" && "border-red-500/40 bg-red-500/5",
                        state === "pending" && "border-white/4 bg-transparent",
                      )}
                    >
                      <StageIcon
                        className={cn(
                          "mt-0.5 h-4 w-4 shrink-0",
                          state === "success" && "text-emerald-400",
                          state === "running" && "animate-spin text-amber-300",
                          state === "error" && "text-red-400",
                          state === "pending" && "text-zinc-700",
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              "text-xs font-medium sm:text-sm",
                              state === "success" && "text-emerald-200",
                              state === "running" && "text-amber-200",
                              state === "error" && "text-red-200",
                              state === "pending" && "text-zinc-500",
                            )}
                          >
                            {stage.label}
                          </p>
                          {state === "running" && getStageDuration(stage.id) && (
                            <span className="text-xs text-amber-400 tabular-nums">
                              {getStageDuration(stage.id)}
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-[11px] text-zinc-500 sm:text-xs">{stage.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-3 rounded-2xl border border-white/6 bg-black/25 p-3 sm:mt-4 sm:p-4">
                <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-500 sm:text-xs">Status</p>
                <p className="mt-2 break-words text-xs text-zinc-200 sm:text-sm">{error?.message || lastMessage}</p>
                {error?.stage && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-red-300">
                    <AlertTriangle className="h-3 w-3" />
                    Failing stage: {error.stage}
                  </div>
                )}
              </div>
            </div>

            {/* Log terminal */}
            {!collapsed && (
              <div className="flex min-h-0 flex-col">
                <div className="flex flex-col gap-2 border-b border-white/6 px-4 py-3 text-xs text-zinc-500 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Live build output
                  </div>
                  <button className="text-zinc-400 hover:text-white" onClick={() => setAutoScroll((value) => !value)}>
                    Auto-scroll: {autoScroll ? "on" : "off"}
                  </button>
                </div>
                <div ref={logViewportRef} className="min-h-[24dvh] flex-1 overflow-y-auto bg-[#020409] px-3 py-3 font-mono text-[11px] leading-5 sm:px-5 sm:py-4 sm:text-[12px] sm:leading-6">
                  {logs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-zinc-600">
                      {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : "No logs captured"}
                    </div>
                  ) : (
                    logs.map((line, index) => (
                      <div
                        key={`${line}-${index}`}
                        className={cn(
                          "border-b border-white/[0.03] py-0.5",
                          /\[error\]|error|failed|exception/i.test(line) && "text-red-300",
                          /\[warn\]|warn/i.test(line) && "text-amber-300",
                          /\[runner\]|success|complete|ready|healthy/i.test(line) && "text-emerald-300",
                          /\[install\]/i.test(line) && "text-cyan-300",
                          /\[build\]/i.test(line) && "text-violet-300",
                          /\[runtime\]/i.test(line) && "text-blue-300",
                          /\[health\]/i.test(line) && "text-pink-300",
                          /\[proxy\]/i.test(line) && "text-orange-300",
                          !/\[error\]|\[warn\]|\[runner\]|\[install\]|\[build\]|\[runtime\]|\[health\]|\[proxy\]|error|failed|exception|warn|success|complete|ready|healthy/i.test(line) && "text-zinc-400",
                        )}
                      >
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="relative flex shrink-0 flex-col gap-3 border-t border-white/8 px-3 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-6 sm:py-4">
            <div className="flex items-center gap-2">
              {result ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Deployment complete
                </span>
              ) : error ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-sm text-red-300">
                  <XCircle className="h-4 w-4" />
                  Deployment failed
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-200">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deploying...
                </span>
              )}
            </div>

            <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
              {result?.url && (
                <>
                  <Button asChild className="h-9 bg-white text-black hover:bg-zinc-200">
                    <a href={result.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open website
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(result.url)} className="h-9 border-white/10 bg-transparent text-white hover:bg-white/8">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </Button>
                </>
              )}
              {error && (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="h-9 border-white/10 bg-transparent text-white hover:bg-white/8">
                    Close
                  </Button>
                  <Button onClick={() => setAttempt((value) => value + 1)} className="h-9 bg-red-500 text-white hover:bg-red-400">
                    Retry deploy
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
