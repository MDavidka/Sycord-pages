"use client"

import React from "react"
import { Check, Loader2, Circle, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { PIPELINE_PHASES, type BuilderPhase, type BuilderState } from "./types"

interface PipelineTimelineProps {
  state: BuilderState
  compact?: boolean
}

function statusFor(
  phaseId: BuilderPhase,
  current: BuilderPhase,
  hasError: boolean,
): "pending" | "active" | "done" | "error" {
  const order = PIPELINE_PHASES.map((p) => p.id)
  const ci = order.indexOf(current)
  const pi = order.indexOf(phaseId)
  if (current === "idle") return "pending"
  if (current === "done") return pi < order.length ? "done" : "done"
  if (hasError && pi === ci) return "error"
  if (pi < ci) return "done"
  if (pi === ci) return "active"
  return "pending"
}

export function PipelineTimeline({ state, compact = false }: PipelineTimelineProps) {
  const hasError = state.error !== null
  return (
    <div
      className={cn(
        "flex flex-col gap-1 text-xs",
        compact ? "max-h-[180px] overflow-y-auto custom-scrollbar pr-1" : "",
      )}
    >
      {PIPELINE_PHASES.map((phase) => {
        const status = statusFor(phase.id, state.phase, hasError)
        const progress = state.progress[phase.id]
        return (
          <div
            key={phase.id}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5",
              status === "active" && "bg-white/5",
              status === "error" && "bg-destructive/10",
            )}
          >
            <span
              className={cn(
                "flex h-4 w-4 items-center justify-center rounded-full",
                status === "done" && "bg-emerald-500/20 text-emerald-300",
                status === "active" && "bg-primary/20 text-primary",
                status === "pending" && "text-zinc-600",
                status === "error" && "bg-destructive/20 text-destructive",
              )}
            >
              {status === "done" && <Check className="h-3 w-3" />}
              {status === "active" && <Loader2 className="h-3 w-3 animate-spin" />}
              {status === "pending" && <Circle className="h-2 w-2" />}
              {status === "error" && <AlertTriangle className="h-3 w-3" />}
            </span>
            <span
              className={cn(
                "flex-1 truncate font-medium",
                status === "active" && "text-foreground",
                status === "done" && "text-zinc-400",
                status === "pending" && "text-zinc-600",
                status === "error" && "text-destructive",
              )}
            >
              {compact ? phase.short : phase.label}
            </span>
            {progress && (
              <span className="text-[10px] text-zinc-500 tabular-nums">
                {progress.done}/{progress.total}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
