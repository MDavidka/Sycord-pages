"use client"

import { CheckCircle2, Loader2, Circle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { PipelineEvent } from "@/lib/builder/types"

interface PipelineTimelineProps {
  events: PipelineEvent[]
  className?: string
}

function iconForEvent(event: PipelineEvent) {
  if (event.type === "error") return <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />
  if (event.type === "complete") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  if (event.type === "build" && event.buildStatus === "success") return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
  if (event.type === "build" && event.buildStatus === "issues") return <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0" />
  return <Circle className="h-3 w-3 text-muted-foreground shrink-0" />
}

export function PipelineTimeline({ events, className }: PipelineTimelineProps) {
  // Filter to show only meaningful events (phase changes, completions, errors)
  const displayed = events.filter(e =>
    e.type === "phase" ||
    e.type === "plan" ||
    e.type === "build" ||
    e.type === "preview" ||
    e.type === "error" ||
    e.type === "complete"
  )

  if (displayed.length === 0) {
    return (
      <div className={cn("p-4 text-sm text-muted-foreground", className)}>
        Pipeline will show progress here...
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-0.5 p-2 sm:p-3", className)}>
      {displayed.map((event, i) => (
        <div
          key={i}
          className={cn(
            "flex items-start gap-2 py-1 px-2 rounded-md text-xs",
            event.type === "error" ? "bg-destructive/10" : "",
            event.type === "complete" ? "bg-emerald-500/10" : "",
          )}
        >
          <div className="mt-0.5">{iconForEvent(event)}</div>
          <span className={cn(
            "leading-relaxed",
            event.type === "complete" ? "text-emerald-500 font-medium" : "text-muted-foreground",
            event.type === "error" ? "text-destructive" : "",
          )}>
            {event.message}
          </span>
        </div>
      ))}
    </div>
  )
}
