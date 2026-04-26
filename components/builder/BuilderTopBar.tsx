"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  Loader2,
  Sparkles,
  RotateCw,
  ExternalLink,
  Github,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuilderState } from "./types"
import { PIPELINE_PHASES } from "./types"

interface BuilderTopBarProps {
  state: BuilderState
  onReset: () => void
}

export function BuilderTopBar({ state, onReset }: BuilderTopBarProps) {
  const isWorking = state.phase !== "idle" && state.phase !== "done"
  const isDone = state.phase === "done"
  const hasError = state.error !== null
  const currentLabel =
    state.phase === "idle"
      ? "Ready"
      : state.phase === "done"
        ? "Done"
        : PIPELINE_PHASES.find((p) => p.id === state.phase)?.label ?? state.phase

  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-card/60 backdrop-blur px-3">
      <div className="flex items-center gap-2 min-w-0">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/15">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight">AI Builder</p>
          <p className="text-[10px] text-muted-foreground leading-tight truncate">
            13-phase pipeline · JSON-first · chrome + design genome
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium",
            hasError && "bg-destructive/15 text-destructive",
            !hasError && isWorking && "bg-primary/15 text-primary",
            !hasError && isDone && "bg-emerald-500/15 text-emerald-300",
            !hasError && !isWorking && !isDone && "bg-muted/40 text-muted-foreground",
          )}
        >
          {hasError ? (
            <AlertTriangle className="h-3 w-3" />
          ) : isWorking ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : isDone ? (
            <CheckCircle2 className="h-3 w-3" />
          ) : null}
          {currentLabel}
          {isWorking && state.progress[state.phase] && (
            <span className="tabular-nums">
              {state.progress[state.phase]?.done}/{state.progress[state.phase]?.total}
            </span>
          )}
        </span>
        {state.deploy?.githubUrl && (
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2" asChild>
            <a href={state.deploy.githubUrl} target="_blank" rel="noopener noreferrer">
              <Github className="h-3.5 w-3.5" />
              <span className="text-[11px]">Repo</span>
            </a>
          </Button>
        )}
        {state.deploy?.url && (
          <Button size="sm" variant="ghost" className="h-7 gap-1.5 px-2" asChild>
            <a href={state.deploy.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-3.5 w-3.5" />
              <span className="text-[11px]">Open</span>
            </a>
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 px-2"
          onClick={onReset}
          disabled={isWorking}
        >
          <RotateCw className="h-3.5 w-3.5" />
          <span className="text-[11px]">New</span>
        </Button>
      </div>
    </div>
  )
}
