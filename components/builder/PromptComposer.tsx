"use client"

import React, { useRef } from "react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Send, Paperclip, X, ChevronDown, Loader2, Coins, Gem } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatCredits, type ModelTier } from "@/lib/credits"
import { MODELS, type ModelOption } from "./types"

interface PromptComposerProps {
  prompt: string
  setPrompt: (v: string) => void
  attachments: File[]
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>
  selectedModel: ModelOption
  setSelectedModel: (m: ModelOption) => void
  onSubmit: () => void
  busy: boolean
  credits: number | null
  bestCost: number
  fastCost: number
  disabled?: boolean
}

const ATTACHMENT_MAX_COUNT = 5
const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024

export function PromptComposer({
  prompt,
  setPrompt,
  attachments,
  setAttachments,
  selectedModel,
  setSelectedModel,
  onSubmit,
  busy,
  credits,
  bestCost,
  fastCost,
  disabled,
}: PromptComposerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const handleFiles = (list: FileList | null) => {
    if (!list) return
    const incoming = Array.from(list).filter((f) => f.size <= ATTACHMENT_MAX_BYTES)
    setAttachments((prev) => [...prev, ...incoming].slice(0, ATTACHMENT_MAX_COUNT))
  }

  const tier: ModelTier = selectedModel.fast ? "fast" : "best"
  const costPerFile = tier === "fast" ? fastCost : bestCost

  return (
    <div className="rounded-2xl border border-border bg-card/60 backdrop-blur p-3 flex flex-col gap-2">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((f, i) => (
            <span
              key={`${f.name}-${i}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1 text-xs"
            >
              <Paperclip className="h-3 w-3 text-muted-foreground" />
              <span className="truncate max-w-[140px]">{f.name}</span>
              <button
                onClick={() => setAttachments((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded-full hover:bg-muted/60 p-0.5"
                aria-label={`Remove ${f.name}`}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !busy && prompt.trim() && !disabled) {
            e.preventDefault()
            onSubmit()
          }
        }}
        placeholder="Describe the website you want to build…"
        rows={3}
        className="resize-none w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        disabled={disabled || busy}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy || disabled}
            type="button"
            aria-label="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-xs font-medium"
                disabled={busy || disabled}
              >
                {selectedModel.fast ? (
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Gem className="h-3.5 w-3.5 text-violet-400" />
                )}
                {selectedModel.name}
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {MODELS.map((m) => (
                <DropdownMenuItem
                  key={m.id}
                  onClick={() => setSelectedModel(m)}
                  className="flex items-start gap-2"
                >
                  {m.fast ? (
                    <Coins className="h-3.5 w-3.5 text-amber-400 mt-0.5" />
                  ) : (
                    <Gem className="h-3.5 w-3.5 text-violet-400 mt-0.5" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{m.name}</span>
                    <span className="text-[11px] text-muted-foreground">{m.provider}</span>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {credits !== null && (
            <span className="ml-1 hidden sm:inline-flex items-center gap-1 rounded-full bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground">
              <Coins className="h-3 w-3" />
              {formatCredits(credits)} (~{costPerFile}/page)
            </span>
          )}
        </div>
        <Button
          size="sm"
          className={cn("h-8 gap-1.5 px-3", busy && "opacity-80")}
          onClick={onSubmit}
          disabled={busy || disabled || !prompt.trim()}
          type="button"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {busy ? "Generating" : "Generate"}
        </Button>
      </div>
    </div>
  )
}
