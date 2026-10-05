"use client"

import React, { useState, useRef, useEffect } from "react"
import { ArrowUp, Mic, MicOff, Sparkles, ChevronDown, Paperclip, X, Check, Code2, Globe, Database, Terminal, Shield, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { DashboardArtifact } from "./dashboard-artifact-card"

interface AiComposerProps {
  selectedArtifact: DashboardArtifact | null
  onClearArtifact?: () => void
  onSubmit: (prompt: string, artifact: DashboardArtifact | null, modelId: string) => void
  isSubmitting?: boolean
  className?: string
}

const AVAILABLE_MODELS = [
  { id: "nova-micro", name: "Nova Micro", badge: "Fastest", provider: "syra" },
  { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", badge: "Smart", provider: "google" },
  { id: "claude-3-7-sonnet", name: "Claude 3.7 Sonnet", badge: "Pro", provider: "anthropic" },
  { id: "deepseek-v3", name: "DeepSeek V3", badge: "Reasoning", provider: "deepseek" },
  { id: "gpt-4o", name: "GPT-4o", badge: "Omni", provider: "openai" },
]

const SKILL_SHORTCUTS = [
  { trigger: "/code", label: "Code Assistant", desc: "Write, edit, and debug fullstack components" },
  { trigger: "/design", label: "Design System", desc: "Apply Arc & Shadcn themes, fix mobile layouts" },
  { trigger: "/deploy", label: "Deploy & DNS", desc: "Manage domains, SSL, and server health" },
  { trigger: "/seo", label: "SEO & Performance", desc: "Optimize page speed and search rankings" },
]

export function AiComposer({
  selectedArtifact,
  onClearArtifact,
  onSubmit,
  isSubmitting = false,
  className,
}: AiComposerProps) {
  const [prompt, setPrompt] = useState("")
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0])
  const [isListening, setIsListening] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea as user types
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      const newHeight = Math.min(textareaRef.current.scrollHeight, 180)
      textareaRef.current.style.height = `${Math.max(newHeight, 64)}px`
    }
  }, [prompt])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!prompt.trim() || isSubmitting) return
    onSubmit(prompt.trim(), selectedArtifact, selectedModel.id)
    setPrompt("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
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
    <div
      className={cn(
        "relative rounded-[26px] border border-[#2a2a2a] bg-[#161616] p-4 sm:p-5 shadow-2xl shadow-black/50 transition-all focus-within:border-[#3d3d3d] focus-within:ring-1 focus-within:ring-zinc-700/50",
        className
      )}
    >
      {/* Attached Artifact Context Chip */}
      {selectedArtifact && (
        <div className="flex items-center gap-2 mb-3">
          <div className="inline-flex items-center gap-2 rounded-[10px] bg-[#1f1f2e] border border-indigo-500/40 px-2.5 py-1 text-xs text-indigo-200">
            <span className="size-1.5 rounded-full bg-indigo-400 animate-pulse" />
            <span className="font-medium text-foreground truncate max-w-[200px]">
              {selectedArtifact.name}
            </span>
            {selectedArtifact.meta && (
              <span className="text-[10px] text-zinc-400 font-mono">
                ({selectedArtifact.meta})
              </span>
            )}
            {onClearArtifact && (
              <button
                type="button"
                onClick={onClearArtifact}
                title="Detach context"
                aria-label="Detach context"
                className="ml-1 text-zinc-400 hover:text-white transition-colors"
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

      {/* Multiline Textarea Composer */}
      <textarea
        ref={textareaRef}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Help you write code, debug and ship production-ready work. Type / for skills & integrations."
        rows={2}
        className="w-full bg-transparent text-sm sm:text-base text-foreground placeholder:text-zinc-500 outline-none resize-none leading-relaxed min-h-[64px]"
      />

      {/* Composer Bottom Action Bar */}
      <div className="flex items-center justify-between pt-3 mt-1 border-t border-[#222222]/80 gap-2 select-none">
        {/* Left: Skills/Slash Shortcut & Model Selector */}
        <div className="flex items-center gap-2">
          {/* Skill Slash Trigger */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Skills & Integrations (/)"
                aria-label="Skills and Integrations"
                className="h-8 px-2.5 rounded-[10px] bg-[#202020] hover:bg-[#282828] border border-[#2e2e2e] text-zinc-300 hover:text-white text-xs font-mono flex items-center gap-1 transition-all active:scale-95 outline-none cursor-pointer"
              >
                <span>/</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 bg-[#181818] border border-[#2a2a2a] text-foreground rounded-[16px] p-1.5 shadow-2xl">
              <DropdownMenuLabel className="text-[11px] font-medium text-text-muted px-2.5 py-1">
                Skills & Integrations
              </DropdownMenuLabel>
              {SKILL_SHORTCUTS.map((skill) => (
                <DropdownMenuItem
                  key={skill.trigger}
                  onClick={() => {
                    setPrompt((prev) => (prev ? `${prev} ${skill.trigger} ` : `${skill.trigger} `))
                    textareaRef.current?.focus()
                  }}
                  className="rounded-[10px] text-xs text-text-secondary hover:text-foreground hover:bg-white/[0.06] cursor-pointer py-2 px-2.5"
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-indigo-400 font-semibold">{skill.trigger}</span>
                      <span className="font-medium text-foreground">{skill.label}</span>
                    </div>
                    <span className="text-[11px] text-text-muted mt-0.5">{skill.desc}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Model Selector */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Select AI Model"
                className="h-8 px-2.5 sm:px-3 rounded-[10px] bg-[#202020] hover:bg-[#282828] border border-[#2e2e2e] text-zinc-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 outline-none cursor-pointer"
              >
                <span>{selectedModel.name}</span>
                <ChevronDown className="size-3 text-zinc-400" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 bg-[#181818] border border-[#2a2a2a] text-foreground rounded-[16px] p-1.5 shadow-2xl">
              <DropdownMenuLabel className="text-[11px] font-medium text-text-muted px-2.5 py-1">
                Select Model
              </DropdownMenuLabel>
              {AVAILABLE_MODELS.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => setSelectedModel(m)}
                  className={cn(
                    "rounded-[10px] text-xs hover:bg-white/[0.06] cursor-pointer py-2 px-2.5 flex items-center justify-between",
                    selectedModel.id === m.id ? "text-foreground font-semibold bg-white/[0.04]" : "text-text-secondary"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span>{m.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-800 text-zinc-400 font-mono">
                      {m.badge}
                    </span>
                  </div>
                  {selectedModel.id === m.id && <Check className="size-3.5 text-indigo-400" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: Microphone / Voice & Submit Arrow Button */}
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
                : "text-zinc-400 hover:text-white hover:bg-white/[0.06]"
            )}
          >
            {isListening ? <MicOff className="size-4" /> : <Mic className="size-4" />}
          </button>

          {/* Upward Submit Button */}
          <button
            type="button"
            title="Send prompt (Enter)"
            aria-label="Send prompt"
            onClick={() => handleSubmit()}
            disabled={!prompt.trim() || isSubmitting}
            className={cn(
              "size-9 rounded-full flex items-center justify-center transition-all outline-none",
              prompt.trim() && !isSubmitting
                ? "bg-white text-black hover:bg-zinc-200 active:scale-95 cursor-pointer shadow-md"
                : "bg-[#252525] text-zinc-500 cursor-not-allowed"
            )}
          >
            <ArrowUp className="size-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  )
}
