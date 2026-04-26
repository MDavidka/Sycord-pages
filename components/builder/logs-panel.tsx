"use client"

import type { PipelineEvent } from "@/lib/builder/types"

interface LogsPanelProps {
  events: PipelineEvent[]
}

export function LogsPanel({ events }: LogsPanelProps) {
  if (events.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Pipeline logs will appear here.
      </div>
    )
  }

  return (
    <div className="p-2 font-mono text-[11px] leading-relaxed">
      {events.map((event, i) => {
        const time = new Date(event.timestamp).toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
        const typeLabel = event.type.toUpperCase().padEnd(8)
        const message = event.message ?? JSON.stringify(event).slice(0, 120)

        return (
          <div key={i} className="flex gap-2 py-0.5 hover:bg-muted/30">
            <span className="text-muted-foreground shrink-0">{time}</span>
            <span className="text-primary/70 shrink-0">[{typeLabel}]</span>
            <span className="text-foreground break-all">{message}</span>
          </div>
        )
      })}
    </div>
  )
}
