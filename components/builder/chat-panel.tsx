"use client"

import { useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { PipelineEvent } from "@/lib/builder/types"
import { PipelineTimeline } from "./pipeline-timeline"
import { PromptComposer } from "./prompt-composer"

interface ChatMessage {
  id: string
  role: "user" | "system"
  content: string
}

interface ChatPanelProps {
  messages: ChatMessage[]
  events: PipelineEvent[]
  isRunning: boolean
  onSubmit: (prompt: string) => void
}

export function ChatPanel({ messages, events, isRunning, onSubmit }: ChatPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [messages.length, events.length])

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && events.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
            <h2 className="text-xl sm:text-2xl font-semibold">What are we building?</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-sm">
              Describe the website you want and the AI will generate a complete Next.js project.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {[
                "Build a phone shop website",
                "Create a SaaS landing page",
                "Design a portfolio site",
                "Build an admin dashboard",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => onSubmit(example)}
                  disabled={isRunning}
                  className="px-3 py-1.5 rounded-full text-xs border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.length > 0 && (
          <div className="p-3 sm:p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex",
                  msg.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] px-3 py-2 rounded-xl text-sm",
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
          </div>
        )}

        {events.length > 0 && (
          <PipelineTimeline events={events} className="border-t border-border" />
        )}
      </div>

      <PromptComposer
        onSubmit={onSubmit}
        disabled={isRunning}
        placeholder={messages.length > 0 ? "Refine or describe another website..." : undefined}
      />
    </div>
  )
}
