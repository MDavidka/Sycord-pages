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
  Bug,
  Send,
  Zap,
  ThumbsUp,
  ThumbsDown,
  Flag,
  Plus,
  Paperclip,
  X,
  Coins,
  Gem,
  Rocket,
  FileText,
  Layout,
  Palette,
  Code2,
  RefreshCw,
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

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  code?: string
  plan?: string
  pageName?: string
  isIntermediate?: boolean
  isErrorLog?: boolean
}

export interface GeneratedPage {
  name: string
  code: string
  timestamp: number
  usedFor?: string
}

interface PipelineStep {
  stage: string
  label: string
  status: "pending" | "running" | "done" | "error"
}

interface PipelineProgress {
  currentStep: string
  detail: string
  overallProgress: number
  steps: PipelineStep[]
  stage: string
}

const STEPS_DEFAULT: PipelineStep[] = [
  { stage: "prompt-check", label: "Analyzing Prompt", status: "pending" },
  { stage: "manifest-gen", label: "Generating Layout", status: "pending" },
  { stage: "scaffold", label: "Scaffolding Files", status: "pending" },
  { stage: "compile-sections", label: "Compiling Sections", status: "pending" },
]

const InputBar = ({
  input, setInput, onSend, disabled,
  selectedModel, setSelectedModel,
  attachments, setAttachments,
  credits, bestCost, fastCost,
  hasExistingFiles,
}: {
  input: string; setInput: (v: string) => void; onSend: () => void; disabled: boolean
  selectedModel: ModelOption; setSelectedModel: (m: ModelOption) => void
  attachments: File[]; setAttachments: React.Dispatch<React.SetStateAction<File[]>>
  credits: number | null; bestCost: number; fastCost: number
  hasExistingFiles: boolean
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedTier: ModelTier = tierOf(selectedModel)
  const selectedCost = selectedTier === "best" ? bestCost : fastCost

  const bestModels = MODELS.filter(m => tierOf(m) === "best")
  const fastModels = MODELS.filter(m => tierOf(m) === "fast")

  const insufficient = typeof credits === "number" && credits < selectedCost

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return
    setAttachments(prev => {
      const next = [...prev]
      for (let i = 0; i < files.length && next.length < 5; i++) {
        const f = files[i]
        if (f.size <= 10 * 1024 * 1024) next.push(f)
      }
      return next
    })
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6 md:pb-10 z-50 fixed bottom-0 left-0 right-0 md:static">
      <div
        className={cn(
          "frosted-input rounded-2xl transition-all duration-300",
          disabled ? "opacity-70 pointer-events-none" : ""
        )}
      >
        <div className="p-2.5 sm:p-3 flex flex-col gap-1.5">
          {attachments.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap px-0.5 pb-0.5">
              {attachments.map((f, i) => (
                <div
                  key={i}
                  className="h-6 pl-2 pr-1 rounded-full bg-white/[0.06] border border-white/[0.08] flex items-center gap-1.5 text-[11px] text-zinc-300 max-w-[180px]"
                >
                  <Paperclip className="h-3 w-3 text-zinc-500 shrink-0" />
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                    className="h-4 w-4 rounded-full flex items-center justify-center text-zinc-500 hover:text-zinc-200 hover:bg-white/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend() }
            }}
            placeholder={hasExistingFiles ? "What would you like to change?" : "Describe the website you want"}
            disabled={disabled}
            autoFocus={!disabled}
            className="text-sm sm:text-base text-zinc-200 placeholder:text-zinc-600 resize-none bg-transparent border-none outline-none px-2 pt-1 min-h-[36px] w-full"
            style={{ minHeight: "36px", maxHeight: "120px", overflow: "auto" }}
          />

          <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-0.5">
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); if (fileInputRef.current) fileInputRef.current.value = "" }} />
              <Button type="button" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={disabled} className="h-7 w-7 sm:h-8 sm:w-8 rounded-full p-0 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] shrink-0">
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-7 sm:h-8 text-[10px] sm:text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] px-1.5 sm:px-2.5 gap-1 sm:gap-1.5 min-w-0 rounded-full" disabled={disabled}>
                    {selectedTier === "fast" ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" /> : <Gem className="h-3 w-3 text-violet-400 shrink-0" />}
                    <span className="hidden sm:inline max-w-[140px] truncate">{selectedModel.name}</span>
                    <span className="sm:hidden max-w-[60px] truncate text-[10px]">
                      {selectedModel.id.startsWith("gemini") ? "Gemini" : selectedModel.id.startsWith("grok") ? "Grok" : selectedModel.id.startsWith("deepseek") ? "DeepSeek" : selectedModel.name}
                    </span>
                    <span className={cn("hidden sm:inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide tabular-nums", selectedTier === "fast" ? "bg-yellow-400/10 text-yellow-300" : "bg-violet-400/10 text-violet-300")}>
                      −{formatCredits(selectedCost)}
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top" className="bg-[#1c1c1c]/95 backdrop-blur-xl border border-white/10 w-[calc(100vw-2rem)] max-w-[320px] sm:min-w-[280px] sm:w-auto rounded-2xl p-2 shadow-2xl max-h-[70vh] overflow-y-auto">
                  <div className="px-2.5 pt-1 pb-2 text-[10px] text-zinc-500 leading-relaxed border-b border-white/10 mb-1.5">
                    Select model for planning and generation
                  </div>
                  {bestModels.length > 0 && (
                    <>
                      <div className="px-2.5 pt-1.5 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300/90">
                        <Gem className="h-3 w-3" /> Best
                        <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-zinc-500">−{formatCredits(bestCost)}</span>
                      </div>
                      {bestModels.map(m => (
                        <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="best" />
                      ))}
                    </>
                  )}
                  {fastModels.length > 0 && (
                    <>
                      <div className="px-2.5 pt-2.5 pb-1.5 mt-1 border-t border-white/10 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-300/90">
                        <Zap className="h-3 w-3" /> Fast
                        <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-zinc-500">−{formatCredits(fastCost)}</span>
                      </div>
                      {fastModels.map(m => (
                        <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="fast" />
                      ))}
                    </>
                  )}
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
  <DropdownMenuItem onClick={onSelect} className={cn("text-xs rounded-xl px-2.5 py-2 flex items-center gap-2.5 border transition-all", selected ? "text-white bg-white/[0.10] border-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]" : "text-zinc-300 border-transparent hover:bg-white/[0.05] hover:border-white/10")}>
    {tier === "fast" ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" /> : <Gem className="h-3 w-3 text-violet-400 shrink-0" />}
    <span className="flex-1 min-w-0 truncate">{model.name}</span>
    <span className="text-[10px] text-zinc-500 shrink-0 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">{model.provider}</span>
    {selected && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
  </DropdownMenuItem>
)

interface AIWebsiteBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
  onDeploy?: () => void
}

const AIWebsiteBuilder = ({ projectId, generatedPages, setGeneratedPages, onDeploy }: AIWebsiteBuilderProps) => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"

  const [messages, setMessages] = useState<Message[]>([])
  const [conversationHistory, setConversationHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [bestCost, setBestCost] = useState<number>(BEST_COST_PER_FILE)
  const [fastCost, setFastCost] = useState<number>(FAST_COST_PER_FILE)

  const [progress, setProgress] = useState<PipelineProgress>({
    currentStep: "", detail: "", overallProgress: 0, steps: [...STEPS_DEFAULT], stage: ""
  })
  const [existingManifest, setExistingManifest] = useState<unknown>(null)
  const [existingFiles, setExistingFiles] = useState<Array<{ path: string; content: string }>>([])

  const [isGenerationComplete, setIsGenerationComplete] = useState(false)
  const [messageFeedback, setMessageFeedback] = useState<Record<string, "like" | "dislike" | "report" | null>>({})

  const chatBottomRef = useRef<HTMLDivElement>(null)
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
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length, isLoading, progress])

  const giveFeedback = (msgId: string, kind: "like" | "dislike" | "report") => {
    setMessageFeedback(prev => ({ ...prev, [msgId]: prev[msgId] === kind ? null : kind }))
  }

  const handleStreamingResponse = useCallback(async (prompt: string, isRefinement = false) => {
    const abortController = new AbortController()
    abortRef.current = abortController

    const endpoint = isRefinement
      ? "/api/ai/generate-website/refine"
      : "/api/syra/generate/stream"

    const bodyPayload: Record<string, unknown> = isRefinement
      ? {
          prompt,
          model: selectedModel,
          projectId,
          existingFiles,
          existingManifest,
          conversationHistory: [
            ...conversationHistory,
            { role: "user" as const, content: prompt },
          ],
        }
      : {
          prompt,
          model: selectedModel,
          projectId,
          quality: "best",
        }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        signal: abortController.signal,
      })

      if (!isRefinement && res.headers.get("content-type")?.includes("text/event-stream")) {
        // SSE streaming response
        const reader = res.body?.getReader()
        if (!reader) throw new Error("No response body")

        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          let currentEvent = ""
          for (const line of lines) {
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim()
            } else if (line.startsWith("data: ")) {
              const dataStr = line.slice(6)
              try {
                const data = JSON.parse(dataStr)
                handleSSEEvent(currentEvent, data)
              } catch { /* skip malformed JSON */ }
              currentEvent = ""
            }
          }
        }
      } else {
        // Regular JSON response (refinement endpoint or fallback)
        const data = await res.json()
        handleGenerationResult(data)
      }
    } catch (err: unknown) {
      if ((err as Error)?.name === "AbortError") return
      setError((err as Error)?.message || "Failed to send message")
    } finally {
      setIsLoading(false)
      abortRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModel, projectId, existingFiles, existingManifest, conversationHistory])

  const handleSSEEvent = useCallback((event: string, data: unknown) => {
    const evt = data as {
      type: string; stage?: string; status?: string; progress?: number;
      detail?: string; sectionId?: string; sectionIndex?: number;
      sectionsTotal?: number; filePath?: string;
      manifest?: unknown; files?: unknown[]; error?: string; clarifyQuestion?: string;
    }

    if (evt.error) { setError(evt.error); return }

    // Handle clarification request
    if (evt.type === "clarify" && evt.clarifyQuestion) {
      setIsLoading(false)
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: evt.clarifyQuestion!,
      }])
      setProgress(prev => ({
        ...prev,
        detail: "Waiting for more details...",
        steps: prev.steps.map(s => ({ ...s, status: "done" as const })),
      }))
      return
    }

    switch (evt.type) {
      case "step": {
        setProgress(prev => {
          const steps = prev.steps.map(s => {
            if (evt.stage && s.stage === evt.stage) {
              return { ...s, status: (evt.status as PipelineStep["status"]) || s.status }
            }
            // Mark previous steps as done
            if (evt.stage && evt.status === "running" && (s.status === "pending")) {
              const stepOrder = STEPS_DEFAULT.findIndex(x => x.stage === s.stage)
              const currentOrder = STEPS_DEFAULT.findIndex(x => x.stage === evt.stage)
              if (stepOrder >= 0 && stepOrder < currentOrder) return { ...s, status: "done" as const }
            }
            return s
          })
          return {
            ...prev,
            steps,
            stage: evt.stage || prev.stage,
            detail: evt.detail || prev.detail,
            overallProgress: evt.progress ?? prev.overallProgress,
          }
        })
        break
      }
      case "section": {
        setProgress(prev => ({
          ...prev,
          detail: evt.detail || `Compiling section ${(evt.sectionIndex ?? 0) + 1}/${evt.sectionsTotal ?? 1}`,
        }))
        break
      }
      case "manifest": {
        setExistingManifest(evt.manifest || data)
        break
      }
      case "file": {
        setProgress(prev => ({ ...prev, detail: evt.detail || `Generated ${evt.filePath}` }))
        break
      }
      case "complete": {
        setProgress(prev => ({
          ...prev,
          stage: "done",
          overallProgress: 100,
          steps: prev.steps.map(s => ({ ...s, status: "done" as const })),
        }))
        handleGenerationResult(data)
        break
      }
    }
  }, [])

  const handleGenerationResult = useCallback((data: unknown) => {
    const d = data as Record<string, unknown>

    if (Array.isArray(d.files)) {
      const nextPages: GeneratedPage[] = (d.files as Array<{ path?: string; content?: string }>)
        .filter((f) => typeof f?.path === "string" && typeof f?.content === "string")
        .map((f) => ({
          name: f.path!,
          code: f.content!,
          timestamp: Date.now(),
          usedFor: "ai-builder",
        }))
      if (nextPages.length > 0) {
        setGeneratedPages(nextPages)
        setIsGenerationComplete(true)
        setExistingFiles(nextPages.map(p => ({ path: p.name, content: p.code })))
      }
    }

    if (d.manifest) {
      setExistingManifest(d.manifest)
    }

    if (Array.isArray(d.changes) && (d.changes as Array<{ summary: string }>).length > 0) {
      const changes = d.changes as Array<{ summary: string }>
      const summary = changes.map(c => `• ${c.summary}`).join("\n")
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: `Applied ${changes.length} change(s):\n${summary}`,
      }])
    } else {
      const pageCount = Array.isArray((d.manifest as Record<string, unknown>)?.pages) ? ((d.manifest as Record<string, unknown>).pages as unknown[]).length : 0
      const fileCount = Array.isArray(d.files) ? (d.files as unknown[]).length : 0
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: "assistant",
        content: [
          d.message || "Website generation complete.",
          pageCount > 0 ? `• ${pageCount} pages, ${fileCount} files` : "",
          typeof d.qualityScore === "number" ? `• Quality: ${d.qualityScore}/100` : "",
          (d.build as Record<string, unknown>)?.ok ? "• Build: passed" : "• Build: check warnings",
        ].filter(Boolean).join("\n"),
      }])
    }

    setProgress(prev => ({ ...prev, stage: "complete" }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startGeneration = useCallback(async () => {
    if (!input.trim() || isLoading) return

    const attachmentNote = attachments.length > 0
      ? `\n\n[Attached files: ${attachments.map(f => f.name).join(", ")}]`
      : ""

    const prompt = input + attachmentNote
    const isRefinement = existingFiles.length > 0 && existingManifest !== null

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input + attachmentNote,
    }

    setMessages(prev => [...prev, userMessage])
    setConversationHistory(prev => [...prev, { role: "user", content: prompt }])
    setInput("")
    setAttachments([])
    setError(null)
    setIsLoading(true)
    setProgress({ currentStep: isRefinement ? "Analyzing refinement..." : "Designing visual direction...", detail: "", pagesRendered: 0, totalPages: 0, baseFiles: 0, uiFiles: 0, stage: "designing" })

    await handleStreamingResponse(prompt, isRefinement)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, isLoading, attachments])

  const hasExistingFiles = existingFiles.length > 0

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      {messages.length === 0 && (
        <>
          <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        </>
      )}

      <div className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pb-28 sm:pb-32" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="max-w-2xl mx-auto w-full px-3 sm:px-4 md:px-0 min-h-full flex flex-col">
          {messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-16 sm:py-20 animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
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

          {messages.length > 0 && (
            <div className="flex flex-col pt-6 sm:pt-8 pb-4">
              {messages
                .filter(m => m.role === "user" || (m.role === "assistant" && !m.plan && !m.isIntermediate))
                .map((msg, i) => (
                  <div key={msg.id || i} className={cn("py-2 sm:py-2.5 flex flex-col", msg.role === "user" ? "items-end" : "items-start")}>
                    {msg.role === "user" ? (
                      <div className="max-w-[88%] sm:max-w-[82%] px-4 py-2.5 rounded-2xl rounded-br-md bg-white/[0.10] backdrop-blur-sm">
                        <p className="text-sm leading-relaxed text-zinc-100">{msg.content}</p>
                      </div>
                    ) : (
                      <>
                        <div className={cn("max-w-[88%] sm:max-w-[82%] px-4 py-2.5 rounded-2xl rounded-br-md", msg.isErrorLog ? "bg-red-500/10 border border-red-500/20" : "bg-white/[0.06] border border-white/[0.06]")}>
                          <p className={cn("text-sm leading-relaxed", msg.isErrorLog ? "text-red-300" : "text-zinc-300")}>{msg.content}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 ml-1">
                          <Button onClick={() => giveFeedback(msg.id, "like")} className={cn("h-6 w-6 min-w-0 p-0 rounded-full", messageFeedback[msg.id] === "like" ? "text-zinc-200" : "text-zinc-700 hover:text-zinc-400")}>
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button onClick={() => giveFeedback(msg.id, "dislike")} className={cn("h-6 w-6 min-w-0 p-0 rounded-full", messageFeedback[msg.id] === "dislike" ? "text-zinc-200" : "text-zinc-700 hover:text-zinc-400")}>
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </Button>
                          {hasExistingFiles && i === messages.length - 1 && messages.filter(m => m.role === "assistant" && !m.isIntermediate).length > 1 && (
                            <Button onClick={() => setInput("Refine the design by ")} className="h-6 min-w-0 p-0 px-3 rounded-full text-zinc-500 hover:text-zinc-300 text-[10px] gap-1">
                              <RefreshCw className="h-3 w-3" /> Refine
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              {isLoading && (
                <div className="py-2 sm:py-2.5 flex flex-col items-start">
                  <div className="inline-flex flex-col gap-3 px-4 py-4 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/[0.06] max-w-[90%] sm:max-w-[84%] min-w-[280px]">
                    <div className="flex items-center gap-2.5">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 rounded-full bg-zinc-400 thinking-dot-1" />
                        <div className="w-2 h-2 rounded-full bg-zinc-400 thinking-dot-2" />
                        <div className="w-2 h-2 rounded-full bg-zinc-400 thinking-dot-3" />
                      </div>
                      <span className="text-xs text-zinc-300 font-medium">Generating website...</span>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500/60 rounded-full transition-all duration-700" style={{ width: `${progress.overallProgress}%` }} />
                      </div>
                      <span className="text-[10px] text-zinc-500 tabular-nums">{progress.overallProgress}%</span>
                    </div>

                    {/* Steps */}
                    <div className="flex flex-col gap-1">
                      {progress.steps.map((step) => {
                        const icon = step.status === "done" ? "✔" : step.status === "running" ? "⚡" : step.status === "error" ? "✖" : "◌"
                        const color = step.status === "done" ? "text-emerald-400" : step.status === "running" ? "text-blue-400" : step.status === "error" ? "text-red-400" : "text-zinc-600"
                        const label = step.status === "done" ? "Done" : step.status === "running" ? "Running" : "Pending"
                        return (
                          <div key={step.stage} className="flex items-center gap-2">
                            <span className={color + " text-[10px] w-3 flex-shrink-0"}>{icon}</span>
                            <span className={cn("text-[11px]", step.status === "running" ? "text-zinc-200" : step.status === "done" ? "text-zinc-400" : "text-zinc-600")}>{step.label}</span>
                            <span className={cn("text-[9px] ml-auto", step.status === "running" ? "text-blue-400/60" : step.status === "done" ? "text-emerald-400/60" : "text-zinc-700")}>{label}</span>
                          </div>
                        )
                      })}
                    </div>

                    {progress.detail && progress.stage !== "done" && (
                      <span className="text-[10px] text-zinc-500 italic border-t border-white/[0.04] pt-2">{progress.detail}</span>
                    )}
                  </div>
                </div>
              )}
              <div ref={chatBottomRef} />
            </div>
          )}
        </div>
      </div>

      {isGenerationComplete && onDeploy && generatedPages.length > 0 && (
        <div className="mx-auto w-full max-w-2xl px-3 sm:px-4 md:px-0 mb-2 relative z-20">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <div>
                <p className="text-xs uppercase tracking-wide text-emerald-300/90">Ready</p>
                <p className="text-sm text-emerald-100">{generatedPages.length} file{generatedPages.length !== 1 ? "s" : ""} generated</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={onDeploy} className="gap-2 font-medium shadow-lg shadow-emerald-500/20">
                <Rocket className="h-4 w-4" /> Deploy
              </Button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mx-auto w-full max-w-2xl px-3 sm:px-4 md:px-0 mb-2 relative z-20">
          <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
            <div className="flex items-start gap-2.5">
              <Bug className="h-4 w-4 shrink-0 text-amber-300 mt-0.5" />
              <div>
                <p className="text-xs uppercase tracking-wide text-amber-300/90">Warning</p>
                <p className="text-sm text-amber-100">{error}</p>
              </div>
            </div>
            <Button className="text-xs text-amber-200/80 hover:text-white h-auto p-0 min-w-0" onClick={() => setError(null)}>Dismiss</Button>
          </div>
        </div>
      )}

      <div className="w-full relative z-20">
        <InputBar
          input={input}
          setInput={setInput}
          onSend={startGeneration}
          disabled={isLoading}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          attachments={attachments}
          setAttachments={setAttachments}
          credits={credits}
          bestCost={bestCost}
          fastCost={fastCost}
          hasExistingFiles={hasExistingFiles}
        />
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
