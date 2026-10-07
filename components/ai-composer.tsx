"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  ArrowUp,
  Mic,
  Slash,
  FileUp,
  ImageIcon,
  Sparkles,
  ChevronDown,
  X,
  FileCode,
  Bug,
  HelpCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { ModelEffortSelector, type EffortLevel } from "@/components/agents/model-effort-selector"
import { SycordOmniRouterModal } from "@/components/sycord-omni-router-modal"
import { fetchAvailableModelChoices, getProviderIconUrl, type ModelChoice } from "@/glovix/lib/ai"
import type { DashboardArtifact } from "./dashboard-artifact-card"

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
  createdAt?: string
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
  const [showSlashMenu, setShowSlashMenu] = useState(false)
  const [effortLevel, setEffortLevel] = useState<EffortLevel>("extra_high")
  const [selectedModel, setSelectedModel] = useState<string>("syra-base")
  const [availableModelChoices, setAvailableModelChoices] = useState<ModelChoice[] | null>(null)
  const [isOmniModalOpen, setIsOmniModalOpen] = useState(false)
  const [isListening, setIsListening] = useState(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Fetch project-based AI chat model choices
  useEffect(() => {
    let active = true
    fetchAvailableModelChoices()
      .then((choices) => {
        if (!active) return
        setAvailableModelChoices(choices)
        const saved = typeof window !== "undefined" ? localStorage.getItem("sycord_selected_model") : null
        const match = choices.find((c) => c.modelType === saved || c.apiModel === saved)
        if (match) {
          setSelectedModel(match.modelType)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  // Auto-scroll messages into view
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  // Handle textarea autosizing
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setPrompt(value)
    if (value === "/") {
      setShowSlashMenu(true)
    }
    const target = e.target
    target.style.height = "auto"
    const maxH = typeof window !== "undefined" && window.innerWidth < 768 ? 120 : 200
    target.style.height = `${Math.min(target.scrollHeight, maxH)}px`
  }

  const handleSend = async (textToSend?: string) => {
    const input = (textToSend || prompt).trim()
    if (!input || isSending) return

    const now = new Date().toISOString()
    const artifactName = selectedArtifact?.name
    setMessages((prev) => [
      ...prev,
      { role: "user", content: input, createdAt: now, artifactName },
    ])
    setPrompt("")
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
    }
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
        const errMsg =
          errorData?.error || `AI request failed: ${res.statusText} (${res.status})`
        throw new Error(errMsg)
      }

      const reader = res.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let assistantReply = ""
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", createdAt: new Date().toISOString() },
        ])

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
                  updated[updated.length - 1] = {
                    role: "assistant",
                    content: assistantReply,
                    createdAt: updated[updated.length - 1].createdAt,
                  }
                  return updated
                })
              } catch {
                // Ignore raw token json parse issues
              }
            } else if (!line.startsWith(":")) {
              assistantReply += line
              setMessages((prev) => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: "assistant",
                  content: assistantReply,
                  createdAt: updated[updated.length - 1].createdAt,
                }
                return updated
              })
            }
          }
        }
      } else {
        const data = await res.json().catch(() => ({}))
        const reply =
          data.reply || data.message || "I am ready to assist you in this workspace."
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: reply, createdAt: new Date().toISOString() },
        ])
      }
    } catch (err: any) {
      const errMsg =
        err?.message || "Something went wrong while connecting to the AI model."
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ ${errMsg}`,
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape" && showSlashMenu) {
      e.preventDefault()
      setShowSlashMenu(false)
      return
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleSpeechRecognition = () => {
    if (typeof window === "undefined") return

    // @ts-ignore
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition
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
      {/* Hidden file input for /file or /image commands */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={(e) => {
          const files = e.target.files
          if (files && files.length > 0) {
            setPrompt((prev) =>
              prev ? `${prev} [Attached file: ${files[0].name}]` : `[Attached file: ${files[0].name}]`
            )
          }
        }}
      />

      {/* Syra Chat Style Messages History */}
      {messages.length > 0 && (
        <div className="w-full space-y-4 mb-4 max-h-[46vh] overflow-y-auto px-1 sm:px-2 scroll-smooth">
          {messages.map((m, idx) => (
            <div key={idx} className="space-y-1.5 animate-in fade-in duration-200">
              {m.role === "user" ? (
                <div className="flex justify-end">
                  <div className="flex flex-col items-end max-w-[90%] sm:max-w-[78%]">
                    <div className="text-[14px] sm:text-[15px] leading-[1.5] break-words bg-[#1D1D1D] text-[#F5F5F5] rounded-[22px] sm:rounded-[24px] px-3.5 py-2.5 sm:px-4.5 sm:py-3 border border-[#292929] shadow-sm">
                      {m.artifactName && (
                        <div className="text-[11px] text-zinc-400 mb-1 flex items-center gap-1 font-mono">
                          <span>Context:</span>
                          <span className="text-zinc-200 underline">
                            {m.artifactName}
                          </span>
                        </div>
                      )}
                      <div className="whitespace-pre-wrap">{m.content}</div>
                    </div>
                    {m.createdAt && (
                      <span className="text-[10px] text-[#737373] mt-1 px-1 tracking-tight font-mono">
                        {new Date(m.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          hour12: false,
                        })}
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2.5 sm:gap-3 w-full">
                  <div className="size-6 sm:size-7 shrink-0 flex items-center justify-center mt-0.5">
                    <img
                      src="/logo.png"
                      alt="Syra"
                      className="size-full object-contain rounded-full"
                      onError={(e) => {
                        ;(e.currentTarget as HTMLElement).style.display = "none"
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0 max-w-[90%] sm:max-w-[680px]">
                    <div className="text-[15px] sm:text-[15.5px] leading-[1.6] font-normal text-[#F5F5F5] break-words overflow-hidden whitespace-pre-wrap">
                      {m.content}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {isSending && (
            <div className="flex items-start gap-2.5 sm:gap-3 w-full">
              <div className="size-6 sm:size-7 shrink-0 flex items-center justify-center mt-0.5">
                <img
                  src="/logo.png"
                  alt="Syra"
                  className="size-full object-contain rounded-full"
                />
              </div>
              <div className="flex items-center gap-2 text-[14px] sm:text-[13px] text-[#737373] select-none py-1">
                <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span>Syra is thinking...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Main Composer Box - Exact Same Input Bar Style as Website Edit > Syra Input */}
      <div className="w-full max-w-[760px] mx-auto">
        {/* Attached Artifact Context Chip */}
        {selectedArtifact && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="inline-flex items-center gap-2 rounded-[12px] bg-[#1D1D1D] border border-[#292929] px-2.5 py-1 text-xs text-zinc-300">
              <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="font-medium text-[#F5F5F5] truncate max-w-[160px] sm:max-w-[240px]">
                {selectedArtifact.name}
              </span>
              {selectedArtifact.meta && (
                <span className="text-[10px] text-zinc-500 font-mono hidden xs:inline">
                  ({selectedArtifact.meta})
                </span>
              )}
              {onClearArtifact && (
                <button
                  type="button"
                  onClick={onClearArtifact}
                  title="Detach context"
                  className="ml-1 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-zinc-500 hidden sm:inline">
              Active workspace context
            </span>
          </div>
        )}

        {/* Syra Input Container with rounded-[28px], exact bg-[#171717], border-[#292929] */}
        <div className="rounded-[24px] sm:rounded-[28px] border px-2.5 sm:px-3 pt-2 pb-2.5 transition-all bg-[#171717] border-[#292929] focus-within:border-[#383838] shadow-2xl shadow-black/80">
          <textarea
            ref={textareaRef}
            value={prompt}
            disabled={isSending}
            onChange={handleInputChange}
            placeholder={
              isSending
                ? "AI is working on your task..."
                : "Help you write code, debug and ship production-ready work. Type / for skills & integrations."
            }
            className={`w-full bg-transparent text-[14px] sm:text-[15.5px] leading-[1.5] px-2 sm:px-3 pt-1.5 sm:pt-2 pb-2 focus:outline-none resize-none overflow-y-auto max-h-[120px] md:max-h-[200px] ${
              isSending
                ? "cursor-not-allowed text-[#737373] placeholder:text-[#737373]"
                : "text-[#F5F5F5] placeholder:text-[#737373]"
            }`}
            style={{ height: "auto", minHeight: isSending ? "44px" : "64px" }}
            onKeyDown={handleKeyDown}
          />

          {/* Syra Toolbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-1 pt-1">
            {/* Slash Commands Dropdown Button */}
            <DropdownMenu open={showSlashMenu} onOpenChange={setShowSlashMenu}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="Slash commands"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border border-[#292929] bg-[#1D1D1D] text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#202020] transition-colors active:scale-[0.97]"
                >
                  <Slash className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align="start"
                className="w-[min(88vw,16.5rem)] p-2.5 rounded-[18px] border-[#292929] bg-[#171717] text-[#F5F5F5] shadow-2xl shadow-black/80"
              >
                {/* Credit Segment */}
                <div className="p-2.5 rounded-xl bg-[#202020] hover:bg-[#262626] transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-bold tracking-tight text-[#F5F5F5]">
                      5 credit left
                    </span>
                    <div className="w-20 bg-zinc-700/60 rounded-full h-1.5 overflow-hidden flex items-center p-0.5">
                      <div
                        className="bg-[#00a3ff] h-full rounded-full transition-all duration-300"
                        style={{ width: "50%" }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-normal">
                    <span>Remaining balance.</span>
                    <span>Resets daily</span>
                  </div>
                </div>

                <div className="my-1.5 border-b border-white/[0.08]" />

                {/* Upload file */}
                <DropdownMenuItem
                  className="gap-2.5 text-[12px] py-1.5 px-2.5 cursor-pointer rounded-lg text-zinc-200 hover:bg-white/[0.06] focus:bg-white/[0.06]"
                  onSelect={() => {
                    fileInputRef.current?.click()
                    if (prompt.startsWith("/")) setPrompt("")
                  }}
                >
                  <FileUp className="h-3.5 w-3.5 text-zinc-400" />
                  Upload file
                  <span className="ml-auto text-[11px] font-mono text-zinc-500">/file</span>
                </DropdownMenuItem>

                {/* Upload image */}
                <DropdownMenuItem
                  className="gap-2.5 text-[12px] py-1.5 px-2.5 cursor-pointer rounded-lg text-zinc-200 hover:bg-white/[0.06] focus:bg-white/[0.06]"
                  onSelect={() => {
                    fileInputRef.current?.click()
                    if (prompt.startsWith("/")) setPrompt("")
                  }}
                >
                  <ImageIcon className="h-3.5 w-3.5 text-zinc-400" />
                  Upload image
                  <span className="ml-auto text-[11px] font-mono text-zinc-500">/image</span>
                </DropdownMenuItem>

                <div className="my-1.5 border-b border-white/[0.08]" />

                {/* Model Omni Settings */}
                <DropdownMenuItem
                  className="gap-2.5 text-[12px] py-1.5 px-2.5 cursor-pointer rounded-lg text-zinc-200 hover:bg-white/[0.06] focus:bg-white/[0.06]"
                  onSelect={() => {
                    if (prompt.startsWith("/")) setPrompt("")
                    setIsOmniModalOpen(true)
                  }}
                >
                  <Sparkles className="h-3.5 w-3.5 text-zinc-400" />
                  Configure models
                  <span className="ml-auto text-[11px] font-mono text-zinc-500">/models</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Syra ModelEffortSelector with Fast toggle, Effort Levels and Model Families */}
            <ModelEffortSelector
              effort={effortLevel}
              onEffortChange={setEffortLevel}
              selectedModel={selectedModel}
              modelChoices={(availableModelChoices || []).map((c) => {
                const isSelected = c.modelType === selectedModel || c.apiModel === selectedModel
                return {
                  id: c.modelType,
                  label: c.label || c.apiModel,
                  apiModel: c.apiModel,
                  subtitle: c.subtitle,
                  iconUrl: getProviderIconUrl(c.apiModel, true) || c.icon,
                  active: isSelected || c.active,
                  isAiTabActive: isSelected || c.isAiTabActive,
                }
              })}
              isDark={true}
              onModelSelect={(modelId) => {
                const choice = availableModelChoices?.find(
                  (c) => c.modelType === modelId || c.apiModel === modelId
                )
                const targetModel = choice ? choice.modelType : modelId
                setSelectedModel(targetModel)
                try {
                  if (typeof window !== "undefined") {
                    localStorage.setItem("sycord_selected_model", String(targetModel))
                  }
                } catch {}
              }}
              onAddModelsClick={() => {
                setIsOmniModalOpen(true)
              }}
              className="shrink-0"
            />

            {/* Right side controls: Voice input and Send button */}
            <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
              <button
                type="button"
                aria-label="Voice input"
                aria-pressed={isListening}
                onClick={toggleSpeechRecognition}
                className={cn(
                  "flex size-8 sm:size-9 items-center justify-center rounded-[12px] transition-all active:scale-[0.97]",
                  isListening
                    ? "text-red-400 bg-red-500/10"
                    : "text-[#737373] hover:text-[#F5F5F5] hover:bg-[#202020]"
                )}
              >
                <Mic className={cn("size-4 sm:size-5", isListening && "text-red-500 animate-pulse")} />
              </button>

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!prompt.trim() || isSending}
                aria-label="Send"
                className={cn(
                  "flex size-8 sm:size-9 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-[0.97] disabled:cursor-not-allowed",
                  prompt.trim() && !isSending
                    ? "bg-[#F5F5F5] text-[#131313] hover:bg-white shadow-sm"
                    : "bg-[#202020] text-[#737373] border border-[#292929]"
                )}
              >
                <ArrowUp className="size-4 sm:size-4.5" strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Sycord Omni Router Modal */}
      <SycordOmniRouterModal
        open={isOmniModalOpen}
        onOpenChange={setIsOmniModalOpen}
        selectedModel={selectedModel}
        onSelectModel={(modelId) => {
          setSelectedModel(modelId)
        }}
      />
    </div>
  )
}

