"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Loader2,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Send,
  Zap,
  Plus,
  Paperclip,
  X,
  Coins,
  Gem,
  FileText,
  AlertCircle,
  Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BEST_COST_PER_FILE, FAST_COST_PER_FILE, tierOf, formatCredits, type ModelTier } from "@/lib/credits"

interface ModelOption {
  id: string
  name: string
  provider: string
  fast?: boolean
}

const DEFAULT_MODEL_ID = "grok-4-1-fast-non-reasoning"

const MODELS: ModelOption[] = [
  { id: "grok-4-1-fast-non-reasoning", name: "Grok 4.1 Fast", provider: "xAI", fast: true },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B Free", provider: "OpenRouter" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "DeepSeek", fast: true },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "DeepSeek" },
  { id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash", provider: "Google", fast: true },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", provider: "Google" },
]

export interface GeneratedPage {
  name: string
  code: string
  timestamp: number
  usedFor?: string
}

interface DebugStep {
  id: string
  title: string
  detail: string
  status: "pending" | "running" | "done" | "error"
  timestamp: number
}

const InputBar = ({
  input, setInput, onSend, disabled,
  selectedModel, setSelectedModel,
  attachments, setAttachments,
  credits, bestCost, fastCost,
}: {
  input: string; setInput: (v: string) => void; onSend: () => void; disabled: boolean
  selectedModel: ModelOption; setSelectedModel: (m: ModelOption) => void
  attachments: File[]; setAttachments: React.Dispatch<React.SetStateAction<File[]>>
  credits: number | null; bestCost: number; fastCost: number
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedTier: ModelTier = tierOf(selectedModel)
  const selectedCost = selectedTier === "best" ? bestCost : fastCost
  const insufficient = credits !== null && selectedCost > credits

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4">
      <div className="relative group">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-zinc-700/50 via-zinc-600/30 to-zinc-700/50 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
        <div className="relative flex items-end gap-2 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-2 shadow-2xl">
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            <textarea
              placeholder="Describe the website you want to build..."
              className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none px-3 py-2 min-h-[40px] max-h-32"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend() }
              }}
              disabled={disabled}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                {attachments.map((file, i) => (
                  <div key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white/[0.06] border border-white/[0.06] rounded-full text-zinc-400">
                    {file.name.slice(0, 20)}
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="hover:text-zinc-200"><X className="h-2.5 w-2.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
              if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)])
            }} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-300 rounded-lg" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" />
            </Button>

            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg px-2 text-[11px]">
                    {selectedModel.name.slice(0, 14)}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-1.5 bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <Gem className="h-3 w-3" /> Best
                    <span className="ml-auto font-medium normal-case tracking-normal text-zinc-500">−{formatCredits(bestCost)}</span>
                  </div>
                  {MODELS.filter(m => !m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="best" />
                  ))}
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mt-1">
                    <Zap className="h-3 w-3" /> Fast
                    <span className="ml-auto font-medium normal-case tracking-normal text-zinc-500">−{formatCredits(fastCost)}</span>
                  </div>
                  {MODELS.filter(m => m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="fast" />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {credits !== null && (
              <div className={cn("hidden sm:inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold tabular-nums shrink-0", insufficient ? "bg-rose-500/10 text-rose-300" : "bg-white/[0.04] text-zinc-400")} title={`${formatCredits(credits)} credits remaining`}>
                <Coins className="h-3 w-3" /> {formatCredits(credits)}
              </div>
            )}

            <Button onClick={onSend} className={cn("h-8 w-8 sm:h-9 sm:w-9 transition-all active:scale-95 shrink-0 shadow-none rounded-lg p-0", input.trim() && !disabled && !insufficient ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800/50 text-zinc-700")} disabled={!input.trim() || disabled || insufficient}>
              {disabled ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-zinc-700" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ModelRow = ({ model, selected, onSelect, tier }: { model: ModelOption; selected: boolean; onSelect: () => void; tier: ModelTier }) => (
  <DropdownMenuItem onClick={onSelect} className={cn("text-xs rounded-xl px-2.5 py-2 flex items-center gap-2.5 border transition-all", selected ? "text-white bg-white/[0.10] border-white/20" : "text-zinc-300 border-transparent hover:bg-white/[0.05] hover:border-white/10")}>
    {tier === "fast" ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" /> : <Gem className="h-3 w-3 text-violet-400 shrink-0" />}
    <span className="flex-1 min-w-0 truncate">{model.name}</span>
    <span className="text-[10px] text-zinc-500 shrink-0 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">{model.provider}</span>
    {selected && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
  </DropdownMenuItem>
)

function parseSSEChunk(chunk: string): Array<{ event: string; data: any }> {
  const results: Array<{ event: string; data: any }> = []
  const parts = chunk.split("\n\n")
  for (const part of parts) {
    const lines = part.split("\n")
    let event = ""
    let data = ""
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7).trim()
      else if (line.startsWith("data: ")) data = line.slice(6).trim()
    }
    if (event && data) {
      try { results.push({ event, data: JSON.parse(data) }) }
      catch { /* skip malformed */ }
    }
  }
  return results
}

interface AIWebsiteBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
  onDeploy?: () => void
}

const AIWebsiteBuilder = ({ projectId, generatedPages, setGeneratedPages, onDeploy }: AIWebsiteBuilderProps) => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([])
  const [fileCount, setFileCount] = useState<{ current: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [bestCost, setBestCost] = useState<number>(BEST_COST_PER_FILE)
  const [fastCost, setFastCost] = useState<number>(FAST_COST_PER_FILE)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadCredits = async () => {
      try {
        const res = await fetch("/api/user/credits")
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        if (typeof data?.credits === "number") setCredits(data.credits)
        if (typeof data?.bestCost === "number") setBestCost(data.bestCost)
        if (typeof data?.fastCost === "number") setFastCost(data.fastCost)
      } catch { /* ignore */ }
    }
    loadCredits()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const pushStep = useCallback((step: DebugStep) => {
    setDebugSteps(prev => {
      const existingIdx = prev.findIndex(s => s.id === step.id)
      if (existingIdx >= 0) {
        const updated = [...prev]
        updated[existingIdx] = step
        if (existingIdx > 0 && prev[existingIdx - 1].status === "running") {
          updated[existingIdx - 1] = { ...updated[existingIdx - 1], status: "done" }
        }
        return updated
      }
      const newSteps = [...prev]
      if (newSteps.length > 0 && newSteps[newSteps.length - 1].status === "running") {
        newSteps[newSteps.length - 1] = { ...newSteps[newSteps.length - 1], status: "done" }
      }
      return [...newSteps, step]
    })
  }, [])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    setIsLoading(true)
    setDebugSteps([])
    setFileCount(null)
    setError(null)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input.trim(),
          projectId,
          modelId: selectedModel.id,
          provider: selectedModel.provider,
          mode: "generate",
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        pushStep({ id: "error", title: "Error", detail: `Server returned ${res.status}`, status: "error", timestamp: Date.now() })
        setError(`Server error: ${res.status}`)
        setIsLoading(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setIsLoading(false); return }

      const decoder = new TextDecoder()
      let buffer = ""
      let fileCurrent = 0
      let fileTotal = 0
      const seenFiles = new Set<string>()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const events = parseSSEChunk(buffer)
        buffer = ""

        for (const { event, data } of events) {
          if (event === "step") {
            const title = String(data.title ?? "")
            const status: DebugStep["status"] =
              title.startsWith("✅") || title.startsWith("💾") || title.startsWith("📝") || title === ""
                ? "done"
                : title.startsWith("❌") ? "error" : "running"

            pushStep({
              id: data.id || `step-${Date.now()}`,
              title: data.title || "",
              detail: data.content || "",
              status,
              timestamp: data.timestamp || Date.now(),
            })

            if (data.content && data.content.includes("files:") && fileTotal === 0) {
              const match = data.content.match(/(\d+)\s*files/)
              if (match) {
                fileTotal = parseInt(match[1])
                setFileCount({ current: 0, total: fileTotal })
              }
            }
          } else if (event === "page") {
            if (!seenFiles.has(data.name)) {
              seenFiles.add(data.name)
              fileCurrent++
              setFileCount({ current: fileCurrent, total: fileTotal || fileCurrent })
            }
            setGeneratedPages(prev => {
              const idx = prev.findIndex(p => p.name === data.name)
              const page: GeneratedPage = {
                name: data.name,
                code: data.code || "",
                timestamp: data.timestamp || Date.now(),
                usedFor: data.usedFor || "",
              }
              if (idx >= 0) {
                const copy = [...prev]
                copy[idx] = page
                return copy
              }
              return [...prev, page]
            })
          } else if (event === "error") {
            pushStep({ id: "error", title: "Error", detail: data.message || "Unknown error", status: "error", timestamp: Date.now() })
            setError(data.message || "An error occurred")
          } else if (event === "done") {
            setDebugSteps(prev => prev.map(s =>
              s.status === "running" ? { ...s, status: "done" } : s
            ))
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        pushStep({ id: "error", title: "Connection Error", detail: err.message || "Failed to connect", status: "error", timestamp: Date.now() })
        setError(err.message || "Connection failed")
      }
    } finally {
      setIsLoading(false)
      setInput("")
      setAttachments([])
    }
  }

  const isBuilding = isLoading || (debugSteps.length > 0 && debugSteps.every(s => s.status !== "done" && s.status !== "error") && debugSteps.some(s => s.status === "running"))

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center px-3 sm:px-4 overflow-y-auto custom-scrollbar">
        {!isBuilding && !isLoading && debugSteps.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
                Hi {userName},
              </h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">
                What are we building?
              </h2>
            </div>
          </div>
        )}

        {(isBuilding || isLoading || debugSteps.length > 0) && (
          <div className="flex-1 w-full max-w-2xl flex flex-col justify-center py-8">
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/70 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isBuilding || isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  ) : error ? (
                    <AlertCircle className="h-4 w-4 text-red-400" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  )}
                  <p className="text-xs uppercase tracking-wider text-zinc-400">
                    {isBuilding || isLoading ? "Building your site" : error ? "Build failed" : "Build complete"}
                  </p>
                </div>
                {fileCount && fileCount.total > 0 && (
                  <div className="flex items-center gap-1.5">
                    <FileText className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-xs text-zinc-400 tabular-nums">
                      {fileCount.current}/{fileCount.total}
                    </span>
                  </div>
                )}
              </div>

              {fileCount && fileCount.total > 0 && (
                <div className="w-full h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-violet-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${Math.min(100, (fileCount.current / fileCount.total) * 100)}%` }}
                  />
                </div>
              )}

              <div className="space-y-2">
                {debugSteps
                  .filter(s => s.id !== "error")
                  .map((step) => (
                    <div
                      key={step.id}
                      className={cn(
                        "rounded-xl border p-3 transition-all duration-300",
                        step.status === "running" && "border-blue-500/30 bg-blue-500/[0.04]",
                        step.status === "done" && "border-emerald-500/20 bg-emerald-500/[0.03]",
                        step.status === "error" && "border-red-500/20 bg-red-500/[0.03]",
                        step.status === "pending" && "border-white/[0.05] bg-white/[0.01]",
                      )}
                    >
                      <div className="flex items-start gap-2.5">
                        <div className="mt-0.5 shrink-0">
                          {step.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-400" />}
                          {step.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                          {step.status === "error" && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                          {step.status === "pending" && <Clock className="h-3.5 w-3.5 text-zinc-600" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium",
                            step.status === "running" && "text-blue-300",
                            step.status === "done" && "text-emerald-300",
                            step.status === "error" && "text-red-300",
                            step.status === "pending" && "text-zinc-500",
                          )}>
                            {step.title}
                          </p>
                          <pre className="mt-1.5 text-xs text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed">{step.detail}</pre>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {error && (
                <div className="rounded-xl border border-red-500/20 bg-red-500/[0.04] p-3">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-300">{error}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-full pb-8 sm:pb-12 shrink-0">
        <InputBar
          input={input}
          setInput={setInput}
          onSend={handleSend}
          disabled={isLoading}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          attachments={attachments}
          setAttachments={setAttachments}
          credits={credits}
          bestCost={bestCost}
          fastCost={fastCost}
        />
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
