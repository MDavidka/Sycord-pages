"use client"

import { useEffect, useRef, useState } from "react"
import { CheckCircle2, ChevronDown, ChevronUp, Copy, Download, ExternalLink, Loader2, Terminal, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

type StageId =
  | "queued"
  | "preparing"
  | "installing"
  | "building"
  | "starting-server"
  | "health-check"
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
      health: unknown
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
}

const STAGES: Array<{ id: StageId; label: string }> = [
  { id: "queued", label: "Queued" },
  { id: "preparing", label: "Preparing" },
  { id: "installing", label: "Installing" },
  { id: "building", label: "Building" },
  { id: "starting-server", label: "Starting server" },
  { id: "health-check", label: "Health check" },
  { id: "complete", label: "Complete" },
]

function normalizeStage(stage: string): StageId {
  if (stage === "vm-connect" || stage === "github" || stage === "writing-files" || stage === "configuring-proxy" || stage === "saving") {
    return "preparing"
  }
  if (stage === "failed") {
    return "health-check"
  }
  if (stage === "complete") {
    return "complete"
  }
  return STAGES.some((item) => item.id === stage) ? (stage as StageId) : "preparing"
}

export function DeployLiveLogPanel({
  open,
  onOpenChange,
  projectId,
  projectName,
  onSuccess,
  onFinish,
}: DeployLiveLogPanelProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [stageState, setStageState] = useState<Record<string, "pending" | "running" | "success" | "error">>({
    queued: "pending",
    preparing: "pending",
    installing: "pending",
    building: "pending",
    "starting-server": "pending",
    "health-check": "pending",
    complete: "pending",
  })
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
    setStageState({
      queued: "running",
      preparing: "pending",
      installing: "pending",
      building: "pending",
      "starting-server": "pending",
      "health-check": "pending",
      complete: "pending",
    })

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
      setStageState((current) => {
        const next = { ...current, [normalized]: event.status }
        if (normalized === "complete" && event.status === "success") {
          next["health-check"] = next["health-check"] === "pending" ? "success" : next["health-check"]
        }
        return next
      })
      if (event.status === "error") {
        setError({ stage: event.stage, message: event.message })
        setIsRunning(false)
      }
      if (event.stage === "complete" && event.status === "success") {
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
      setStageState((current) => ({ ...current, complete: "success" }))
      setLastMessage("Deployment complete")
      setIsRunning(false)
      onSuccess?.({ url: event.url, domain: event.domain })
      onFinish?.({ success: true, result: { url: event.url, domain: event.domain } })
      return
    }

    setError({ stage: event.stage, message: event.error })
    if (Array.isArray(event.logs) && event.logs.length > 0) {
      setLogs((current) => current.concat(event.logs.map((line) => `[error] ${line}`)))
    }
    setIsRunning(false)
    onFinish?.({ success: false, error: event.error, stage: event.stage })
  }

  function parseSseBlock(block: string): DeployStreamEvent | null {
    const eventLine = block.split("\n").find((line) => line.startsWith("event:"))
    const dataLine = block.split("\n").find((line) => line.startsWith("data:"))
    if (!eventLine || !dataLine) return null
    try {
      return JSON.parse(dataLine.slice(5).trim()) as DeployStreamEvent
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

  return (
    <Dialog open={open} onOpenChange={closePanel}>
      <DialogContent
        showCloseButton={!isRunning}
        className="max-w-5xl border-zinc-800 bg-[#05070b] p-0 text-zinc-100 shadow-[0_40px_120px_rgba(0,0,0,0.65)]"
      >
        <div className="relative overflow-hidden rounded-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(66,153,225,0.18),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.03),transparent_28%)]" />
          <div className="relative flex items-start justify-between gap-4 border-b border-white/8 px-6 py-5">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-zinc-500">Deploying</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">{projectName || projectId}</h2>
              <p className="mt-1 text-sm text-zinc-400">{result?.domain || `${projectId}.sycord.site`}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={copyLogs} className="text-zinc-300 hover:bg-white/8">
                <Copy className="mr-2 h-4 w-4" />
                Copy logs
              </Button>
              <Button variant="ghost" size="sm" onClick={downloadLogs} className="text-zinc-300 hover:bg-white/8">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCollapsed((value) => !value)} className="text-zinc-300 hover:bg-white/8">
                {collapsed ? <ChevronDown className="mr-2 h-4 w-4" /> : <ChevronUp className="mr-2 h-4 w-4" />}
                {collapsed ? "Expand" : "Collapse"}
              </Button>
            </div>
          </div>

          <div className="relative grid gap-0 lg:grid-cols-[280px_minmax(0,1fr)]">
            <div className="border-r border-white/6 bg-white/[0.02] px-5 py-5">
              <div className="space-y-3">
                {STAGES.map((stage) => {
                  const state = stageState[stage.id]
                  return (
                    <div key={stage.id} className="flex items-center gap-3 rounded-xl border border-white/6 bg-black/20 px-3 py-3">
                      <div
                        className={cn(
                          "h-2.5 w-2.5 rounded-full",
                          state === "success" && "bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]",
                          state === "running" && "bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.8)]",
                          state === "error" && "bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.8)]",
                          state === "pending" && "bg-zinc-700",
                        )}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white">{stage.label}</p>
                        <p className="text-xs text-zinc-500">{state}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 rounded-2xl border border-white/6 bg-black/25 p-4">
                <p className="text-xs uppercase tracking-[0.18em] text-zinc-500">Status</p>
                <p className="mt-2 text-sm text-zinc-200">{error?.message || lastMessage}</p>
                {error?.stage && <p className="mt-2 text-xs text-red-300">Failing stage: {error.stage}</p>}
              </div>
            </div>

            {!collapsed && (
              <div className="flex min-h-[520px] flex-col">
                <div className="flex items-center justify-between border-b border-white/6 px-5 py-3 text-xs text-zinc-500">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    Live terminal
                  </div>
                  <button className="text-zinc-400 hover:text-white" onClick={() => setAutoScroll((value) => !value)}>
                    Auto-scroll: {autoScroll ? "on" : "off"}
                  </button>
                </div>
                <div ref={logViewportRef} className="flex-1 overflow-y-auto bg-[#020409] px-5 py-4 font-mono text-[12px] leading-6">
                  {logs.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-zinc-600">
                      {isRunning ? <Loader2 className="h-5 w-5 animate-spin" /> : "No logs captured"}
                    </div>
                  ) : (
                    logs.map((line, index) => (
                      <div
                        key={`${line}-${index}`}
                        className={cn(
                          "border-b border-white/[0.03] py-0.5 text-zinc-400",
                          /error|failed|exception/i.test(line) && "text-red-300",
                          /warn/i.test(line) && "text-amber-300",
                          /success|complete|ready|healthy/i.test(line) && "text-emerald-300",
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

          <div className="relative flex flex-wrap items-center justify-between gap-3 border-t border-white/8 px-6 py-4">
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
                  Deploying
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {result?.url && (
                <>
                  <Button asChild className="bg-white text-black hover:bg-zinc-200">
                    <a href={result.url} target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open website
                    </a>
                  </Button>
                  <Button variant="outline" onClick={() => navigator.clipboard.writeText(result.url)} className="border-white/10 bg-transparent text-white hover:bg-white/8">
                    <Copy className="mr-2 h-4 w-4" />
                    Copy URL
                  </Button>
                </>
              )}
              {error && (
                <>
                  <Button variant="outline" onClick={() => onOpenChange(false)} className="border-white/10 bg-transparent text-white hover:bg-white/8">
                    Close
                  </Button>
                  <Button onClick={() => setAttempt((value) => value + 1)} className="bg-red-500 text-white hover:bg-red-400">
                    Try redeploy again
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
