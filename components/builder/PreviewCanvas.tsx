"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Monitor, Tablet, Smartphone, ExternalLink, Github, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { BuilderState } from "./types"

interface PreviewCanvasProps {
  state: BuilderState
  setDevice: (d: BuilderState["device"]) => void
}

const DEVICE_WIDTHS: Record<BuilderState["device"], number> = {
  desktop: 1280,
  tablet: 768,
  mobile: 390,
}

export function PreviewCanvas({ state, setDevice }: PreviewCanvasProps) {
  const previewUrl = state.deploy?.url
  return (
    <div className="flex h-full flex-col bg-muted/20">
      <div className="flex items-center justify-between gap-2 border-b border-border bg-card/60 backdrop-blur px-3 py-2">
        <div className="flex items-center gap-1 rounded-md bg-muted/40 p-0.5">
          {(["desktop", "tablet", "mobile"] as const).map((d) => (
            <Button
              key={d}
              size="sm"
              variant={state.device === d ? "secondary" : "ghost"}
              onClick={() => setDevice(d)}
              className="h-7 gap-1.5 px-2 text-xs"
              type="button"
            >
              {d === "desktop" && <Monitor className="h-3.5 w-3.5" />}
              {d === "tablet" && <Tablet className="h-3.5 w-3.5" />}
              {d === "mobile" && <Smartphone className="h-3.5 w-3.5" />}
              <span className="capitalize">{d}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          {previewUrl ? (
            <span className="font-mono truncate max-w-[280px]">{previewUrl}</span>
          ) : state.phase === "idle" ? (
            <span>No preview yet — describe a site to start.</span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" />
              {labelFor(state.phase)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {state.deploy?.githubUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              asChild
            >
              <a href={state.deploy.githubUrl} target="_blank" rel="noopener noreferrer">
                <Github className="h-3.5 w-3.5" />
                Repo
              </a>
            </Button>
          )}
          {previewUrl && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 gap-1.5 px-2 text-xs"
              asChild
            >
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                Open
              </a>
            </Button>
          )}
        </div>
      </div>
      <div className="flex flex-1 items-stretch justify-center overflow-auto p-4">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-xl border border-border bg-background shadow-xl transition-[max-width] duration-300 ease-out",
          )}
          style={{ maxWidth: DEVICE_WIDTHS[state.device] }}
        >
          {previewUrl ? (
            <iframe
              key={previewUrl}
              src={previewUrl}
              className="h-full min-h-[640px] w-full"
              title="Generated site preview"
            />
          ) : (
            <SkeletonPreview state={state} />
          )}
        </div>
      </div>
    </div>
  )
}

function labelFor(phase: BuilderState["phase"]): string {
  switch (phase) {
    case "intake":
      return "Reading your brief"
    case "planning":
      return "Planning the sitemap"
    case "designing":
      return "Designing the visual genome"
    case "scaffolding":
      return "Scaffolding the Vite project"
    case "styling":
      return "Generating page JSON"
    case "validating-json":
      return "Validating page JSON"
    case "logic":
      return "Generating logic handlers"
    case "converting":
      return "Converting JSON → TSX"
    case "assembling":
      return "Assembling project files"
    case "building":
      return "Running build"
    case "fixing":
      return "Auto-fixing build errors"
    case "deploying":
      return "Deploying"
    case "done":
      return "Done"
    default:
      return "Idle"
  }
}

function SkeletonPreview({ state }: { state: BuilderState }) {
  return (
    <div className="flex h-full min-h-[640px] flex-col">
      <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-3">
        <div className="h-4 w-24 rounded bg-muted/60" />
        <div className="ml-auto flex items-center gap-2">
          <div className="h-4 w-12 rounded bg-muted/40" />
          <div className="h-4 w-12 rounded bg-muted/40" />
          <div className="h-7 w-20 rounded-md bg-muted/60" />
        </div>
      </div>
      <div className="flex-1 p-8 space-y-6">
        <div className="space-y-3">
          <div className="h-8 w-3/4 rounded bg-muted/50" />
          <div className="h-4 w-1/2 rounded bg-muted/30" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="aspect-[4/3] rounded-xl bg-muted/30" />
          ))}
        </div>
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-muted/30" />
          <div className="h-4 w-5/6 rounded bg-muted/30" />
          <div className="h-4 w-2/3 rounded bg-muted/30" />
        </div>
        {state.phase !== "idle" && (
          <div className="text-center text-xs text-muted-foreground">
            <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
            {labelFor(state.phase)}
            {state.progress[state.phase] && (
              <span className="ml-1 tabular-nums">
                ({state.progress[state.phase]?.done}/{state.progress[state.phase]?.total})
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
