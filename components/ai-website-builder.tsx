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
  Send,
  Zap,
  Plus,
  Paperclip,
  X,
  Coins,
  Gem,
  Terminal,
  Code2,
  LayoutGrid,
  Files,
  Box,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BEST_COST_PER_FILE, FAST_COST_PER_FILE, tierOf, formatCredits, type ModelTier } from "@/lib/credits"

// ── Types ────────────────────────────────────────────────────────

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

interface ChatMessage {
  id: string
  role: "user" | "system" | "step"
  content: string
  stepTitle?: string
  timestamp: number
}

// ── Step Icon Mapping ─────────────────────────────────────────────

const stepIcons: Record<string, React.ReactNode> = {
  "step-1": <Terminal className="h-3.5 w-3.5 text-zinc-400" />,
  "step-2": <LayoutGrid className="h-3.5 w-3.5 text-blue-400" />,
  "step-3": <Code2 className="h-3.5 w-3.5 text-emerald-400" />,
  "step-4": <Box className="h-3.5 w-3.5 text-amber-400" />,
}

// ── Chat Bubble ────────────────────────────────────────────────────

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user"
  const isStep = msg.role === "step"

  return (
    <div className={cn("flex gap-2.5 w-full", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles className="h-3.5 w-3.5 text-blue-400" />
        </div>
      )}
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-blue-500/15 border border-blue-500/20 text-blue-100"
            : isStep
              ? "bg-zinc-800/50 border border-white/5 text-zinc-300 w-full max-w-full"
              : "bg-white/5 border border-white/10 text-zinc-200",
        )}
      >
        {isStep && msg.stepTitle && (
          <div className="flex items-center gap-1.5 mb-1.5">
            {stepIcons[msg.id] || <AlertCircle className="h-3.5 w-3.5 text-zinc-500" />}
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{msg.stepTitle}</span>
          </div>
        )}
        {isStep ? (
          <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed text-zinc-400">{msg.content}</pre>
        ) : (
          <div className="whitespace-pre-wrap">{msg.content}</div>
        )}
        <div className="text-[10px] text-zinc-600 mt-1 text-right">
          {new Date(msg.timestamp).toLocaleTimeString()}
        </div>
      </div>
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-blue-300">
          You
        </div>
      )}
    </div>
  )
}

// ── Input Bar ────────────────────────────────────────────────────

const InputBar = ({
  input, setInput, onSend, disabled,
  selectedModel, setSelectedModel,
  attachments, setAttachments,
  credits, bestCost, fastCost,
  hasMessages,
}: {
  input: string; setInput: (v: string) => void; onSend: () => void; disabled: boolean
  selectedModel: ModelOption; setSelectedModel: (m: ModelOption) => void
  attachments: File[]; setAttachments: React.Dispatch<React.SetStateAction<File[]>>
  credits: number | null; bestCost: number; fastCost: number
  hasMessages: boolean
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedTier: ModelTier = tierOf(selectedModel)
  const selectedCost = selectedTier === "best" ? bestCost : fastCost
  const insufficient = credits !== null && selectedCost > credits

  return (
    <div className={cn("w-full mx-auto px-3 sm:px-4", hasMessages ? "max-w-3xl" : "max-w-2xl")}>
      <div className="relative group">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-zinc-700/50 via-zinc-600/30 to-zinc-700/50 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
        <div className="relative flex items-end gap-2 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-2 shadow-2xl">
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            <textarea
              placeholder={hasMessages ? "Describe changes or a new page..." : "Describe the website you want to build..."}
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

// ── AIWebsiteBuilder Shell ────────────────────────────────────────

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
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [bestCost, setBestCost] = useState<number>(BEST_COST_PER_FILE)
  const [fastCost, setFastCost] = useState<number>(FAST_COST_PER_FILE)

  const chatContainerRef = useRef<HTMLDivElement>(null)
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

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: Date.now(),
    }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input,
          projectId,
          modelId: selectedModel.id,
          provider: selectedModel.provider,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setMessages(prev => [...prev, {
          id: `err-${Date.now()}`,
          role: "step",
          stepTitle: "❌ API Error",
          content: `Server returned ${res.status}: ${res.statusText}`,
          timestamp: Date.now(),
        }])
        setIsLoading(false)
        setInput("")
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setIsLoading(false)
        setInput("")
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""

      const processLine = (line: string) => {
        if (!line.startsWith("event: ")) return
        const newlineIdx = line.indexOf("\n")
        const dataIdx = line.indexOf("data: ")
        if (dataIdx === -1) return

        const eventType = newlineIdx > 7 ? line.slice(7, newlineIdx).trim() : ""
        const dataStr = line.slice(dataIdx + 6)
        let data: any = {}
        try { data = JSON.parse(dataStr) } catch {}

        if (eventType === "step") {
          setMessages(prev => [...prev, {
            id: data.id || `step-${Date.now()}`,
            role: "step",
            stepTitle: data.title || "Step",
            content: data.content || "",
            timestamp: data.timestamp || Date.now(),
          }])
        } else if (eventType === "page") {
          setGeneratedPages(prev => {
            const existing = prev.find(p => p.name === data.name)
            if (existing) {
              return prev.map(p => p.name === data.name ? { ...p, code: data.code, usedFor: data.usedFor, timestamp: data.timestamp } : p)
            }
            return [...prev, { name: data.name, code: data.code, usedFor: data.usedFor, timestamp: data.timestamp }]
          })
        } else if (eventType === "error") {
          setMessages(prev => [...prev, {
            id: `err-${Date.now()}`,
            role: "step",
            stepTitle: "❌ Pipeline Error",
            content: data.message || JSON.stringify(data),
            timestamp: Date.now(),
          }])
        } else if (eventType === "done") {
          setIsLoading(false)
          setInput("")
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          processLine(line.trim())
        }
      }
      // Process remaining buffer
      if (buffer.trim()) {
        buffer.split("\n\n").forEach(b => processLine(b.trim()))
      }
    } catch (err: any) {
      if (err.name === "AbortError") return
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: "step",
        stepTitle: "❌ Network Error",
        content: err.message || "Failed to connect to build API",
        timestamp: Date.now(),
      }])
    } finally {
      setIsLoading(false)
      setInput("")
      abortRef.current = null
    }
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      {hasMessages ? (
        // Chat mode
        <div className="flex-1 flex flex-col min-h-0">
          <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3 custom-scrollbar">
            {messages.map((msg) => (
              <ChatBubble key={msg.id} msg={msg} />
            ))}
            {isLoading && (
              <div className="flex items-center gap-2 px-2">
                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                <span className="text-xs text-zinc-500">AI generating...</span>
              </div>
            )}
          </div>
          <div className="w-full pb-4 sm:pb-6 pt-2 border-t border-white/5">
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
              hasMessages={hasMessages}
            />
          </div>
        </div>
      ) : (
        // Welcome mode
        <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4">
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
                Hi {userName},
              </h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">
                What are we building?
              </h2>
            </div>
            {generatedPages.length > 0 && (
              <p className="text-sm text-zinc-500 mt-6 flex items-center gap-2">
                <Files className="h-3.5 w-3.5" />
                {generatedPages.length} previously generated file{generatedPages.length !== 1 ? "s" : ""} in this project
              </p>
            )}
          </div>

          <div className="w-full pb-8 sm:pb-12">
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
              hasMessages={hasMessages}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default AIWebsiteBuilder
