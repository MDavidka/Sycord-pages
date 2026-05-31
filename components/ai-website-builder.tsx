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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { tierOf, type ModelTier } from "@/lib/credits"

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

const ModelRow = ({ model, selected, onSelect, tier }: { model: ModelOption; selected: boolean; onSelect: () => void; tier: ModelTier }) => (
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

const AIWebsiteBuilder = () => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"

  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])

  const handleSend = () => {
    if (!input.trim()) return
    setInput("")
    setAttachments([])
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center px-3 sm:px-4 overflow-y-auto custom-scrollbar">
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
      </div>

      <div className="w-full pb-8 sm:pb-12 shrink-0">
        <InputBar
          input={input}
          setInput={setInput}
          onSend={handleSend}
          disabled={false}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          attachments={attachments}
          setAttachments={setAttachments}
        />
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
