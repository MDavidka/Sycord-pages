"use client"

import React, { useState, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Send,
  Square,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Loader2,
  FileCode,
  Terminal,
  ExternalLink,
  Eye,
  Trash2,
  Copy,
  Check,
  HelpCircle,
  Play,
  RotateCw,
} from "lucide-react"
import { ChatMessage, Plan, ToolCallItem, QuestionItem, PreviewState } from "./types"

interface ChatViewProps {
  messages: ChatMessage[]
  isStreaming: boolean
  currentThinking: string
  thinkingDuration: number
  activePlan?: Plan
  previewState: PreviewState
  selectedModel: string
  onModelSelect: (model: string) => void
  onSendMessage: (content: string) => void
  onStopGeneration: () => void
  onClearChat: () => void
  onQuestionAnswered: (questionId: string, answer: string) => void
  onOpenPreview: (url?: string) => void
  onStartDevServer: () => Promise<void>
  projectName?: string | null
  userImage?: string | null
  isDark?: boolean
}

const POPULAR_MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", icon: "/model-logos/gemini.svg", desc: "Ultra fast & accurate" },
  { id: "deepseek-chat", label: "DeepSeek V3", icon: "/model-logos/deepseek.svg", desc: "Top-tier coding agent" },
  { id: "deepseek-reasoner", label: "DeepSeek R1", icon: "/model-logos/deepseek.svg", desc: "Deep reasoning & verification" },
  { id: "claude-3-5-sonnet", label: "Claude 3.5 Sonnet", icon: "/model-logos/pro.svg", desc: "Complex architecture" },
  { id: "gpt-4o", label: "GPT-4o", icon: "/model-logos/base.svg", desc: "Balanced multimodal" },
]

