"use client"

import React, { useState, useCallback, useRef } from "react"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Circle,
  Play,
  Plus,
  Copy,
  Check,
  Code2,
  Braces,
  ChevronRight,
  RefreshCw,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { type GeneratedPage } from "@/components/ai-website-builder"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StageStatus = "idle" | "running" | "done" | "warn" | "error"

interface StageState {
  id: number
  name: string
  status: StageStatus
  detail?: string
  retries: number
}

type ResultTab = "tsx" | "style" | "function"

interface SyraBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_STAGES: StageState[] = [
  { id: 0, name: "Validation Gate",  status: "idle", retries: 0 },
  { id: 1, name: "Architect AI",     status: "idle", retries: 0 },
  { id: 2, name: "Manifest Resolver",status: "idle", retries: 0 },
  { id: 3, name: "Developer AI",     status: "idle", retries: 0 },
  { id: 4, name: "Orchestrator",     status: "idle", retries: 0 },
  { id: 5, name: "Build Gate",       status: "idle", retries: 0 },
  { id: 6, name: "Ready to Deploy",  status: "idle", retries: 0 },
]

// Stage descriptions shown as subtitle
const STAGE_DESC: Record<number, string> = {
  0: "Sanitise prompt, build whitelist",
  1: "Style JSON tree from Gemini 3.1 Pro",
  2: "Load real component source files",
  3: "State & handlers from Gemini 3.1 Pro",
  4: "Deterministic TSX assembly",
  5: "Static validation + repair loop",
  6: "TSX ready — add to Pages to publish",
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "running":
      return <Loader2 className="h-4 w-4 animate-spin text-primary" />
    case "done":
      return <CheckCircle2 className="h-4 w-4 text-emerald-400" />
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-amber-400" />
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />
    default:
      return <Circle className="h-4 w-4 text-muted-foreground/40" />
  }
}

