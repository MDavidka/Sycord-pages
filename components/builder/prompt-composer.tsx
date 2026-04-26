"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Send, Loader2, Plus, X, Paperclip } from "lucide-react"
import { cn } from "@/lib/utils"

interface PromptComposerProps {
  onSubmit: (prompt: string) => void
  disabled: boolean
  placeholder?: string
}

export function PromptComposer({ onSubmit, disabled, placeholder }: PromptComposerProps) {
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (!input.trim() || disabled) return
    const attachNote = attachments.length > 0
      ? `\n\n[Attached: ${attachments.map(f => f.name).join(", ")}]`
      : ""
    onSubmit(input.trim() + attachNote)
    setInput("")
    setAttachments([])
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    setAttachments(prev => {
      const next = [...prev]
      for (let i = 0; i < files.length && next.length < 5; i++) {
        if (files[i].size <= 10 * 1024 * 1024) next.push(files[i])
      }
      return next
    })
  }

  return (
    <div className="border-t border-border bg-background p-2 sm:p-3">
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2 px-1">
          {attachments.map((f, i) => (
            <div
              key={i}
              className="h-6 pl-2 pr-1 rounded-full bg-muted flex items-center gap-1.5 text-[11px] text-muted-foreground max-w-[160px]"
            >
              <Paperclip className="h-3 w-3 shrink-0" />
              <span className="truncate">{f.name}</span>
              <button
                type="button"
                onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                className="h-4 w-4 rounded-full flex items-center justify-center hover:bg-accent"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5 sm:gap-2">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files)
            if (fileInputRef.current) fileInputRef.current.value = ""
          }}
        />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" />
        </Button>

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault()
              handleSend()
            }
          }}
          placeholder={placeholder ?? "Describe the website you want to build..."}
          disabled={disabled}
          autoFocus
          className={cn(
            "flex-1 min-h-[36px] max-h-[120px] resize-none bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm",
            "placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{ overflow: "auto" }}
        />

        <Button
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={handleSend}
          disabled={!input.trim() || disabled}
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  )
}
