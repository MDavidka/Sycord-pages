"use client"

import React, { useState, useCallback, useRef, useEffect } from "react"
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Send,
  Plus,
  Copy,
  Check,
  Code2,
  Braces,
  ChevronRight,
  RefreshCw,
  Bug,
  Sparkles,
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

interface ChatMessage {
  id: string
  role: "user" | "assistant" | "stage" | "result"
  content: string
  stageStatus?: StageStatus
  stageId?: number
  retries?: number
  tsx?: string
  styleJson?: unknown
  functionJson?: unknown
}

interface SyraBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const INITIAL_STAGES: StageState[] = [
  { id: 0, name: "Validation Gate",   status: "idle", retries: 0 },
  { id: 1, name: "Architect AI",      status: "idle", retries: 0 },
  { id: 2, name: "Manifest Resolver", status: "idle", retries: 0 },
  { id: 3, name: "Developer AI",      status: "idle", retries: 0 },
  { id: 4, name: "Orchestrator",      status: "idle", retries: 0 },
  { id: 5, name: "Build Gate",        status: "idle", retries: 0 },
  { id: 6, name: "Ready",             status: "idle", retries: 0 },
]

const STAGE_DESC: Record<number, string> = {
  0: "Sanitising prompt and building whitelist",
  1: "Generating Style JSON tree via Gemini 3.1 Pro",
  2: "Loading real shadcn/ui component sources",
  3: "Generating state & handlers via Gemini 3.1 Pro",
  4: "Assembling TSX deterministically",
  5: "Running static validation and repair loop",
  6: "TSX ready to use",
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StageStatusIcon({ status }: { status: StageStatus }) {
  switch (status) {
    case "running": return <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
    case "done":    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
    case "warn":    return <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
    case "error":   return <XCircle className="h-3.5 w-3.5 text-red-400" />
    default:        return null
  }
}

function StageBubble({ msg }: { msg: ChatMessage }) {
  const isRunning = msg.stageStatus === "running"
  const isDone    = msg.stageStatus === "done" || msg.stageStatus === "warn"
  const isError   = msg.stageStatus === "error"

  return (
    <div className="flex items-center gap-2.5 py-1">
      <div className="flex h-5 w-5 shrink-0 items-center justify-center">
        <StageStatusIcon status={msg.stageStatus ?? "idle"} />
      </div>
      <span
        className={cn(
          "text-xs leading-relaxed",
          isRunning ? "text-zinc-400" :
          isDone    ? "text-zinc-500" :
          isError   ? "text-red-400"  : "text-zinc-600",
        )}
      >
        {msg.content}
        {(msg.retries ?? 0) > 0 && (
          <span className="ml-1.5 rounded-full bg-amber-400/15 px-1.5 py-0.5 text-[10px] text-amber-400">
            retry {msg.retries}
          </span>
        )}
      </span>
    </div>
  )
}

function CodeBlock({
  code,
  tab,
  onTabChange,
  styleJson,
  functionJson,
  onAddToPages,
  onRegenerate,
  addedToPages,
  isRunning,
}: {
  code: string
  tab: ResultTab
  onTabChange: (t: ResultTab) => void
  styleJson: unknown
  functionJson: unknown
  onAddToPages: () => void
  onRegenerate: () => void
  addedToPages: boolean
  isRunning: boolean
}) {
  const [copied, setCopied] = useState(false)

  const tabContent: Record<ResultTab, string> = {
    tsx:      code,
    style:    styleJson    ? JSON.stringify(styleJson,    null, 2) : "",
    function: functionJson ? JSON.stringify(functionJson, null, 2) : "",
  }

  const copy = useCallback(() => {
    navigator.clipboard.writeText(tabContent[tab]).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [tabContent, tab])

  return (
    <div className="mt-2 w-full rounded-2xl rounded-tl-md overflow-hidden border border-white/[0.08] bg-[#111113]">
      {/* Tab bar */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-1">
        <div className="flex">
          {(["tsx", "style", "function"] as ResultTab[]).map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              disabled={!tabContent[t]}
              className={cn(
                "flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-[11px] font-medium transition-colors",
                tab === t
                  ? "border-white/70 text-white"
                  : "border-transparent text-zinc-600 hover:text-zinc-300 disabled:cursor-not-allowed disabled:opacity-30",
              )}
            >
              {t === "tsx"      && <Code2        className="h-3 w-3" />}
              {t === "style"    && <Braces       className="h-3 w-3" />}
              {t === "function" && <ChevronRight className="h-3 w-3" />}
              {t === "tsx" ? "TSX" : t === "style" ? "Style JSON" : "Function JSON"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 pr-2">
          <button
            onClick={copy}
            className="flex h-6 w-6 items-center justify-center rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition-colors"
            aria-label="Copy"
          >
            {copied
              ? <Check className="h-3 w-3 text-emerald-400" />
              : <Copy className="h-3 w-3" />
            }
          </button>
        </div>
      </div>

      {/* Code */}
      <pre
        className="max-h-[360px] overflow-auto p-4 text-[11.5px] leading-relaxed text-emerald-300 font-mono custom-scrollbar"
        style={{ whiteSpace: "pre", tabSize: 2 }}
      >
        {tabContent[tab] || ""}
      </pre>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-200"
          onClick={onRegenerate}
          disabled={isRunning}
        >
          <RefreshCw className="h-3 w-3" />
          Regenerate
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1.5 text-[11px]"
          onClick={onAddToPages}
          disabled={addedToPages}
        >
          {addedToPages
            ? <><Check className="h-3 w-3" /> Added</>
            : <><Plus className="h-3 w-3" /> Add to Pages</>
          }
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function SyraBuilder({
  projectId: _projectId,
  generatedPages,
  setGeneratedPages,
}: SyraBuilderProps) {
  const [input, setInput]           = useState("")
  const [isRunning, setIsRunning]   = useState(false)
  const [messages, setMessages]     = useState<ChatMessage[]>([])
  const [stages, setStages]         = useState<StageState[]>(INITIAL_STAGES)
  const [tsx, setTsx]               = useState<string | null>(null)
  const [styleJson, setStyleJson]   = useState<unknown>(null)
  const [functionJson, setFunctionJson] = useState<unknown>(null)
  const [error, setError]           = useState<string | null>(null)
  const [resultTab, setResultTab]   = useState<ResultTab>("tsx")
  const [addedToPages, setAddedToPages] = useState(false)
  const [lastPrompt, setLastPrompt] = useState("")

  // Progress tracking
  const doneCount  = stages.filter((s) => s.status === "done" || s.status === "warn").length
  const totalStages = INITIAL_STAGES.length
  const progress    = doneCount / totalStages

  const abortRef     = useRef<AbortController | null>(null)
  const bottomRef    = useRef<HTMLDivElement>(null)
  const textareaRef  = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }

  // -------------------------------------------------------------------------
  // Update or add a stage message in the chat
  // -------------------------------------------------------------------------
  const upsertStageMessage = useCallback((stageId: number, status: StageStatus, detail?: string, retries?: number) => {
    setMessages((prev) => {
      const existing = prev.findIndex((m) => m.role === "stage" && m.stageId === stageId)
      const stage = INITIAL_STAGES[stageId]
      const content = detail ?? STAGE_DESC[stageId] ?? stage.name

      const updated: ChatMessage = {
        id: `stage-${stageId}`,
        role: "stage",
        stageId,
        stageStatus: status,
        content,
        retries: retries ?? (existing >= 0 ? (prev[existing].retries ?? 0) : 0),
      }

      if (existing >= 0) {
        const next = [...prev]
        next[existing] = updated
        return next
      }
      return [...prev, updated]
    })
  }, [])

  // -------------------------------------------------------------------------
  // SSE event handler
  // -------------------------------------------------------------------------
  const handleEvent = useCallback((event: Record<string, unknown>) => {
    switch (event.type) {
      case "stage": {
        const id     = event.id as number
        const status = event.status as StageStatus
        const detail = event.detail as string | undefined

        setStages((prev) =>
          prev.map((s) => s.id === id ? { ...s, status, detail } : s)
        )
        upsertStageMessage(id, status, detail)

        if (event.styleJson)    setStyleJson(event.styleJson)
        if (event.functionJson) setFunctionJson(event.functionJson)
        break
      }
      case "stage_retry": {
        const id = event.id as number
        setStages((prev) =>
          prev.map((s) => s.id === id ? { ...s, retries: (s.retries ?? 0) + 1 } : s)
        )
        setMessages((prev) =>
          prev.map((m) =>
            m.role === "stage" && m.stageId === id
              ? { ...m, retries: (m.retries ?? 0) + 1 }
              : m
          )
        )
        break
      }
      case "complete": {
        const completeTsx = event.tsx as string
        setTsx(completeTsx)
        if (event.styleJson)    setStyleJson(event.styleJson)
        if (event.functionJson) setFunctionJson(event.functionJson)
        break
      }
      case "error":
        setError(event.message as string)
        setIsRunning(false)
        break
    }
  }, [upsertStageMessage])

  // -------------------------------------------------------------------------
  // Run pipeline
  // -------------------------------------------------------------------------
  const runPipeline = useCallback(async (promptOverride?: string) => {
    const finalPrompt = (promptOverride ?? input).trim()
    if (!finalPrompt || isRunning) return

    abortRef.current = new AbortController()
    setIsRunning(true)
    setLastPrompt(finalPrompt)
    setStages(INITIAL_STAGES.map((s) => ({ ...s, status: "idle" as const, retries: 0, detail: undefined })))
    setTsx(null)
    setStyleJson(null)
    setFunctionJson(null)
    setError(null)
    setAddedToPages(false)
    setResultTab("tsx")

    // Add user message + clear stage messages from a prior run
    setMessages((prev) => {
      const withoutStages = prev.filter((m) => m.role !== "stage" && m.role !== "result")
      return [
        ...withoutStages,
        { id: Date.now().toString(), role: "user", content: finalPrompt },
      ]
    })

    if (!promptOverride) setInput("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }

    try {
      const response = await fetch("/api/syra/pipeline", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ prompt: finalPrompt }),
        signal:  abortRef.current.signal,
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
              handleEvent(JSON.parse(line.slice(6)))
            } catch {
              // malformed — skip
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
  }, [input, isRunning, handleEvent])

  // Inject result message once tsx arrives
  useEffect(() => {
    if (!tsx) return
    setMessages((prev) => {
      const withoutResult = prev.filter((m) => m.role !== "result")
      return [
        ...withoutResult,
        {
          id: "result",
          role: "result",
          content: "TSX generated successfully.",
          tsx,
          styleJson,
          functionJson,
        },
      ]
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tsx])

  // -------------------------------------------------------------------------
  // Add to pages
  // -------------------------------------------------------------------------
  const addToPages = useCallback(() => {
    if (!tsx) return
    const name = `SyraApp_${Date.now()}.tsx`
    const page: GeneratedPage = {
      name,
      code: tsx,
      timestamp: Date.now(),
      usedFor: `Syra — ${lastPrompt.slice(0, 60)}`,
    }
    setGeneratedPages((prev) => {
      const filtered = prev.filter((p) => !p.name.startsWith("SyraApp_"))
      return [...filtered, page]
    })
    setAddedToPages(true)
  }, [tsx, lastPrompt, setGeneratedPages])

  const isIdle = messages.length === 0

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <div className="relative flex h-full flex-col bg-[#18191B]">
      {/* Subtle background glow (matching ai-website-builder) */}
      {isIdle && (
        <>
          <div className="pointer-events-none absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl sm:h-96 sm:w-96" />
          <div className="pointer-events-none absolute bottom-1/4 right-1/4 h-64 w-64 rounded-full bg-blue-500/5 blur-3xl sm:h-96 sm:w-96" />
        </>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Scrollable chat area                                                */}
      {/* ------------------------------------------------------------------ */}
      <div
        className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pb-36"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        <div className="max-w-2xl mx-auto w-full px-3 sm:px-4 md:px-0 min-h-full flex flex-col">

          {/* IDLE */}
          {isIdle && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                <Sparkles className="h-7 w-7 text-zinc-400" />
              </div>
              <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-white">
                Syra Builder
              </h1>
              <p className="mt-2 text-zinc-500 text-sm max-w-xs leading-relaxed">
                Describe a UI component. The 6-stage pipeline will generate validated, production-ready TSX.
              </p>
            </div>
          )}

          {/* CHAT */}
          {!isIdle && (
            <div className="flex flex-col pt-8 pb-4">
              {messages.map((msg) => {

                /* User bubble */
                if (msg.role === "user") return (
                  <div key={msg.id} className="py-2 flex flex-col items-end">
                    <div className="max-w-[88%] sm:max-w-[82%] px-4 py-2.5 rounded-2xl rounded-br-md bg-white/[0.10] backdrop-blur-sm">
                      <p className="text-sm leading-relaxed text-zinc-100">{msg.content}</p>
                    </div>
                  </div>
                )

                /* Stage bubble */
                if (msg.role === "stage") return (
                  <div key={msg.id} className="py-0.5 flex flex-col items-start">
                    <StageBubble msg={msg} />
                  </div>
                )

                /* Result bubble */
                if (msg.role === "result" && msg.tsx) return (
                  <div key={msg.id} className="py-2 flex flex-col items-start">
                    <div className="w-full max-w-[92%]">
                      <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/[0.06] inline-block mb-1">
                        <p className="text-sm leading-relaxed text-zinc-300">
                          Done. Your component is ready below.
                        </p>
                      </div>
                      <CodeBlock
                        code={msg.tsx}
                        tab={resultTab}
                        onTabChange={setResultTab}
                        styleJson={msg.styleJson}
                        functionJson={msg.functionJson}
                        onAddToPages={addToPages}
                        onRegenerate={() => runPipeline(lastPrompt)}
                        addedToPages={addedToPages}
                        isRunning={isRunning}
                      />
                    </div>
                  </div>
                )

                /* Assistant bubble (fallback) */
                return (
                  <div key={msg.id} className="py-2 flex flex-col items-start">
                    <div className="max-w-[88%] sm:max-w-[82%] px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/[0.06]">
                      <p className="text-sm leading-relaxed text-zinc-300">{msg.content}</p>
                    </div>
                  </div>
                )
              })}

              {/* Error */}
              {error && (
                <div className="mt-3 flex items-start gap-2.5">
                  <Bug className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                  <div>
                    <p className="text-sm text-red-400">{error}</p>
                    <button
                      onClick={() => setError(null)}
                      className="mt-1 text-xs text-red-500/60 hover:text-red-400 underline underline-offset-2"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {/* Added-to-pages confirmation */}
              {addedToPages && (
                <div className="mt-3 flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <p className="text-xs text-zinc-500">
                    Component added to Pages. Go to the Pages tab to preview and deploy.
                  </p>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Input bar — fixed at bottom, matching ai-website-builder style     */}
      {/* ------------------------------------------------------------------ */}
      <div className="absolute bottom-0 left-0 right-0 z-20 w-full">
        <div className="max-w-2xl mx-auto w-full px-3 sm:px-4 pb-4 sm:pb-6 md:pb-8">

          {/* Progress bar — shown while running */}
          {isRunning && (
            <div className="mb-2 px-1">
              <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-white/40 transition-all duration-700"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
                <span>
                  {stages.find((s) => s.status === "running")?.name ?? "Running…"}
                </span>
                <span>{doneCount} / {totalStages}</span>
              </div>
            </div>
          )}

          {/* Input box */}
          <div
            className={cn(
              "rounded-2xl border border-white/[0.08] bg-[#1c1c1e]/80 backdrop-blur-xl transition-all duration-300 shadow-2xl",
              isRunning ? "opacity-70 pointer-events-none" : "",
            )}
          >
            <div className="p-2.5 sm:p-3 flex flex-col gap-1.5">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    runPipeline()
                  }
                }}
                placeholder="Describe the component you want to build…"
                disabled={isRunning}
                className="w-full resize-none bg-transparent border-none outline-none px-2 pt-1 text-sm text-zinc-200 placeholder:text-zinc-600"
                style={{ minHeight: "36px", maxHeight: "120px", overflow: "auto" }}
                rows={1}
              />

              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] text-zinc-600">
                  {isRunning ? "Running pipeline…" : "Enter to send, Shift+Enter for new line"}
                </span>
                <Button
                  onClick={() => runPipeline()}
                  disabled={isRunning || input.trim().length < 5}
                  aria-label="Run pipeline"
                  className={cn(
                    "h-8 w-8 rounded-lg p-0 transition-all active:scale-95 shrink-0 shadow-none",
                    input.trim().length >= 5 && !isRunning
                      ? "bg-white text-black hover:bg-zinc-200"
                      : "bg-zinc-800/50 text-zinc-700",
                  )}
                >
                  {isRunning
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-700" />
                    : <Send className="h-3.5 w-3.5" />
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