function StageItem({ stage, isLast }: { stage: StageState; isLast: boolean }) {
  return (
    <div className="flex gap-3">
      {/* Icon + connector line */}
      <div className="flex flex-col items-center">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted/30">
          <StageIcon status={stage.status} />
        </div>
        {!isLast && (
          <div
            className={cn(
              "mt-1 w-px flex-1 transition-colors duration-500",
              stage.status === "done" || stage.status === "warn"
                ? "bg-emerald-400/40"
                : "bg-border/40",
            )}
            style={{ minHeight: 20 }}
          />
        )}
      </div>

      {/* Text */}
      <div className="pb-4 pt-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "text-sm font-medium leading-none",
              stage.status === "idle" ? "text-muted-foreground/60" : "text-foreground",
            )}
          >
            {stage.name}
          </span>
          {stage.retries > 0 && (
            <span className="rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-400">
              retry {stage.retries}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground/50 leading-relaxed">
          {stage.detail ?? STAGE_DESC[stage.id]}
        </p>
      </div>
    </div>
  )
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const copy = useCallback(() => {
    navigator.clipboard.writeText(code).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="relative h-full flex flex-col">
      <button
        onClick={copy}
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md bg-muted/50 hover:bg-muted transition-colors"
        aria-label="Copy code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      <pre
        className="flex-1 overflow-auto rounded-lg bg-black/60 p-4 pr-12 text-[12px] leading-relaxed text-emerald-300 font-mono custom-scrollbar"
        style={{ whiteSpace: "pre", tabSize: 2 }}
      >
        {code}
      </pre>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SyraBuilder({
  projectId,
  generatedPages,
  setGeneratedPages,
}: SyraBuilderProps) {
  const [prompt, setPrompt]         = useState("")
  const [isRunning, setIsRunning]   = useState(false)
  const [stages, setStages]         = useState<StageState[]>(INITIAL_STAGES)
  const [tsx, setTsx]               = useState<string | null>(null)
  const [styleJson, setStyleJson]   = useState<unknown>(null)
  const [functionJson, setFunctionJson] = useState<unknown>(null)
  const [error, setError]           = useState<string | null>(null)
  const [resultTab, setResultTab]   = useState<ResultTab>("tsx")
  const [addedToPages, setAddedToPages] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // -------------------------------------------------------------------------
  // SSE event handler
  // -------------------------------------------------------------------------
  const handleEvent = useCallback((event: Record<string, unknown>) => {
    switch (event.type) {
      case "stage":
        setStages((prev) =>
          prev.map((s) =>
            s.id === event.id
              ? { ...s, status: event.status as StageStatus, detail: event.detail as string | undefined }
              : s,
          ),
        )
        if (event.styleJson)   setStyleJson(event.styleJson)
        if (event.functionJson) setFunctionJson(event.functionJson)
        break

      case "stage_retry":
        setStages((prev) =>
          prev.map((s) =>
            s.id === event.id ? { ...s, retries: (s.retries ?? 0) + 1 } : s,
          ),
        )
        break

      case "complete":
        setTsx(event.tsx as string)
        if (event.styleJson)    setStyleJson(event.styleJson)
        if (event.functionJson) setFunctionJson(event.functionJson)
        break

      case "error":
        setError(event.message as string)
        setIsRunning(false)
        break
    }
  }, [])

  // -------------------------------------------------------------------------
  // Run pipeline
  // -------------------------------------------------------------------------
  const runPipeline = useCallback(async () => {
    if (!prompt.trim() || isRunning) return

    abortRef.current = new AbortController()
    setIsRunning(true)
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: "idle" as const, retries: 0, detail: undefined })))
    setTsx(null)
    setStyleJson(null)
    setFunctionJson(null)
    setError(null)
    setAddedToPages(false)

    try {
      const response = await fetch("/api/syra/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: abortRef.current.signal,
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ message: "Pipeline failed" }))
        setError(err.message ?? "Pipeline failed")
        setIsRunning(false)
        return
      }

      const reader  = response.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const evt = JSON.parse(line.slice(6))
              handleEvent(evt)
            } catch {
              // malformed event — skip
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message)
      }
    } finally {
      setIsRunning(false)
    }
  }, [prompt, isRunning, handleEvent])

  // -------------------------------------------------------------------------
  // Add generated TSX to pages
  // -------------------------------------------------------------------------
  const addToPages = useCallback(() => {
    if (!tsx) return

    const name = `SyraApp_${Date.now()}.tsx`
    const page: GeneratedPage = {
      name,
      code: tsx,
      timestamp: Date.now(),
      usedFor: `Generated by Syra Builder — ${prompt.slice(0, 60)}`,
    }
    setGeneratedPages((prev) => {
      const filtered = prev.filter((p) => !p.name.startsWith("SyraApp_"))
      return [...filtered, page]
    })
    setAddedToPages(true)
  }, [tsx, prompt, setGeneratedPages])

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------
  const isComplete   = tsx !== null
  const hasStarted   = stages.some((s) => s.status !== "idle")
  const progressCount = stages.filter((s) => s.status === "done" || s.status === "warn").length

  const resultContent: Record<ResultTab, string> = {
    tsx:      tsx ?? "",
    style:    styleJson    ? JSON.stringify(styleJson,    null, 2) : "",
    function: functionJson ? JSON.stringify(functionJson, null, 2) : "",
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="flex h-full flex-col overflow-hidden md:flex-row">
      {/* ------------------------------------------------------------------ */}
      {/* LEFT PANEL — prompt + pipeline                                      */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex w-full flex-col border-b border-border/30 md:w-[380px] md:shrink-0 md:border-b-0 md:border-r">
        {/* Header */}
        <div className="border-b border-border/30 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
              <Braces className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold leading-none text-foreground">Syra Builder</h2>
              <p className="mt-0.5 text-[11px] text-muted-foreground">6-stage structured AI pipeline</p>
            </div>
          </div>
        </div>

        {/* Prompt area */}
        <div className="border-b border-border/30 px-5 py-4">
          <label className="mb-2 block text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Prompt
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the component you want to build…"
            disabled={isRunning}
            className="w-full resize-none rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-ring focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
            rows={4}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runPipeline()
            }}
          />
          <p className="mt-1.5 text-[11px] text-muted-foreground/50">
            Press Cmd + Enter to run
          </p>

          <Button
            onClick={runPipeline}
            disabled={isRunning || prompt.trim().length < 5}
            className="mt-3 w-full gap-2"
            size="default"
          >
            {isRunning ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running pipeline…
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Run Pipeline
              </>
            )}
          </Button>

          {/* Progress bar */}
          {hasStarted && (
            <div className="mt-3">
              <div className="mb-1 flex justify-between text-[11px] text-muted-foreground/60">
                <span>
                  {isComplete ? "Complete" : isRunning ? "Running…" : error ? "Failed" : "Idle"}
                </span>
                <span>{progressCount} / {INITIAL_STAGES.length}</span>
              </div>
              <div className="h-1 w-full overflow-hidden rounded-full bg-muted/40">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    error ? "bg-destructive" : "bg-primary",
                  )}
                  style={{ width: `${(progressCount / INITIAL_STAGES.length) * 100}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2.5">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <p className="text-xs text-destructive leading-relaxed">{error}</p>
            </div>
          )}
        </div>

        {/* Stage list */}
        <div className="flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
          <p className="mb-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/60">
            Pipeline stages
          </p>
          {stages.map((stage, i) => (
            <StageItem key={stage.id} stage={stage} isLast={i === stages.length - 1} />
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* RIGHT PANEL — result                                               */}
      {/* ------------------------------------------------------------------ */}
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Result tab bar */}
        <div className="flex shrink-0 items-center justify-between border-b border-border/30 px-4">
          <div className="flex">
            {(["tsx", "style", "function"] as ResultTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setResultTab(tab)}
                disabled={!resultContent[tab]}
                className={cn(
                  "flex items-center gap-1.5 border-b-2 px-4 py-3 text-xs font-medium transition-colors",
                  resultTab === tab
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30",
                )}
              >
                {tab === "tsx" && <Code2 className="h-3 w-3" />}
                {tab === "style" && <Braces className="h-3 w-3" />}
                {tab === "function" && <ChevronRight className="h-3 w-3" />}
                {tab === "tsx" ? "TSX" : tab === "style" ? "Style JSON" : "Function JSON"}
              </button>
            ))}
          </div>

          {/* Actions */}
          {isComplete && (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={runPipeline}
                disabled={isRunning}
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </Button>
              <Button
                size="sm"
                className="gap-1.5 text-xs"
                onClick={addToPages}
                disabled={addedToPages}
              >
                {addedToPages ? (
                  <>
                    <Check className="h-3 w-3" />
                    Added
                  </>
                ) : (
                  <>
                    <Plus className="h-3 w-3" />
                    Add to Pages
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Code / JSON preview */}
        <div className="min-h-0 flex-1 p-4">
          {resultContent[resultTab] ? (
            <CodeBlock code={resultContent[resultTab]} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              {isRunning ? (
                <>
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground/60">Pipeline running…</p>
                </>
              ) : (
                <>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border/30 bg-muted/20">
                    <Braces className="h-6 w-6 text-muted-foreground/30" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">No output yet</p>
                    <p className="mt-1 text-xs text-muted-foreground/50">
                      Enter a prompt and click Run Pipeline
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Add-to-pages confirmation */}
        {addedToPages && (
          <div className="shrink-0 border-t border-emerald-400/20 bg-emerald-400/5 px-5 py-3">
            <p className="text-xs text-emerald-400">
              Component added to Pages. Go to the Pages tab to preview and deploy.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
