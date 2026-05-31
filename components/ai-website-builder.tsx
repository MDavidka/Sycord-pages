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
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
  Bot,
  User as UserIcon,
  AlertCircle,
  Hash,
  Code2,
  MessageSquare,
  Check,
  ArrowRight,
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
  <DropdownMenuItem onClick={onSelect} className={cn("text-xs rounded-lg px-2.5 py-2 flex items-center gap-2.5 border border-transparent transition-all", selected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50")}>
    {tier === "fast" ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" /> : <Gem className="h-3 w-3 text-violet-400 shrink-0" />}
    <span className="flex-1 min-w-0 truncate">{model.name}</span>
    <span className="text-[10px] text-muted-foreground shrink-0">{model.provider}</span>
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
    <div className="w-full max-w-2xl mx-auto px-4">
      <div className="relative">
        <div className="flex items-end gap-2 bg-[#1e1e1e] border border-border/40 rounded-2xl p-2">
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            <textarea
              placeholder="Describe the website you want to build..."
              className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-3 py-2 min-h-[40px] max-h-32 font-[Inter,system-ui,sans-serif]"
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
                  <Badge key={i} variant="secondary" className="gap-1 text-[10px]">
                    {file.name.slice(0, 20)}
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}><X className="h-2.5 w-2.5" /></button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
              if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)])
            }} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-lg" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" />
            </Button>

            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground hover:text-foreground rounded-lg px-2 text-[11px]">
                    {selectedModel.name.slice(0, 14)}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-1.5 bg-popover border-border rounded-xl shadow-lg">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Gem className="h-3 w-3" /> Best
                  </div>
                  {MODELS.filter(m => !m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="best" />
                  ))}
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mt-1">
                    <Zap className="h-3 w-3" /> Fast
                  </div>
                  {MODELS.filter(m => m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="fast" />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <Button onClick={onSend} size="icon" className={cn("h-8 w-8 sm:h-9 sm:w-9 transition-all active:scale-95 shrink-0 rounded-lg p-0", input.trim() && !disabled ? "bg-foreground text-background hover:bg-foreground/90" : "bg-muted text-muted-foreground")} disabled={!input.trim() || disabled}>
              {disabled ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
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
  const [generatedPages, setGeneratedPages] = useState<GeneratedPage[]>([])

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
    setGeneratedPages([])
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
              if (data.filename && data.code) {
                setGeneratedPages(prev => {
                  const idx = prev.findIndex(p => p.name === data.filename)
                  const page = { name: data.filename, code: data.code, usedFor: data.usedFor || "", timestamp: Date.now() }
                  if (idx >= 0) { const copy = [...prev]; copy[idx] = page; return copy }
                  return [...prev, page]
                })
                addMessage({
                  role: "ai",
                  type: "code",
                  content: data.filename,
                  detail: `${(data.code?.length || 0).toLocaleString()} chars`,
                  files: [{ name: data.filename, code: data.code, usedFor: data.usedFor || "" }],
                })
              }
              break

            case "state_update":
              if (data) {
                setConversationState(data as ConversationState)
              }
              break

            case "done":
              addMessage({
                role: "ai",
                type: "done",
                content: "Build complete",
                files: data.files || conversationState.generatedFiles,
              })
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
    <div className="flex flex-col h-full font-[Inter,system-ui,sans-serif]">
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 px-4">
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-foreground">
              Hi {userName},
            </h1>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight text-muted-foreground/60">
              What are we building?
            </h2>
          </div>
        </div>
      ) : (
        <div ref={chatRef} className="flex-1 overflow-y-auto custom-scrollbar">
          <div className="max-w-2xl mx-auto py-6 space-y-6">
            {messages.map((msg) => (
              <div key={msg.id}>
                <ChatBubble msg={msg} />
              </div>
            ))}

            {isLoading && (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Syra is thinking...</span>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="w-full pb-8 shrink-0">
        <div className="flex items-center justify-between max-w-2xl mx-auto px-4 mb-3">
          {messages.length > 0 && (
            <button
              onClick={resetConversation}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              New build
            </button>
          )}
          <span className="text-[11px] text-muted-foreground ml-auto">
            Syra v2
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
      <div className="flex justify-end px-4">
        <div className="flex items-start gap-3 max-w-[85%]">
          <Card className="px-4 py-2.5 bg-accent/40 border-border/30 rounded-2xl rounded-br-sm">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </Card>
          <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
            <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-3 px-4">
      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="max-w-[85%] min-w-0 space-y-1.5">
        {msg.type === "state" && (
          <Card className={cn("px-4 py-2.5 rounded-2xl rounded-bl-sm border", msg.state === 2 || msg.state === 3 ? "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/30" : "bg-muted/30 border-border/20")}>
            <p className="text-sm">{msg.content}</p>
          </Card>
        )}

        {msg.type === "question" && (
          <Card className="px-4 py-3 rounded-2xl rounded-bl-sm border-border/20 bg-muted/20">
            <div className="flex items-center gap-2 mb-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
              {msg.detail && <Badge variant="secondary" className="text-[10px]">{msg.detail}</Badge>}
            </div>
            <p className="text-sm leading-relaxed">{msg.content}</p>
          </Card>
        )}

        {msg.type === "plan" && msg.steps && (
          <Card className="px-4 py-3 rounded-2xl rounded-bl-sm border-border/20 bg-muted/20">
            <p className="text-sm text-muted-foreground mb-3">{msg.content}</p>
            <div className="space-y-1.5">
              {msg.steps.map((step, i) => {
                const filename = step.match(/%([^%]+)%/)?.[1]
                return (
                  <div key={i} className="flex items-start gap-2.5 text-sm group">
                    <span className="text-muted-foreground shrink-0 mt-0.5 font-mono text-xs w-5">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      {filename ? (
                        <div className="flex items-center gap-1.5">
                          <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                          <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded text-foreground/80">{filename}</code>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{step}</span>
                      )}
                      {step.replace(/%[^%]+%/g, "").trim() && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{step.replace(/%[^%]+%/g, "").trim()}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>
        )}

        {msg.type === "step" && (
          <div className="flex items-center gap-2.5 text-sm">
            {msg.content.toLowerCase().includes("generating") || msg.content.toLowerCase().includes("saving") ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
            ) : msg.content.toLowerCase().includes("analyzing") || msg.content.toLowerCase().includes("planning") ? (
              <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : msg.content.toLowerCase().includes("saved") || msg.content.toLowerCase().includes("generated") ? (
              <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            ) : (
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <div className="min-w-0">
              <span className="text-muted-foreground">{msg.content}</span>
              {msg.detail && <span className="text-xs text-muted-foreground/50 ml-2">{msg.detail}</span>}
            </div>
          </div>
        )}

        {msg.type === "code" && msg.files && (
          <Card className="rounded-2xl rounded-bl-sm border-border/20 bg-muted/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <code className="text-xs font-mono truncate">{msg.content}</code>
              {msg.detail && <Badge variant="secondary" className="text-[10px] shrink-0 ml-auto">{msg.detail}</Badge>}
            </div>
            <pre className="p-4 text-[11px] text-foreground/70 font-mono leading-relaxed overflow-x-auto max-h-32 custom-scrollbar">
              {msg.files[0].code.slice(0, 1200)}
              {msg.files[0].code.length > 1200 && "\n\n..."}
            </pre>
          </Card>
        )}

        {msg.type === "done" && msg.files && (
          <Card className="px-4 py-3 rounded-2xl rounded-bl-sm border-emerald-200 dark:border-emerald-800/30 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <span className="text-sm font-medium">{msg.content}</span>
              <Badge variant="secondary" className="text-[10px]">{msg.files.length} files</Badge>
            </div>
            <div className="space-y-1">
              {msg.files.map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs pl-6">
                  <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                  <code className="text-xs font-mono">{f.name}</code>
                </div>
              ))}
            </div>
          </Card>
        )}

        {msg.type === "error" && (
          <Card className="px-4 py-3 rounded-2xl rounded-bl-sm border-destructive/30 bg-destructive/5">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-sm text-destructive">{msg.content}</p>
            </div>
          </Card>
        )}

        {msg.type === "text" && (
          <Card className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-muted/20 border-border/10">
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
          </Card>
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