export function ChatView({
  messages,
  isStreaming,
  currentThinking,
  thinkingDuration,
  activePlan,
  previewState,
  selectedModel,
  onModelSelect,
  onSendMessage,
  onStopGeneration,
  onClearChat,
  onQuestionAnswered,
  onOpenPreview,
  onStartDevServer,
  projectName,
  userImage,
  isDark = true,
}: ChatViewProps) {
  const [input, setInput] = useState("")
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false)
  const [expandedThinking, setExpandedThinking] = useState<Record<string, boolean>>({})
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null)
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom as new content streams
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isStreaming, currentThinking])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (input.trim() && !isStreaming) {
        onSendMessage(input.trim())
        setInput("")
      }
    }
  }

  const handleSend = () => {
    if (input.trim() && !isStreaming) {
      onSendMessage(input.trim())
      setInput("")
    }
  }

  const copyCode = async (code: string, id: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setCopiedCodeId(id)
      setTimeout(() => setCopiedCodeId(null), 2000)
    } catch {}
  }

  const toggleThinking = (msgId: string) => {
    setExpandedThinking((prev) => ({
      ...prev,
      [msgId]: !prev[msgId],
    }))
  }

  const selectedModelMeta = POPULAR_MODELS.find((m) => m.id === selectedModel) || {
    id: selectedModel,
    label: selectedModel,
    icon: "/model-logos/base.svg",
    desc: "AI Model",
  }

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${isDark ? "bg-[#18181b] text-zinc-100" : "bg-white text-zinc-900"}`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0 ${isDark ? "bg-[#1f1f23] border-zinc-800" : "bg-zinc-50 border-zinc-200"}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-7 w-7 rounded-lg bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-xs border border-indigo-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-semibold truncate leading-none">
              {projectName || "Astro AI Architect"}
            </h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className={`h-1.5 w-1.5 rounded-full ${isStreaming ? "bg-amber-400 animate-ping" : "bg-emerald-400"}`} />
              <span className="text-[10px] text-zinc-400">
                {isStreaming ? "Generating & executing…" : "Ready"}
              </span>
            </div>
          </div>
        </div>

        {/* Model Selector & Actions */}
        <div className="flex items-center gap-2">
          {/* Model Selector Dropdown */}
          <div className="relative">
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                isDark ? "bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700" : "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              {selectedModelMeta.icon && (
                <img src={selectedModelMeta.icon} alt="" className="h-3.5 w-3.5 object-contain" />
              )}
              <span className="truncate max-w-[110px]">{selectedModelMeta.label}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </button>

            {modelDropdownOpen && (
              <div
                className={`absolute right-0 top-full mt-1 w-64 rounded-xl shadow-2xl border p-1 z-50 ${
                  isDark ? "bg-zinc-900 border-zinc-800 text-zinc-200" : "bg-white border-zinc-200 text-zinc-800"
                }`}
              >
                <div className="px-2 py-1 text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Select AI Model
                </div>
                {POPULAR_MODELS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onModelSelect(m.id)
                      setModelDropdownOpen(false)
                    }}
                    className={`flex items-center gap-2.5 w-full px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                      selectedModel === m.id
                        ? isDark
                          ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/30"
                          : "bg-indigo-50 text-indigo-700"
                        : isDark
                        ? "hover:bg-zinc-800 text-zinc-300"
                        : "hover:bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    <img src={m.icon} alt="" className="h-4 w-4 object-contain" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{m.label}</div>
                      <div className="text-[10px] opacity-60 truncate">{m.desc}</div>
                    </div>
                    {selectedModel === m.id && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Quick Preview Toggle */}
          <button
            onClick={() => onOpenPreview()}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
              previewState.status === "running"
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                : isDark
                ? "bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700"
                : "bg-white border-zinc-300 text-zinc-700 hover:bg-zinc-50"
            }`}
            title="Toggle Live Preview"
          >
            <Eye className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Preview</span>
          </button>

          {/* Clear Chat */}
          <button
            onClick={onClearChat}
            className="p-1.5 rounded-md text-zinc-400 hover:text-red-400 hover:bg-zinc-800 transition-colors"
            title="Clear Chat History"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center max-w-md mx-auto p-6 space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center border border-indigo-500/20">
              <Sparkles className="h-6 w-6" />
            </div>
            <h3 className="text-base font-semibold">What would you like to build?</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Describe your idea, frontend components, or entire application. Astro will plan, code, verify, and start the live preview automatically.
            </p>
            <div className="flex flex-wrap gap-2 pt-2 justify-center">
              {[
                "Build a modern SaaS landing page",
                "Create a real-time crypto analytics dashboard",
                "Scaffold an e-commerce product catalog",
              ].map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => onSendMessage(suggestion)}
                  className={`text-xs px-3 py-1.5 rounded-lg border text-left transition-colors ${
                    isDark
                      ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:border-zinc-700"
                      : "bg-white border-zinc-200 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {/* User message */}
            {msg.role === "user" ? (
              <div className="max-w-[85%] rounded-2xl px-4 py-2.5 bg-indigo-600 text-white text-xs leading-relaxed shadow-sm">
                {msg.content}
              </div>
            ) : (
              /* Assistant message */
              <div className="w-full max-w-3xl space-y-3">
                {/* 1. Thinking Collapsible */}
                {(msg.thinking || (isStreaming && msg.isStreaming && currentThinking)) && (
                  <div className={`rounded-xl border overflow-hidden ${isDark ? "bg-zinc-900/50 border-zinc-800/80" : "bg-zinc-50 border-zinc-200"}`}>
                    <button
                      onClick={() => toggleThinking(msg.id)}
                      className="flex items-center justify-between w-full px-3 py-1.5 text-[11px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                    >
                      <div className="flex items-center gap-1.5">
                        {isStreaming && msg.isStreaming ? (
                          <Loader2 className="h-3 w-3 animate-spin text-indigo-400" />
                        ) : (
                          <Sparkles className="h-3 w-3 text-indigo-400" />
                        )}
                        <span>
                          {isStreaming && msg.isStreaming
                            ? "Thinking…"
                            : `Thought for ${msg.thinkingDuration || thinkingDuration || 1}s`}
                        </span>
                      </div>
                      {expandedThinking[msg.id] ? (
                        <ChevronDown className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {(expandedThinking[msg.id] || (isStreaming && msg.isStreaming)) && (
                      <div className="px-3 pb-2.5 pt-1 text-[11px] font-mono leading-relaxed text-zinc-400 border-t border-zinc-800/40 max-h-48 overflow-y-auto whitespace-pre-wrap">
                        {msg.thinking || currentThinking}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Autonomous Plan Tracker */}
                {(msg.plan || activePlan) && (
                  <div className={`rounded-xl border p-3 ${isDark ? "bg-zinc-900/70 border-zinc-800" : "bg-white border-zinc-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-indigo-400" />
                        <span className="text-xs font-semibold text-zinc-200">
                          {(msg.plan || activePlan)?.title || "Execution Plan"}
                        </span>
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {((msg.plan || activePlan)?.steps || []).filter((s) => s.status === "completed").length} /{" "}
                        {((msg.plan || activePlan)?.steps || []).length} steps
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {((msg.plan || activePlan)?.steps || []).map((step) => (
                        <div
                          key={step.id}
                          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] ${
                            step.status === "completed"
                              ? isDark ? "bg-emerald-500/10 text-emerald-300" : "bg-emerald-50 text-emerald-700"
                              : step.status === "in_progress"
                              ? isDark ? "bg-indigo-500/15 text-indigo-200 border border-indigo-500/30" : "bg-indigo-50 text-indigo-800"
                              : isDark ? "text-zinc-400 bg-zinc-800/40" : "text-zinc-500 bg-zinc-50"
                          }`}
                        >
                          {step.status === "completed" ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                          ) : step.status === "in_progress" ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400 flex-shrink-0" />
                          ) : (
                            <Clock className="h-3.5 w-3.5 opacity-40 flex-shrink-0" />
                          )}
                          <span className="truncate flex-1 font-medium">{step.title}</span>
                          {step.notes && <span className="text-[10px] opacity-60 truncate">{step.notes}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Tool Calls Badges */}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {msg.toolCalls.map((tc) => (
                      <div
                        key={tc.id}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] border font-mono ${
                          tc.status === "completed"
                            ? isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-zinc-100 border-zinc-200 text-zinc-700"
                            : isDark ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" : "bg-indigo-50 border-indigo-200 text-indigo-700"
                        }`}
                      >
                        {tc.name.includes("file") ? (
                          <FileCode className="h-3 w-3 text-indigo-400" />
                        ) : tc.name.includes("command") ? (
                          <Terminal className="h-3 w-3 text-emerald-400" />
                        ) : tc.name.includes("preview") ? (
                          <Eye className="h-3 w-3 text-blue-400" />
                        ) : (
                          <Sparkles className="h-3 w-3 text-amber-400" />
                        )}
                        <span className="truncate max-w-[200px]">
                          {tc.args?.path || tc.args?.command || tc.name.replace(/^syte_/, "")}
                        </span>
                        {tc.status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                      </div>
                    ))}
                  </div>
                )}

                {/* 4. Interactive Questions */}
                {msg.question && (
                  <div className={`rounded-xl border p-3 space-y-2.5 ${isDark ? "bg-indigo-950/20 border-indigo-800/40" : "bg-indigo-50 border-indigo-200"}`}>
                    <div className="flex items-center gap-2">
                      <HelpCircle className="h-4 w-4 text-indigo-400" />
                      <span className="text-xs font-medium text-zinc-200">{msg.question.question}</span>
                    </div>
                    {msg.question.options && msg.question.options.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {msg.question.options.map((opt, i) => (
                          <button
                            key={i}
                            disabled={Boolean(msg.question?.answer)}
                            onClick={() => onQuestionAnswered(msg.question!.id, opt)}
                            className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                              msg.question?.answer === opt
                                ? "bg-indigo-600 text-white shadow"
                                : isDark
                                ? "bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700"
                                : "bg-white hover:bg-zinc-100 text-zinc-800 border border-zinc-200"
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Markdown Body */}
                {msg.content && (
                  <div className={`prose prose-sm max-w-none text-xs leading-relaxed ${isDark ? "prose-invert text-zinc-200" : "text-zinc-800"}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }: any) {
                          const match = /language-(\w+)/.exec(className || "")
                          const codeString = String(children).replace(/\n$/, "")
                          const codeId = `code_${Math.random().toString(36).slice(2, 7)}`

                          if (!inline && match) {
                            return (
                              <div className="relative my-2 rounded-lg overflow-hidden border border-zinc-800 bg-[#0d0d10]">
                                <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] font-mono text-zinc-400">
                                  <span>{match[1]}</span>
                                  <button
                                    onClick={() => copyCode(codeString, codeId)}
                                    className="flex items-center gap-1 hover:text-white transition-colors"
                                  >
                                    {copiedCodeId === codeId ? (
                                      <Check className="h-3 w-3 text-emerald-400" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                    <span>{copiedCodeId === codeId ? "Copied" : "Copy"}</span>
                                  </button>
                                </div>
                                <pre className="p-3 text-[11px] font-mono overflow-x-auto text-zinc-300">
                                  <code>{codeString}</code>
                                </pre>
                              </div>
                            )
                          }
                          return (
                            <code className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-200 font-mono text-[11px]" {...props}>
                              {children}
                            </code>
                          )
                        },
                      }}
                    >
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}

                {/* 6. Live Preview Card if link emitted */}
                {(msg.previewUrl || previewState.url) && (
                  <div className={`flex items-center justify-between p-3 rounded-xl border ${isDark ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-200" : "bg-emerald-50 border-emerald-200 text-emerald-800"}`}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <Play className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-semibold truncate">Live Preview Server Active</div>
                        <div className="text-[10px] opacity-70 truncate font-mono">
                          {msg.previewUrl || previewState.url}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => onOpenPreview(msg.previewUrl || previewState.url || "")}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors shadow-sm"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Open Preview</span>
                      </button>
                      <a
                        href={msg.previewUrl || previewState.url || "#"}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded-md text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-colors"
                        title="Open external link"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className={`p-3 border-t flex-shrink-0 ${isDark ? "bg-[#18181b] border-zinc-800" : "bg-white border-zinc-200"}`}>
        <div className={`flex items-end gap-2 rounded-xl border p-2 ${isDark ? "bg-zinc-900 border-zinc-700/60 focus-within:border-indigo-500" : "bg-zinc-50 border-zinc-200 focus-within:border-indigo-500"} transition-all`}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? "Astro is working…" : "Ask Astro to edit components, add pages, or start preview…"}
            disabled={isStreaming}
            rows={1}
            className="flex-1 resize-none bg-transparent text-xs leading-relaxed focus:outline-none max-h-32 min-h-[36px] py-1.5 px-2"
          />

          {isStreaming ? (
            <button
              onClick={onStopGeneration}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-red-600 hover:bg-red-500 text-white transition-colors"
              title="Stop Generation"
            >
              <Square className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white transition-all shadow-sm"
              title="Send Message"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
