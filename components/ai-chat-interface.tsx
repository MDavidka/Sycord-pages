"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Send,
  Loader2,
  Square,
  ChevronDown,
  Terminal,
  Eye,
  FileCode2,
  RotateCcw,
  // step icons
  MessageSquare,
  FolderTree,
  FileSearch,
  DatabaseZap,
  ListChecks,
  Wand2,
  ShieldCheck,
  Save,
  CheckCircle2,
  // tool icons
  FilePlus2,
  FilePen,
  Trash2,
  Boxes,
  Package,
  PackageCheck,
  Sparkles,
  Palette,
  Activity,
  Wrench,
  Circle,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  SYRA_STEPS,
  type FileChange,
  type StepStatus,
  type SyraEvent,
  type SyraPlan,
  type SyraStepKey,
} from "@/lib/syra/types"

/* Map the icon name strings emitted by the pipeline to real components. */
const ICONS: Record<string, LucideIcon> = {
  MessageSquare,
  FolderTree,
  FileSearch,
  DatabaseZap,
  ListChecks,
  Wand2,
  ShieldCheck,
  Save,
  CheckCircle2,
  FilePlus2,
  FilePen,
  Trash2,
  Boxes,
  Package,
  PackageCheck,
  Sparkles,
  Palette,
  Activity,
  Wrench,
}

function Icon({ name, className }: { name: string; className?: string }) {
  const Cmp = ICONS[name] || Wrench
  return <Cmp className={className} />
}

type Phase = "idle" | "running" | "done" | "error"

interface StepState {
  status: StepStatus
  label?: string
  detail?: string
}

interface ToolEvent {
  id: number
  tool: string
  status: StepStatus
  label: string
}

interface LogLine {
  id: number
  level: "info" | "warn" | "error"
  message: string
  ts: number
}

interface ResultState {
  success: boolean
  summary: string
  created: string[]
  modified: string[]
  deleted: string[]
  previewPath: string | null
  error?: string
}

const STATUS_RING: Record<StepStatus, string> = {
  pending: "border-white/10 text-zinc-600",
  running: "border-blue-400/60 text-blue-300 bg-blue-500/10",
  success: "border-emerald-400/50 text-emerald-300 bg-emerald-500/10",
  error: "border-red-400/50 text-red-300 bg-red-500/10",
  skipped: "border-white/10 text-zinc-600",
}

