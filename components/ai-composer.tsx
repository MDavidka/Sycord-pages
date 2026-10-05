"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  ArrowUp,
  Mic,
  MicOff,
  Paperclip,
  Wrench,
  ChevronDown,
  X,
  Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { SycordOmniRouterModal, BrandLogo } from "@/components/sycord-omni-router-modal"
import type { DashboardArtifact } from "./dashboard-artifact-card"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  artifactName?: string
}

interface AiComposerProps {
  selectedArtifact: DashboardArtifact | null
  onClearArtifact?: () => void
  onNavigateToBuilder?: (prompt: string, artifact: DashboardArtifact, modelId: string) => void
  className?: string
}

export function AiComposer({
  selectedArtifact,
  onClearArtifact,
  onNavigateToBuilder,
  className,
}: AiComposerProps) {
  const [prompt, setPrompt] = useState("")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>("gemini-2.5-flash")
  const [selectedModelName, setSelectedModelName] = useState<string>("Gemini 2.5 Flash")
  const [isOmniModalOpen, setIsOmniModalOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll messages into view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async (textToSend?: string) => {
    const input = (textToSend || prompt).trim()
    if (!input || isSending) return

    const artifactName = selectedArtifact?.name
    setMessages((prev) => [...prev, { role: "user", content: input, artifactName }])
    setPrompt("")
    setIsSending(true)

    // Context-enriched prompt for the model
    const contextContent = selectedArtifact
      ? `[Context Artifact: ${selectedArtifact.name} (${selectedArtifact.type}${
          selectedArtifact.url ? ` at ${selectedArtifact.url}` : ""
        })]\n${input}`
      : input

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: selectedModel,
          messages: [
            ...messages.map((m) => ({ role: m.role, content: m.content })),
            { role: "user", content: contextContent },
          ],
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        const errMsg = errorData?.error || `AI request failed: ${res.statusText} (${res.status})`
        throw new Error(errMsg)
      }

      // Read response stream matching Astro chat logic
      const reader = res.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let assistantReply = ""
        setMessages((prev) => [...prev, { role: "assistant", content: "" }])

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })

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
                // Ignore json parse error for raw tokens
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
      const errMsg = err?.message || "Something went wrong while connecting to the AI model."
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${errMsg}`,
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

  const toggleSpeechRecognition = () => {
    if (typeof window === "undefined") return

    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported on this browser.")
      return
    }

    if (isListening) {
      setIsListening(false)
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = "en-US"

      recognition.onstart = () => setIsListening(true)
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setPrompt((prev) => (prev ? `${prev} ${transcript}` : transcript))
        setIsListening(false)
      }
      recognition.onerror = () => setIsListening(false)
      recognition.onend = () => setIsListening(false)

      recognition.start()
    } catch {
      setIsListening(false)
    }
  }

  return (
    <div className={cn("w-full flex flex-col", className)}>
      {/* Astro Chat Style Messages History */}
      {messages.length > 0 && (
        <div className="w-full space-y-4 mb-4 max-h-[44vh] overflow-y-auto px-1 scroll-smooth">
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
                    : "bg-surface border border-border text-foreground"
                }`}
              >
                {m.artifactName && m.role === "user" && (
                  <div className="text-[11px] opacity-80 mb-1 flex items-center gap-1 font-mono">
                    <span>Context:</span>
                    <span className="underline">{m.artifactName}</span>
                  </div>
                )}
                <div className="whitespace-pre-wrap leading-relaxed">{m.content}</div>
              </div>
            </div>
          ))}
          {isSending && (
            <div className="flex justify-start">
              <div className="bg-surface border border-border text-foreground max-w-[85%] rounded-2xl px-4 py-3 flex items-center gap-2 text-xs text-text-muted">
                <span className="size-2 rounded-full bg-indigo-400 animate-ping" />
                <span>Generating response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Main Composer Box - Exact Same Input Bar Style as Astro Chat Model */}
      <div className="w-full bg-surface border border-border hover:border-border-strong transition-colors rounded-[26px] p-4 sm:p-5 flex flex-col gap-3 shadow-lg shadow-black/40">
        {/* Attached Artifact Context Chip */}
        {selectedArtifact && (
          <div className="flex items-center gap-2 mb-0.5">
            <div className="inline-flex items-center gap-2 rounded-[10px] bg-surface-raised border border-border px-2.5 py-1 text-xs text-text-secondary">
              <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="font-medium text-foreground truncate max-w-[200px]">
                {selectedArtifact.name}
              </span>
              {selectedArtifact.meta && (
                <span className="text-[10px] text-text-muted font-mono">
                  ({selectedArtifact.meta})
                </span>
              )}
              {onClearArtifact && (
                <button
                  type="button"
                  onClick={onClearArtifact}
                  title="Detach context"
                  className="ml-1 text-text-muted hover:text-foreground transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-text-muted hidden sm:inline">
              Active AI context
            </span>
          </div>
        )}

        {/* Textarea */}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Help you write code, debug and ship production-ready work. Type / for skills & integrations."
          rows={3}
          className="w-full bg-transparent border-0 resize-none text-[15px] placeholder:text-text-muted text-foreground focus:outline-none focus:ring-0 leading-relaxed"
        />

        {/* Action Toolbar matching Astro chat */}
        <div className="flex items-center justify-between pt-3 border-t border-border-subtle">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-text-muted hover:text-foreground text-xs font-normal gap-1.5"
              title="Add attachment"
              onClick={() => {
                setPrompt((p) => (p ? `${p} /attach ` : "/attach "))
              }}
            >
              <Paperclip className="size-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Attach</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-text-muted hover:text-foreground text-xs font-normal gap-1.5"
              title="Configure tools"
              onClick={() => {
                setPrompt((p) => (p ? `${p} /skills ` : "/skills "))
              }}
            >
              <Wrench className="size-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">Tools</span>
            </Button>
            <div className="h-4 w-[1px] bg-border hidden sm:block mx-1" />
            <button
              type="button"
              onClick={() => setIsOmniModalOpen(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[14px] bg-surface-raised hover:bg-surface-muted border border-border text-xs font-medium text-text-secondary hover:text-foreground transition-colors cursor-pointer"
            >
              <BrandLogo brand={selectedModel.split("/")[0] || "anthropic"} size={14} />
              <span className="truncate max-w-[130px]">{selectedModelName}</span>
              <ChevronDown className="size-3 text-text-muted" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Voice Microphone */}
            <button
              type="button"
              title={isListening ? "Listening... click to stop" : "Voice input"}
              aria-label="Voice input"
              onClick={toggleSpeechRecognition}
              className={cn(
                "size-9 rounded-full flex items-center justify-center transition-all cursor-pointer outline-none",
                isListening
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/50 animate-pulse"
                  : "text-text-muted hover:text-foreground hover:bg-surface-muted"
              )}
            >
              {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
            </button>

            {/* Send Button */}
            <Button
              type="button"
              onClick={() => handleSend()}
              disabled={!prompt.trim() || isSending}
              size="sm"
              className="gap-1.5"
            >
              <span>Send</span>
              <ArrowUp className="size-3.5" strokeWidth={2} />
            </Button>
          </div>
        </div>
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
