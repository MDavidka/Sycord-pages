"use client"

import React, { useState, useRef, useEffect } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BEST_COST_PER_FILE, FAST_COST_PER_FILE, tierOf, formatCredits, type ModelTier } from "@/lib/credits"

// Model type for the chooser
interface ModelOption {
  id: string
  name: string
  provider: string
  fast?: boolean
}

// Default to highest-quality Gemini; only three curated options are exposed.
const DEFAULT_MODEL_ID = "grok-4-1-fast-non-reasoning"

const MODELS: ModelOption[] = [
  { id: "grok-4-1-fast-non-reasoning", name: "Grok 4.1 Fast", provider: "xAI", fast: true },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B Free", provider: "OpenRouter" },
  { id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash (Fast)", provider: "Google", fast: true },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview (Smart)", provider: "Google" },
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
          {/* Attachment chips (if any) */}
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
            placeholder="Describe the website you want"
            disabled={disabled}
            autoFocus={!disabled}
            className="text-sm sm:text-base text-zinc-200 placeholder:text-zinc-600 resize-none bg-transparent border-none outline-none px-2 pt-1 min-h-[36px] w-full"
            style={{
              minHeight: '36px',
              maxHeight: '120px',
              overflow: 'auto'
            }}
          />

          <div className="flex items-center justify-between gap-1.5 sm:gap-2 px-0.5">
            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 flex-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  handleFiles(e.target.files)
                  if (fileInputRef.current) fileInputRef.current.value = ""
                }}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => fileInputRef.current?.click()}
                disabled={disabled}
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full p-0 text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] shrink-0"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-7 sm:h-8 text-[10px] sm:text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.06] px-2 sm:px-2.5 gap-1 sm:gap-1.5 min-w-0 rounded-full"
                    disabled={disabled}
                  >
                    {selectedTier === "fast"
                      ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
                      : <Gem className="h-3 w-3 text-violet-400 shrink-0" />
                    }
                    <span className="max-w-[80px] sm:max-w-[140px] truncate">{selectedModel.name}</span>
                    <span
                      className={cn(
                        "hidden sm:inline-flex items-center h-4 px-1.5 rounded-full text-[9px] font-bold uppercase tracking-wide tabular-nums",
                        selectedTier === "fast"
                          ? "bg-yellow-400/10 text-yellow-300"
                          : "bg-violet-400/10 text-violet-300"
                      )}
                    >
                      −{formatCredits(selectedCost)}/file
                    </span>
                    <ChevronDown className="h-3 w-3 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="bg-[#1c1c1c]/95 backdrop-blur-xl border border-white/10 min-w-[280px] rounded-2xl p-2 shadow-2xl"
                >
                  <div className="px-2.5 pt-1 pb-2 text-[10px] text-zinc-500 leading-relaxed border-b border-white/10 mb-1.5">
                    Planning always runs on <span className="text-zinc-300">Gemini 3.1 Flash-Lite</span> for fast reasoning. Pick Gemini Pro for quality or Flash for speed when generating code.
                  </div>
                  {bestModels.length > 0 && (
                    <>
                      <div className="px-2.5 pt-1.5 pb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300/90">
                        <Gem className="h-3 w-3" />
                        Best
                        <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-zinc-500">
                          −{formatCredits(bestCost)}/file
                        </span>
                      </div>
                      {bestModels.map(m => (
                        <ModelRow
                          key={m.id}
                          model={m}
                          selected={selectedModel.id === m.id}
                          onSelect={() => setSelectedModel(m)}
                          tier="best"
                        />
                      ))}
                    </>
                  )}
                  {fastModels.length > 0 && (
                    <>
                      <div className="px-2.5 pt-2.5 pb-1.5 mt-1 border-t border-white/10 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-yellow-300/90">
                        <Zap className="h-3 w-3" />
                        Fast
                        <span className="ml-auto text-[10px] font-medium normal-case tracking-normal text-zinc-500">
                          −{formatCredits(fastCost)}/file
                        </span>
                      </div>
                      {fastModels.map(m => (
                        <ModelRow
                          key={m.id}
                          model={m}
                          selected={selectedModel.id === m.id}
                          onSelect={() => setSelectedModel(m)}
                          tier="fast"
                        />
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Credits chip */}
            {credits !== null && (
              <div
                className={cn(
                  "hidden sm:inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold tabular-nums shrink-0",
                  insufficient ? "bg-rose-500/10 text-rose-300" : "bg-white/[0.04] text-zinc-400"
                )}
                title={`${formatCredits(credits)} credits remaining`}
              >
                <Coins className="h-3 w-3" />
                {formatCredits(credits)}
              </div>
            )}

            <Button
              onClick={onSend}
              className={cn(
                "h-8 w-8 sm:h-9 sm:w-9 transition-all active:scale-95 shrink-0 shadow-none rounded-lg p-0",
                input.trim() && !disabled && !insufficient
                  ? "bg-white text-black hover:bg-zinc-200"
                  : "bg-zinc-800/50 text-zinc-700"
              )}
              disabled={!input.trim() || disabled || insufficient}
            >
              {disabled
                ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-zinc-700" />
                : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ModelRow = ({
  model,
  selected,
  onSelect,
  tier,
}: {
  model: ModelOption
  selected: boolean
  onSelect: () => void
  tier: ModelTier
}) => (
  <DropdownMenuItem
    onClick={onSelect}
    className={cn(
      "text-xs rounded-xl px-2.5 py-2 flex items-center gap-2.5 border transition-all",
      selected
        ? "text-white bg-white/[0.10] border-white/20 shadow-[0_0_0_1px_rgba(255,255,255,0.12)_inset]"
        : "text-zinc-300 border-transparent hover:bg-white/[0.05] hover:border-white/10"
    )}
  >
    {tier === "fast"
      ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" />
      : <Gem className="h-3 w-3 text-violet-400 shrink-0" />
    }
    <span className="flex-1 min-w-0 truncate">{model.name}</span>
    <span className="text-[10px] text-zinc-500 shrink-0 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">
      {model.provider}
    </span>
    {selected && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
  </DropdownMenuItem>
)

interface AIWebsiteBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
}

const AIWebsiteBuilder = ({ projectId, generatedPages, setGeneratedPages }: AIWebsiteBuilderProps) => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(' ')[0] || "there"

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentPipelineStep, setCurrentPipelineStep] = useState<string>("Planning")

  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [bestCost, setBestCost] = useState<number>(BEST_COST_PER_FILE)
  const [fastCost, setFastCost] = useState<number>(FAST_COST_PER_FILE)

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
      } catch { }
    }
    loadCredits()
    return () => { cancelled = true }
  }, [])

  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'like' | 'dislike' | 'report' | null>>({})

  const giveFeedback = (msgId: string, kind: 'like' | 'dislike' | 'report') => {
    setMessageFeedback(prev => ({
      ...prev,
      [msgId]: prev[msgId] === kind ? null : kind,
    }))
  }

  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messages.length > 0) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, isLoading])

  useEffect(() => {
    if (!isLoading) return
    const steps = [
      "Planning",
      "Manifest",
      "Component Context",
      "Scaffold",
      "Generating Page JSON",
      "Validating JSON",
      "Converting to Files",
      "Building",
    ]
    let idx = 0
    setCurrentPipelineStep(steps[idx])
    const timer = setInterval(() => {
      idx = (idx + 1) % steps.length
      setCurrentPipelineStep(steps[idx])
    }, 1200)
    return () => clearInterval(timer)
  }, [isLoading])

  const startGeneration = async () => {
    if (!input.trim() || isLoading) return

    const attachmentNote = attachments.length > 0
      ? `\n\n[Attached files: ${attachments.map(f => f.name).join(", ")}]`
      : ""

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input + attachmentNote,
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setAttachments([])
    setError(null)
    setIsLoading(true)

    try {
      const res = await fetch('/api/ai/generate-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: input + attachmentNote, model: selectedModel, projectId }),
      })

      const data = await res.json()

      if (Array.isArray(data?.files)) {
        const nextPages: GeneratedPage[] = data.files
          .filter((f: { path?: string; content?: string }) => typeof f?.path === "string" && typeof f?.content === "string")
          .map((f: { path: string; content: string }) => ({
            name: f.path,
            code: f.content,
            timestamp: Date.now(),
            usedFor: "ai-builder",
          }))
        if (nextPages.length > 0) {
          setGeneratedPages(nextPages)
        }
      }

      const assistantMessages: Message[] = []
      assistantMessages.push({
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.message || "Website generation finished.",
      })

      const summaryLines: string[] = []
      const pageCount = Array.isArray(data?.manifest?.pages) ? data.manifest.pages.length : 0
      const fileCount = Array.isArray(data?.files) ? data.files.length : 0
      if (pageCount > 0) summaryLines.push(`Pages: ${pageCount}`)
      if (fileCount > 0) summaryLines.push(`Files: ${fileCount}`)
      if (typeof data?.savedPages === "number" && data.savedPages > 0) {
        summaryLines.push(`Saved to project: ${data.savedPages}`)
      }
      if (data?.manifest?.theme?.preset) summaryLines.push(`Theme: ${data.manifest.theme.preset}`)
      if (typeof data?.qualityScore === "number") summaryLines.push(`Quality: ${data.qualityScore}/100`)
      const buildOk = Boolean(data?.build?.ok)
      const buildErrors: string[] = Array.isArray(data?.build?.errors) ? data.build.errors : []
      const buildWarnings: string[] = Array.isArray(data?.build?.warnings) ? data.build.warnings : []
      summaryLines.push(`Build: ${buildOk ? "passed" : `failed (${buildErrors.length} issue${buildErrors.length === 1 ? "" : "s"})`}`)
      if (buildWarnings.length > 0) summaryLines.push(`Warnings: ${buildWarnings.length}`)

      if (summaryLines.length > 0) {
        assistantMessages.push({
          id: (Date.now() + 11).toString(),
          role: "assistant",
          content: summaryLines.map((l) => `• ${l}`).join("\n"),
        })
      }

      if (!buildOk && buildErrors.length > 0) {
        assistantMessages.push({
          id: (Date.now() + 12).toString(),
          role: "assistant",
          isErrorLog: true,
          content: `Build validation failed:\n${buildErrors.slice(0, 6).map((e) => `• ${e}`).join("\n")}`,
        })
      } else if (buildWarnings.length > 0) {
        assistantMessages.push({
          id: (Date.now() + 13).toString(),
          role: "assistant",
          content: `Notes:\n${buildWarnings.slice(0, 5).map((w) => `• ${w}`).join("\n")}`,
        })
      }

      if (Array.isArray(data?.logs) && data.logs.length > 0) {
        const progressText = data.logs
          .map((log: { step?: string; detail?: string }) => `• ${log.detail || log.step || "Pipeline step completed"}`)
          .join("\n")

        assistantMessages.push({
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: `Pipeline execution:\n${progressText}`,
        })
      }

      setMessages(prev => [...prev, ...assistantMessages])
    } catch (err: any) {
      setError(err.message || "Failed to send message")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
        {messages.length === 0 && (
            <>
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            </>
        )}

        <div
            className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pb-28 sm:pb-32"
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
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
                            .filter(m => m.role === 'user' || (m.role === 'assistant' && !m.plan && !m.isIntermediate))
                            .map((msg, i) => (
                                <div
                                    key={msg.id || i}
                                    className={cn(
                                        "py-2 sm:py-2.5 flex flex-col",
                                        msg.role === 'user' ? "items-end" : "items-start"
                                    )}
                                >
                                    {msg.role === 'user' ? (
                                        <div className="max-w-[88%] sm:max-w-[82%] px-4 py-2.5 rounded-2xl rounded-br-md bg-white/[0.10] backdrop-blur-sm">
                                            <p className="text-sm leading-relaxed text-zinc-100">{msg.content}</p>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="max-w-[88%] sm:max-w-[82%] px-4 py-2.5 rounded-2xl rounded-br-md bg-white/[0.06] border border-white/[0.06]">
                                                <p className="text-sm leading-relaxed text-zinc-300">{msg.content}</p>
                                            </div>
                                            <div className="flex items-center gap-2 mt-1.5 ml-1">
                                                <Button
                                                    onClick={() => giveFeedback(msg.id, 'like')}
                                                    className={cn(
                                                        "h-6 w-6 min-w-0 p-0 rounded-full",
                                                        messageFeedback[msg.id] === 'like'
                                                            ? "text-zinc-200"
                                                            : "text-zinc-700 hover:text-zinc-400"
                                                    )}
                                                >
                                                    <ThumbsUp className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    onClick={() => giveFeedback(msg.id, 'dislike')}
                                                    className={cn(
                                                        "h-6 w-6 min-w-0 p-0 rounded-full",
                                                        messageFeedback[msg.id] === 'dislike'
                                                            ? "text-zinc-200"
                                                            : "text-zinc-700 hover:text-zinc-400"
                                                    )}
                                                >
                                                    <ThumbsDown className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button
                                                    onClick={() => giveFeedback(msg.id, 'report')}
                                                    className={cn(
                                                        "h-6 w-6 min-w-0 p-0 rounded-full",
                                                        messageFeedback[msg.id] === 'report'
                                                            ? "text-red-400"
                                                            : "text-zinc-700 hover:text-zinc-400"
                                                    )}
                                                >
                                                    <Flag className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))
                        }
                        {isLoading && (
                             <div className="py-2 sm:py-2.5 flex flex-col items-start">
                                <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/[0.06] border border-white/[0.06] max-w-[88%] sm:max-w-[82%]">
                                    <div className="flex items-center gap-1">
                                    <div className="w-2 h-2 rounded-full bg-zinc-400 thinking-dot-1" />
                                    <div className="w-2 h-2 rounded-full bg-zinc-400 thinking-dot-2" />
                                    <div className="w-2 h-2 rounded-full bg-zinc-400 thinking-dot-3" />
                                    </div>
                                    <span className="text-xs text-zinc-500 ml-1">{currentPipelineStep}...</span>
                                </div>
                            </div>
                        )}
                        <div ref={chatBottomRef} />
                    </div>
                )}
            </div>
        </div>

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
                    <div className="flex items-center gap-3">
                        <Button
                            className="text-xs text-amber-200/80 hover:text-white h-auto p-0 min-w-0"
                            onClick={() => setError(null)}
                        >
                            Dismiss
                        </Button>
                    </div>
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
            />
        </div>
    </div>
  )
}

export default AIWebsiteBuilder
