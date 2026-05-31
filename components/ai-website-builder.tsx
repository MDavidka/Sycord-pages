"use client"

import React, { useState, useRef } from "react"
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
  Zap,
  Paperclip,
  X,
  Gem,
  Send,
  CheckCircle2,
  FileText,
  MessageSquare,
  Bot,
  User,
  ArrowRight,
  Check,
  AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

interface ConversationState {
  phase: "idle" | "asking" | "planning" | "generating" | "done"
  state: number | null
  questions: string[]
  answers: string[]
  askedCount: number
  plan: string[]
  currentStepIndex: number
  generatedFiles: Array<{ name: string; code: string; usedFor: string }>
  originalRequest: string
}

interface ChatMessage {
  id: string
  role: "ai" | "user"
  type: "text" | "question" | "plan" | "code" | "step" | "state" | "done" | "error"
  content: string
  detail?: string
  files?: Array<{ name: string; code: string; usedFor: string }>
  steps?: string[]
  state?: number
  timestamp: number
}

const ModelRow = ({ model, selected, onSelect, tier }: { model: ModelOption; selected: boolean; onSelect: () => void; tier: "best" | "fast" }) => (
  <DropdownMenuItem onClick={onSelect} className={cn("text-xs rounded-xl px-2.5 py-2 flex items-center gap-2.5 border transition-all", selected ? "text-white bg-white/[0.10] border-white/20" : "text-zinc-300 border-transparent hover:bg-white/[0.05] hover:border-white/10")}>
    {tier === "fast" ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" /> : <Gem className="h-3 w-3 text-violet-400 shrink-0" />}
    <span className="flex-1 min-w-0 truncate">{model.name}</span>
    <span className="text-[10px] text-zinc-500 shrink-0 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">{model.provider}</span>
    {selected && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
  </DropdownMenuItem>
)

const InputBar = ({
  input, setInput, onSend, disabled,
  selectedModel, setSelectedModel,
  attachments, setAttachments,
}: {
  input: string; setInput: (v: string) => void; onSend: () => void; disabled: boolean
  selectedModel: ModelOption; setSelectedModel: (m: ModelOption) => void
  attachments: File[]; setAttachments: React.Dispatch<React.SetStateAction<File[]>>
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)

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
                  </div>
                  {MODELS.filter(m => !m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="best" />
                  ))}
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mt-1">
                    <Zap className="h-3 w-3" /> Fast
                  </div>
                  {MODELS.filter(m => m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="fast" />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button onClick={onSend} className={cn("h-8 w-8 sm:h-9 sm:w-9 transition-all active:scale-95 shrink-0 shadow-none rounded-lg p-0", input.trim() && !disabled ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800/50 text-zinc-700")} disabled={!input.trim() || disabled}>
              {disabled ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-zinc-700" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const AIWebsiteBuilder = ({ projectId }: { projectId?: string }) => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationState, setConversationState] = useState<ConversationState>({
    phase: "idle",
    state: null,
    questions: [],
    answers: [],
    askedCount: 0,
    plan: [],
    currentStepIndex: 0,
    generatedFiles: [],
    originalRequest: "",
  })
  const [error, setError] = useState<string | null>(null)

  const chatRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const scrollToBottom = () => {
    setTimeout(() => {
      if (chatRef.current) {
        chatRef.current.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" })
      }
    }, 100)
  }

  const addMessage = (msg: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages(prev => [...prev, { ...msg, id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, timestamp: Date.now() }])
  }

  const resetConversation = () => {
    setMessages([])
    setConversationState({
      phase: "idle",
      state: null,
      questions: [],
      answers: [],
      askedCount: 0,
      plan: [],
      currentStepIndex: 0,
      generatedFiles: [],
      originalRequest: "",
    })
    setError(null)
  }

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userInput = input.trim()

    addMessage({ role: "user", type: "text", content: userInput })
    setInput("")
    setAttachments([])
    setIsLoading(true)
    setError(null)
    scrollToBottom()

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: userInput,
          projectId: projectId || "default",
          modelId: selectedModel.id,
          provider: selectedModel.provider,
          conversationState,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setError(`Server error: ${res.status}`)
        addMessage({ role: "ai", type: "error", content: `Server returned error ${res.status}` })
        setIsLoading(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setIsLoading(false); return }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const events = parseSSE(buffer)
        buffer = ""

        for (const { event, data } of events) {
          switch (event) {
            case "state":
              addMessage({
                role: "ai",
                type: "state",
                content: data.state === 1
                  ? "I'll help you build a new website!"
                  : data.state === 2
                  ? "Bug fixing is not yet available."
                  : data.state === 3
                  ? "Site modifications are not yet available."
                  : `State ${data.state}`,
                state: data.state,
              })
              break

            case "question":
              addMessage({
                role: "ai",
                type: "question",
                content: data.text,
                detail: data.max > 0 ? `Question ${data.number} of ${data.max}` : undefined,
              })
              break

            case "plan":
              if (data.steps && Array.isArray(data.steps)) {
                addMessage({
                  role: "ai",
                  type: "plan",
                  content: "Here's the build plan:",
                  steps: data.steps,
                })
              }
              break

            case "step":
              addMessage({
                role: "ai",
                type: "step",
                content: data.title || "Processing",
                detail: data.detail || "",
              })
              break

            case "code":
              addMessage({
                role: "ai",
                type: "code",
                content: `Generated ${data.filename}`,
                detail: `${(data.code?.length || 0).toLocaleString()} chars`,
                files: data.filename ? [{ name: data.filename, code: data.code, usedFor: data.usedFor || "" }] : [],
              })
              break

            case "state_update":
              if (data) {
                setConversationState(data as ConversationState)
              }
              break

            case "done":
              const doneFiles = data.files || conversationState.generatedFiles
              if (doneFiles.length > 0) {
                addMessage({
                  role: "ai",
                  type: "done",
                  content: `Built ${doneFiles.length} files:`,
                  files: doneFiles,
                })
              }
              break

            case "error":
              setError(data.message || "An error occurred")
              addMessage({
                role: "ai",
                type: "error",
                content: data.message || "An error occurred",
              })
              break
          }
        }
        scrollToBottom()
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        const message = err.message || "Connection failed"
        setError(message)
        addMessage({ role: "ai", type: "error", content: message })
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
                Hi {userName},
              </h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">
                What are we building?
              </h2>
            </div>
          </div>
        ) : (
          <div ref={chatRef} className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-4 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <ChatBubble msg={msg} />
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center gap-2 text-zinc-500 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs">Syra is thinking...</span>
                </div>
              )}

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
        <div className="flex items-center justify-between max-w-2xl mx-auto px-3 sm:px-4 mb-2">
          {messages.length > 0 && (
            <button
              onClick={resetConversation}
              className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              Start new build
            </button>
          )}
          <span className="text-[11px] text-zinc-600 ml-auto">
            Syra AI Builder v2
          </span>
        </div>
        <InputBar
          input={input}
          setInput={setInput}
          onSend={handleSend}
          disabled={isLoading}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          attachments={attachments}
          setAttachments={setAttachments}
        />
      </div>
    </div>
  )
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="flex items-start gap-2 max-w-[85%]">
          <div className="rounded-2xl rounded-br-md bg-white/[0.08] border border-white/[0.06] px-4 py-2.5">
            <p className="text-sm text-zinc-100 whitespace-pre-wrap">{msg.content}</p>
          </div>
          <div className="h-7 w-7 rounded-full bg-zinc-700/50 flex items-center justify-center shrink-0 mt-0.5">
            <User className="h-3.5 w-3.5 text-zinc-400" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2">
      <div className="h-7 w-7 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-blue-400" />
      </div>
      <div className="max-w-[85%] space-y-1">
        {msg.type === "state" && (
          <div className={cn("rounded-2xl rounded-bl-md px-4 py-2.5 border", msg.state === 2 || msg.state === 3 ? "bg-amber-500/[0.06] border-amber-500/20" : "bg-blue-500/[0.06] border-blue-500/20")}>
            <p className="text-sm text-zinc-200">{msg.content}</p>
          </div>
        )}

        {msg.type === "question" && (
          <div className="rounded-2xl rounded-bl-md bg-blue-500/[0.08] border border-blue-500/20 px-4 py-3">
            <div className="flex items-center gap-2 mb-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-blue-400" />
              <span className="text-[10px] text-blue-400/70 uppercase tracking-wider font-semibold">{msg.detail}</span>
            </div>
            <p className="text-sm text-zinc-100">{msg.content}</p>
          </div>
        )}

        {msg.type === "plan" && msg.steps && (
          <div className="rounded-2xl rounded-bl-md bg-emerald-500/[0.05] border border-emerald-500/20 px-4 py-3">
            <p className="text-sm text-zinc-300 mb-2">{msg.content}</p>
            <div className="space-y-1">
              {msg.steps.map((step, i) => (
                <div key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-emerald-400 font-medium shrink-0 mt-0.5">{i + 1}.</span>
                  <span className="text-zinc-400">{step}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {msg.type === "step" && (
          <div className="rounded-2xl rounded-bl-md bg-white/[0.03] border border-white/[0.05] px-4 py-2">
            <div className="flex items-center gap-2">
              {msg.content.toLowerCase().includes("generating") || msg.content.toLowerCase().includes("processing") || msg.content.toLowerCase().includes("analyzing") || msg.content.toLowerCase().includes("planning") ? (
                <Loader2 className="h-3 w-3 animate-spin text-blue-400 shrink-0" />
              ) : (
                <ArrowRight className="h-3 w-3 text-zinc-500 shrink-0" />
              )}
              <div className="min-w-0">
                <p className="text-xs text-zinc-300 truncate">{msg.content}</p>
                {msg.detail && <p className="text-[10px] text-zinc-500 mt-0.5">{msg.detail}</p>}
              </div>
            </div>
          </div>
        )}

        {msg.type === "code" && (
          <div className="rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.08] px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-xs font-medium text-zinc-200">{msg.content}</span>
              {msg.detail && <span className="text-[10px] text-zinc-500 ml-1">{msg.detail}</span>}
            </div>
            {msg.files && msg.files.length > 0 && (
              <div className="rounded-lg bg-zinc-950/80 border border-white/[0.06] overflow-hidden mt-1">
                <div className="flex items-center gap-2 px-3 py-1.5 border-b border-white/[0.05]">
                  <FileText className="h-3 w-3 text-zinc-500" />
                  <span className="text-[10px] text-zinc-400 font-mono">{msg.files[0].name}</span>
                </div>
                <pre className="p-3 text-[11px] text-zinc-300 font-mono leading-relaxed overflow-x-auto max-h-48 custom-scrollbar">
                  {msg.files[0].code.slice(0, 1500)}
                  {msg.files[0].code.length > 1500 && "\n\n... (truncated)"}
                </pre>
              </div>
            )}
          </div>
        )}

        {msg.type === "done" && msg.files && (
          <div className="rounded-2xl rounded-bl-md bg-emerald-500/[0.06] border border-emerald-500/20 px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">{msg.content}</span>
            </div>
            <div className="space-y-1">
              {msg.files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <FileText className="h-3 w-3 text-zinc-500 shrink-0" />
                  <span className="text-zinc-400 font-mono">{f.name}</span>
                  <span className="text-zinc-600">—</span>
                  <span className="text-zinc-500 truncate">{f.usedFor}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {msg.type === "error" && (
          <div className="rounded-2xl rounded-bl-md bg-red-500/[0.06] border border-red-500/20 px-4 py-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-sm text-red-300">{msg.content}</p>
            </div>
          </div>
        )}

        {msg.type === "text" && (
          <div className="rounded-2xl rounded-bl-md bg-white/[0.04] border border-white/[0.06] px-4 py-2.5">
            <p className="text-sm text-zinc-200 whitespace-pre-wrap">{msg.content}</p>
          </div>
        )}
      </div>
    </div>
  )
}

function parseSSE(buffer: string): Array<{ event: string; data: any }> {
  const results: Array<{ event: string; data: any }> = []
  const parts = buffer.split("\n\n")
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

export default AIWebsiteBuilder
