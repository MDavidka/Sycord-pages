"use client"

import React, { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Sparkles, AlertCircle } from "lucide-react"
import { PipelineTimeline } from "./PipelineTimeline"
import { PromptComposer } from "./PromptComposer"
import type { BuilderState, ChatMessage, ModelOption } from "./types"

interface BuilderChatPanelProps {
  state: BuilderState
  setPrompt: (v: string) => void
  setAttachments: React.Dispatch<React.SetStateAction<File[]>>
  selectedModel: ModelOption
  setSelectedModel: (m: ModelOption) => void
  onSubmit: () => void
  busy: boolean
  credits: number | null
  bestCost: number
  fastCost: number
  userName: string
}

export function BuilderChatPanel({
  state,
  setPrompt,
  setAttachments,
  selectedModel,
  setSelectedModel,
  onSubmit,
  busy,
  credits,
  bestCost,
  fastCost,
  userName,
}: BuilderChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [state.messages.length, state.phase])

  const isFresh = state.messages.length === 0 && state.phase === "idle"

  return (
    <div className="flex h-full flex-col gap-3 p-3">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-3"
      >
        {isFresh ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
            <div className="rounded-full bg-primary/10 p-3 mb-4">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Hey {userName}, what should we build?</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Describe a site, paste a brief, or attach reference designs. The pipeline plans, designs, builds and deploys it for you.
            </p>
          </div>
        ) : (
          state.messages.map((m) => <MessageBubble key={m.id} message={m} />)
        )}
        {(state.phase !== "idle" && state.phase !== "done") && (
          <div className="rounded-xl border border-border bg-card/40 p-3 mt-2">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
              Pipeline
            </p>
            <PipelineTimeline state={state} />
          </div>
        )}
        {state.error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-destructive" />
            <span className="text-destructive">{state.error}</span>
          </div>
        )}
      </div>
      <PromptComposer
        prompt={state.prompt}
        setPrompt={setPrompt}
        attachments={state.attachments}
        setAttachments={setAttachments}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        onSubmit={onSubmit}
        busy={busy}
        credits={credits}
        bestCost={bestCost}
        fastCost={fastCost}
      />
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user"
  return (
    <div className={cn("flex flex-col gap-1", isUser ? "items-end" : "items-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground"
            : message.isError
              ? "bg-destructive/10 text-destructive border border-destructive/30"
              : "bg-muted/40 text-foreground",
        )}
      >
        {message.content}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {message.attachments.map((a, i) => (
              <span
                key={`${a.name}-${i}`}
                className="inline-flex items-center gap-1 rounded-full bg-background/30 px-2 py-0.5 text-[11px]"
              >
                {a.name}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
