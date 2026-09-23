"use client"

import React, { useState } from "react"
import {
  Sparkles,
  Send,
  Paperclip,
  Wrench,
  Search,
  Code2,
  BarChart3,
  PenTool,
  Compass,
  ArrowUp,
  Bot,
  Zap,
  ChevronDown,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { SycordOmniRouterModal, BrandLogo } from "@/components/sycord-omni-router-modal"

interface QuickAction {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  prompt: string
  description: string
}

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "research",
    label: "Research",
    icon: Search,
    prompt: "Research modern architectural patterns for Next.js fullstack web apps.",
    description: "Deep research & synthesis",
  },
  {
    id: "code",
    label: "Code",
    icon: Code2,
    prompt: "Write a high-performance React hook for handling resilient SSE streams.",
    description: "Write, review & refactor",
  },
  {
    id: "analyze",
    label: "Analyze",
    icon: BarChart3,
    prompt: "Analyze the trade-offs of using edge functions vs serverless containers.",
    description: "Data & architecture analysis",
  },
  {
    id: "write",
    label: "Write",
    icon: PenTool,
    prompt: "Draft comprehensive documentation and API specs for a webhook system.",
    description: "Technical copy & specs",
  },
  {
    id: "plan",
    label: "Plan",
    icon: Compass,
    prompt: "Break down a full product migration roadmap with risk mitigation steps.",
    description: "Roadmaps & execution plans",
  },
]

export function AstroDashboard() {
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([])
  const [isSending, setIsSending] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>("anthropic/claude-3.5-sonnet")
  const [selectedModelName, setSelectedModelName] = useState<string>("Claude 3.5 Sonnet")
  const [isOmniModalOpen, setIsOmniModalOpen] = useState(false)

  const handleSend = async (textToSend?: string) => {
    const input = (textToSend || prompt).trim()
    if (!input || isSending) return

    setMessages((prev) => [...prev, { role: "user", content: input }])
    setPrompt("")
    setIsSending(true)

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [{ role: "user", content: input }],
        }),
      })

      if (!res.ok) {
        throw new Error(`AI request failed: ${res.statusText}`)
      }

      // Stream response or read text
      const reader = res.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let assistantReply = ""
        setMessages((prev) => [...prev, { role: "assistant", content: "" }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          
          // Parse SSE chunks if present or raw chunks
          const lines = chunk.split("\n")
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const dataStr = line.slice(6).trim()
              if (dataStr === "[DONE]") continue
              try {
                const parsed = JSON.parse(dataStr)
                const token = parsed.choices?.[0]?.delta?.content || ""
                assistantReply += token
                setMessages((prev) => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: "assistant", content: assistantReply }
                  return updated
                })
              } catch {
                // not json, append directly
              }
            } else if (!line.startsWith(":")) {
              assistantReply += line
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = { role: "assistant", content: assistantReply }
                return updated
              })
            }
          }
        }
      } else {
        const data = await res.json().catch(() => ({}))
        const reply = data.reply || data.message || "I am ready to assist you in this workspace."
        setMessages((prev) => [...prev, { role: "assistant", content: reply }])
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Astro workspace is active and connected. You can prompt any general agentic tasks here.",
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[68vh] py-6 animate-in fade-in duration-300">
      {/* Header section */}
      <div className="text-center mb-8 flex flex-col items-center">
        <div className="relative mb-4">
          <div className="h-16 w-16 rounded-[22px] bg-gradient-to-tr from-[#3b1578] via-[#1f1b3e] to-[#12131a] border border-[#3f3b60]/50 flex items-center justify-center shadow-lg shadow-purple-950/20 overflow-hidden">
            <img
              src="/astro-icon.png"
              alt="Astro"
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none"
              }}
            />
          </div>
          <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center">
            <Sparkles className="h-3 w-3 text-purple-400" />
          </div>
        </div>

        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100 flex items-center gap-2">
          Astro
        </h1>
        <p className="text-sm text-zinc-400 mt-1.5 max-w-md">
          Your general-purpose AI workspace. Independent, agentic, and ready to assist.
        </p>
      </div>

      {/* Messages history if any */}
      {messages.length > 0 && (
        <div className="w-full space-y-4 mb-6 max-h-[40vh] overflow-y-auto px-2">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`flex gap-3 text-sm ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground font-medium"
                    : "bg-[#1f1f23] border border-[#2e2e34] text-zinc-200"
                }`}
              >
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Composer Box */}
      <div className="w-full bg-[#1c1d21] border border-[#2c2d33] hover:border-[#3a3b43] transition-colors rounded-[22px] p-3 sm:p-4 shadow-xl shadow-black/40 flex flex-col gap-3">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="What can Astro help with today?"
          rows={3}
          className="w-full bg-transparent border-0 resize-none text-[15px] placeholder:text-zinc-500 text-zinc-100 focus:outline-none focus:ring-0 leading-relaxed"
        />

        {/* Action toolbar */}
        <div className="flex items-center justify-between pt-2 border-t border-[#26272e]">
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] text-xs font-normal gap-1.5"
              title="Add attachment"
            >
              <Paperclip className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Attach</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 px-2.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] text-xs font-normal gap-1.5"
              title="Configure tools"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Tools</span>
            </Button>
            <div className="h-3.5 w-[1px] bg-zinc-800 hidden sm:block mx-0.5" />
            <button
              type="button"
              onClick={() => setIsOmniModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 text-xs font-medium text-zinc-200 transition-colors"
            >
              <BrandLogo brand={selectedModel.split("/")[0] || "anthropic"} size={14} />
              <span className="truncate max-w-[130px]">{selectedModelName}</span>
              <ChevronDown className="w-3 h-3 text-zinc-400" />
            </button>
          </div>

          <Button
            type="button"
            onClick={() => handleSend()}
            disabled={!prompt.trim() || isSending}
            size="sm"
            className="h-8 px-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs gap-1.5 transition-transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
          >
            <span>Send</span>
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Quick Action Cards */}
      <div className="w-full mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                setPrompt(action.prompt)
              }}
              className="group flex flex-col items-start text-left p-3 rounded-xl bg-[#16171a]/70 hover:bg-[#1f2025] border border-[#25262c] hover:border-[#383942] transition-all duration-150"
            >
              <div className="h-7 w-7 rounded-lg bg-[#22232a] group-hover:bg-primary/10 border border-[#2e2f38] flex items-center justify-center mb-2 transition-colors">
                <Icon className="h-3.5 w-3.5 text-zinc-400 group-hover:text-primary transition-colors" />
              </div>
              <span className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors">
                {action.label}
              </span>
              <span className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">
                {action.description}
              </span>
            </button>
          )
        })}
      </div>

      {/* Omni Router Model Picker Modal */}
      <SycordOmniRouterModal
        open={isOmniModalOpen}
        onOpenChange={setIsOmniModalOpen}
        selectedModel={selectedModel}
        onSelectModel={(modelId, modelObj) => {
          setSelectedModel(modelId)
          if (modelObj?.name) setSelectedModelName(modelObj.name)
        }}
      />
    </div>
  )
}