function StatusDot({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-300" />
  if (status === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
  if (status === "error") return <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
  if (status === "skipped") return <Circle className="h-3.5 w-3.5 text-zinc-600" />
  return <Circle className="h-3.5 w-3.5 text-zinc-700" />
}

function toolIconName(tool: string): string {
  switch (tool) {
    case "list_files":
    case "get_project_structure":
      return "FolderTree"
    case "read_file":
    case "read_files":
    case "get_file_map":
      return "FileSearch"
    case "write_file":
    case "write_files":
      return "FilePlus2"
    case "edit_file":
      return "FilePen"
    case "delete_file":
      return "Trash2"
    case "detect_framework":
      return "Boxes"
    case "get_package_info":
      return "Package"
    case "ensure_deployable":
      return "PackageCheck"
    case "get_icon_suggestions":
      return "Sparkles"
    case "generate_color_palette":
      return "Palette"
    case "log_action":
      return "Activity"
    default:
      return "Wrench"
  }
}

export default function AIChatInterface({ projectId }: { projectId: string }) {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"

  const [input, setInput] = useState("")
  const [phase, setPhase] = useState<Phase>("idle")
  const [steps, setSteps] = useState<Record<string, StepState>>({})
  const [tools, setTools] = useState<ToolEvent[]>([])
  const [logs, setLogs] = useState<LogLine[]>([])
  const [plan, setPlan] = useState<SyraPlan | null>(null)
  const [contextInfo, setContextInfo] = useState<{ cached: boolean; tokens?: number; detail: string } | null>(null)
  const [files, setFiles] = useState<Record<string, FileChange>>({})
  const [result, setResult] = useState<ResultState | null>(null)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<"files" | "preview">("files")
  const [showDebug, setShowDebug] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const logEndRef = useRef<HTMLDivElement | null>(null)
  const isRunning = phase === "running"

  useEffect(() => {
    if (showDebug) logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [logs, showDebug])

  const reset = useCallback(() => {
    setSteps({})
    setTools([])
    setLogs([])
    setPlan(null)
    setContextInfo(null)
    setFiles({})
    setResult(null)
    setSelectedFile(null)
    setActiveView("files")
  }, [])

  const handleEvent = useCallback((evt: SyraEvent) => {
    switch (evt.type) {
      case "step":
        setSteps((prev) => ({ ...prev, [evt.key]: { status: evt.status, label: evt.label, detail: evt.detail } }))
        break
      case "tool":
        setTools((prev) => {
          // collapse a running->done update for the same tool+label into one row
          const idx = [...prev].reverse().findIndex((t) => t.tool === evt.tool && t.status === "running")
          if (evt.status !== "running" && idx !== -1) {
            const realIdx = prev.length - 1 - idx
            const next = [...prev]
            next[realIdx] = { ...next[realIdx], status: evt.status, label: evt.label }
            return next
          }
          return [...prev, { id: evt.id, tool: evt.tool, status: evt.status, label: evt.label }].slice(-40)
        })
        break
      case "plan":
        setPlan(evt.plan)
        break
      case "context":
        setContextInfo({ cached: evt.cached, tokens: evt.tokens, detail: evt.detail })
        break
      case "file":
        setFiles((prev) => ({ ...prev, [evt.change.path]: evt.change }))
        setSelectedFile((cur) => cur ?? evt.change.path)
        break
      case "log":
        setLogs((prev) => [...prev, { id: evt.id, level: evt.level, message: evt.message, ts: Date.now() }].slice(-400))
        break
      case "result":
        setResult({
          success: evt.success,
          summary: evt.summary,
          created: evt.created,
          modified: evt.modified,
          deleted: evt.deleted,
          previewPath: evt.previewPath,
          error: evt.error,
        })
        if (evt.previewPath) setSelectedFile(evt.previewPath)
        break
    }
  }, [])

  const runGeneration = useCallback(
    async (prompt: string) => {
      reset()
      setPhase("running")
      setShowDebug(true)
      const ac = new AbortController()
      abortRef.current = ac

      try {
        const res = await fetch(`/api/projects/${projectId}/syra/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: ac.signal,
        })

        if (!res.ok || !res.body) {
          const msg = await res.text().catch(() => "")
          throw new Error(msg || `Request failed (${res.status})`)
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""
        let finished = false

        while (!finished) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const chunks = buffer.split("\n\n")
          buffer = chunks.pop() || ""
          for (const chunk of chunks) {
            const line = chunk.split("\n").find((l) => l.startsWith("data: "))
            if (!line) continue
            const payload = line.slice(6)
            if (payload === "[DONE]") {
              finished = true
              break
            }
            try {
              handleEvent(JSON.parse(payload) as SyraEvent)
            } catch {
              /* ignore malformed chunk */
            }
          }
        }
        setPhase((p) => (p === "running" ? "done" : p))
      } catch (err: any) {
        if (ac.signal.aborted) {
          setLogs((prev) => [...prev, { id: Date.now(), level: "warn", message: "Generation cancelled.", ts: Date.now() }])
          setPhase("idle")
        } else {
          setLogs((prev) => [...prev, { id: Date.now(), level: "error", message: err?.message || "Generation failed.", ts: Date.now() }])
          setPhase("error")
        }
      } finally {
        abortRef.current = null
      }
    },
    [projectId, reset, handleEvent],
  )

  const handleSend = () => {
    const prompt = input.trim()
    if (!prompt || isRunning) return
    runGeneration(prompt)
  }

  const handleStop = () => {
    abortRef.current?.abort()
  }

  const changedFiles = useMemo(() => Object.values(files), [files])
  const selected = selectedFile ? files[selectedFile] : null

  const showWorkspace = phase !== "idle"

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center px-3 sm:px-4 overflow-y-auto custom-scrollbar w-full">
        {!showWorkspace ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">Hi {userName},</h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">
                What are we building?
              </h2>
            </div>
          </div>
        ) : (
          <div className="w-full max-w-3xl mx-auto py-6 space-y-4 animate-in fade-in duration-500">
            <SummaryBar phase={phase} result={result} onReset={() => setPhase("idle")} />

            <StepRail steps={steps} />

            <ActivityFeed tools={tools} running={isRunning} />

            {plan && <PlanCard plan={plan} context={contextInfo} />}

            {changedFiles.length > 0 && (
              <FilesPanel
                files={changedFiles}
                selected={selected}
                selectedPath={selectedFile}
                onSelect={setSelectedFile}
                activeView={activeView}
                setActiveView={setActiveView}
                previewPath={result?.previewPath ?? null}
              />
            )}

            <DebugConsole logs={logs} open={showDebug} onToggle={() => setShowDebug((v) => !v)} endRef={logEndRef} />
          </div>
        )}
      </div>

      {/* Prompt input */}
      <div className="w-full pb-8 sm:pb-12 shrink-0">
        <div className="w-full max-w-2xl mx-auto px-3 sm:px-4">
          <div className="relative group">
            <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-zinc-700/50 via-zinc-600/30 to-zinc-700/50 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-end gap-2 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-2 shadow-2xl">
              <textarea
                placeholder="Describe the website you want to build..."
                className="flex-1 resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none px-3 py-2 min-h-[40px] max-h-32"
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                disabled={isRunning}
              />
              <div className="flex items-center gap-1.5 shrink-0">
                {isRunning ? (
                  <Button
                    onClick={handleStop}
                    className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg p-0 bg-red-500/90 text-white hover:bg-red-500 transition-all active:scale-95"
                    title="Stop generation"
                  >
                    <Square className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    className={cn(
                      "h-8 w-8 sm:h-9 sm:w-9 transition-all active:scale-95 shrink-0 shadow-none rounded-lg p-0",
                      input.trim() ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800/50 text-zinc-700",
                    )}
                    disabled={!input.trim()}
                  >
                    <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-center text-[10px] text-zinc-600 mt-2">
            Syra inspects your project, plans, then generates a multi-page Next.js app with shadcn/ui
            components and real backend routes. Runs on Vertex AI (gemini-3.5-flash).
          </p>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sub-components                                                      */
/* ------------------------------------------------------------------ */

function SummaryBar({ phase, result, onReset }: { phase: Phase; result: ResultState | null; onReset: () => void }) {
  const done = phase === "done" || phase === "error"
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-zinc-900/60 backdrop-blur-xl px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={cn(
            "h-8 w-8 rounded-lg grid place-items-center shrink-0",
            phase === "running" && "bg-blue-500/10 text-blue-300",
            phase === "done" && "bg-emerald-500/10 text-emerald-300",
            phase === "error" && "bg-red-500/10 text-red-300",
          )}
        >
          {phase === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : phase === "error" ? (
            <AlertTriangle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">
            {phase === "running" ? "Syra is building…" : result?.success ? "Build complete" : phase === "error" ? "Generation failed" : "Finished with notes"}
          </p>
          {result?.summary && <p className="text-xs text-zinc-500 truncate">{result.summary}</p>}
        </div>
      </div>
      {done && (
        <Button onClick={onReset} variant="ghost" className="h-8 px-2 text-xs text-zinc-400 hover:text-white shrink-0">
          <RotateCcw className="h-3.5 w-3.5 mr-1" />
          New
        </Button>
      )}
    </div>
  )
}

function StepRail({ steps }: { steps: Record<string, StepState> }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl p-2">
      <div className="flex flex-col">
        {SYRA_STEPS.map((meta, i) => {
          const state = steps[meta.key] || { status: "pending" as StepStatus }
          const isLast = i === SYRA_STEPS.length - 1
          return (
            <div key={meta.key} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg border grid place-items-center transition-colors duration-300",
                    STATUS_RING[state.status],
                  )}
                >
                  {state.status === "running" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Icon name={meta.icon} className="h-4 w-4" />
                  )}
                </div>
                {!isLast && (
                  <div
                    className={cn(
                      "w-px flex-1 my-1 transition-colors",
                      state.status === "success" ? "bg-emerald-400/30" : "bg-white/10",
                    )}
                  />
                )}
              </div>
              <div className={cn("flex-1 pb-3 pt-1.5", isLast && "pb-1")}>
                <div className="flex items-center gap-2">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      state.status === "pending" ? "text-zinc-500" : "text-white",
                      state.status === "skipped" && "text-zinc-600 line-through",
                    )}
                  >
                    {state.label || meta.title}
                  </p>
                  <StatusDot status={state.status} />
                </div>
                {state.detail && <p className="text-xs text-zinc-500 mt-0.5 truncate">{state.detail}</p>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ActivityFeed({ tools, running }: { tools: ToolEvent[]; running: boolean }) {
  if (!tools.length) return null
  const recent = tools.slice(-10)
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl p-3">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Tool activity</span>
      </div>
      <div className="space-y-1">
        {recent.map((t) => (
          <div key={t.id} className="flex items-center gap-2.5 text-sm">
            <div
              className={cn(
                "h-6 w-6 rounded-md grid place-items-center shrink-0 border",
                STATUS_RING[t.status],
              )}
            >
              {t.status === "running" ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Icon name={toolIconName(t.tool)} className="h-3 w-3" />
              )}
            </div>
            <span className={cn("truncate", t.status === "error" ? "text-red-300" : "text-zinc-300")}>{t.label}</span>
            <code className="ml-auto text-[10px] text-zinc-600 shrink-0">{t.tool}</code>
          </div>
        ))}
      </div>
    </div>
  )
}

function PlanCard({ plan, context }: { plan: SyraPlan; context: { cached: boolean; tokens?: number; detail: string } | null }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <ListChecks className="h-4 w-4 text-blue-300" />
        <span className="text-sm font-medium text-white">Plan</span>
        {context && (
          <span
            className={cn(
              "ml-auto text-[10px] px-2 py-0.5 rounded-full border",
              context.cached
                ? "border-emerald-400/30 text-emerald-300 bg-emerald-500/5"
                : "border-white/10 text-zinc-400",
            )}
            title={context.detail}
          >
            <DatabaseZap className="h-3 w-3 inline mr-1 -mt-0.5" />
            {context.cached ? `cached · ${context.tokens ?? "?"} tok` : "context inlined"}
          </span>
        )}
      </div>
      <p className="text-sm text-zinc-300 mb-3">{plan.summary}</p>
      <ol className="space-y-1.5 mb-3">
        {plan.steps.map((s, i) => (
          <li key={i} className="flex gap-2 text-xs text-zinc-400">
            <span className="text-zinc-600 tabular-nums">{i + 1}.</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      {plan.files.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {plan.files.map((f) => (
            <span key={f.path} className="text-[10px] font-mono px-2 py-1 rounded-md bg-white/5 text-zinc-400" title={f.purpose}>
              {f.path}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function kindBadge(kind: FileChange["kind"]) {
  switch (kind) {
    case "created":
      return { label: "new", cls: "text-emerald-300 bg-emerald-500/10", Icon: FilePlus2 }
    case "modified":
      return { label: "edit", cls: "text-amber-300 bg-amber-500/10", Icon: FilePen }
    case "deleted":
      return { label: "del", cls: "text-red-300 bg-red-500/10", Icon: Trash2 }
  }
}

function FilesPanel({
  files,
  selected,
  selectedPath,
  onSelect,
  activeView,
  setActiveView,
  previewPath,
}: {
  files: FileChange[]
  selected: FileChange | null
  selectedPath: string | null
  onSelect: (p: string) => void
  activeView: "files" | "preview"
  setActiveView: (v: "files" | "preview") => void
  previewPath: string | null
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl overflow-hidden">
      <div className="flex items-center gap-1 border-b border-white/[0.06] px-2 py-1.5">
        <button
          onClick={() => setActiveView("files")}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors",
            activeView === "files" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          <FileCode2 className="h-3.5 w-3.5" />
          Files
          <span className="text-[10px] text-zinc-600">{files.length}</span>
        </button>
        <button
          onClick={() => setActiveView("preview")}
          className={cn(
            "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md transition-colors",
            activeView === "preview" ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          <Eye className="h-3.5 w-3.5" />
          Preview
        </button>
      </div>

      {activeView === "files" ? (
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,200px)_1fr] max-h-[420px]">
          <div className="border-b sm:border-b-0 sm:border-r border-white/[0.06] overflow-y-auto custom-scrollbar max-h-44 sm:max-h-[420px]">
            {files.map((f) => {
              const b = kindBadge(f.kind)!
              const active = f.path === selectedPath
              return (
                <button
                  key={f.path}
                  onClick={() => onSelect(f.path)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left transition-colors border-l-2",
                    active ? "bg-white/5 border-blue-400" : "border-transparent hover:bg-white/[0.03]",
                  )}
                >
                  <span className={cn("h-5 w-5 rounded grid place-items-center shrink-0", b.cls)}>
                    <b.Icon className="h-3 w-3" />
                  </span>
                  <span className="text-xs font-mono text-zinc-300 truncate">{f.path.split("/").pop()}</span>
                  <span className="ml-auto text-[9px] uppercase text-zinc-600">{b.label}</span>
                </button>
              )
            })}
          </div>
          <div className="overflow-auto custom-scrollbar max-h-[420px] bg-black/30">
            {selected ? (
              <>
                <div className="px-3 py-1.5 border-b border-white/[0.06] text-[11px] font-mono text-zinc-500 sticky top-0 bg-zinc-900/80 backdrop-blur">
                  {selected.path}
                </div>
                <pre className="text-[11px] leading-relaxed p-3 text-zinc-300 whitespace-pre-wrap break-words">
                  <code>{selected.kind === "deleted" ? "// file deleted" : selected.content}</code>
                </pre>
              </>
            ) : (
              <div className="p-6 text-center text-xs text-zinc-600">Select a file to view its contents.</div>
            )}
          </div>
        </div>
      ) : (
        <PreviewArea files={files} previewPath={previewPath} />
      )}
    </div>
  )
}

function PreviewArea({ files, previewPath }: { files: FileChange[]; previewPath: string | null }) {
  const entry = previewPath ? files.find((f) => f.path === previewPath) : files.find((f) => /(^|\/)(page|index)\.(tsx|jsx)$/.test(f.path))
  return (
    <div className="p-4 max-h-[420px] overflow-y-auto custom-scrollbar">
      <div className="rounded-lg border border-white/10 bg-black/40 overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-white/[0.02]">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
          <span className="ml-2 text-[11px] font-mono text-zinc-500 truncate">{entry?.path || "preview"}</span>
        </div>
        {entry ? (
          <pre className="text-[11px] leading-relaxed p-3 text-zinc-300 whitespace-pre-wrap break-words max-h-72 overflow-auto custom-scrollbar">
            <code>{entry.content}</code>
          </pre>
        ) : (
          <div className="p-6 text-center text-xs text-zinc-600">No entry page to preview yet.</div>
        )}
      </div>
      <p className="text-[10px] text-zinc-600 mt-3 text-center">
        Source preview of the generated entry page. Deploy the project to publish a live, rendered site.
      </p>
    </div>
  )
}

function DebugConsole({
  logs,
  open,
  onToggle,
  endRef,
}: {
  logs: LogLine[]
  open: boolean
  onToggle: () => void
  endRef: React.RefObject<HTMLDivElement | null>
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-zinc-900/40 backdrop-blur-xl overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-white/[0.03] transition-colors">
        <Terminal className="h-3.5 w-3.5 text-zinc-500" />
        <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Debug console</span>
        <span className="text-[10px] text-zinc-600">{logs.length} lines</span>
        <ChevronDown className={cn("h-4 w-4 text-zinc-500 ml-auto transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-white/[0.06] bg-black/50 max-h-72 overflow-y-auto custom-scrollbar px-3 py-2 font-mono text-[11px] leading-relaxed">
          {logs.length === 0 ? (
            <p className="text-zinc-600 py-2">Waiting for output…</p>
          ) : (
            logs.map((l) => (
              <div key={l.id} className="flex gap-2 py-0.5">
                <span className="text-zinc-700 shrink-0 tabular-nums">
                  {new Date(l.ts).toLocaleTimeString([], { hour12: false })}
                </span>
                <span
                  className={cn(
                    "whitespace-pre-wrap break-words",
                    l.level === "error" ? "text-red-300" : l.level === "warn" ? "text-amber-300" : "text-zinc-400",
                  )}
                >
                  {l.message}
                </span>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
      )}
    </div>
  )
}
