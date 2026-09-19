"use client"

import React from "react"
import { Folder, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export type DashboardMode = "projects" | "astro"

interface DashboardModeToggleProps {
  activeMode: DashboardMode
  onChange: (mode: DashboardMode) => void
  className?: string
}

export function DashboardModeToggle({
  activeMode,
  onChange,
  className,
}: DashboardModeToggleProps) {
  return (
    <div
      role="tablist"
      aria-label="Dashboard navigation"
      className={cn(
        "inline-flex items-center p-1 rounded-2xl bg-[#18181b]/90 border border-[#27272a] shadow-inner backdrop-blur-sm",
        className
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeMode === "projects"}
        onClick={() => onChange("projects")}
        className={cn(
          "flex items-center gap-2.5 px-4 py-2 rounded-xl text-[14px] font-medium transition-all duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          activeMode === "projects"
            ? "bg-[#27272a] text-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.35)] font-semibold border border-white/5"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
        )}
      >
        <Folder
          className={cn(
            "h-4 w-4 transition-colors shrink-0",
            activeMode === "projects" ? "text-primary" : "text-zinc-400"
          )}
        />
        <span>Your projects</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeMode === "astro"}
        onClick={() => onChange("astro")}
        className={cn(
          "flex items-center gap-2.5 px-4 py-2 rounded-xl text-[14px] font-medium transition-all duration-200 select-none outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          activeMode === "astro"
            ? "bg-[#27272a] text-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.35)] font-semibold border border-white/5"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
        )}
      >
        <div className="relative flex items-center justify-center shrink-0">
          <img
            src="/astro-icon.png"
            alt="Astro"
            className={cn(
              "h-4 w-4 rounded-full object-cover transition-transform",
              activeMode === "astro" ? "scale-105" : "opacity-80"
            )}
            onError={(e) => {
              // fallback if image not found
              (e.currentTarget as HTMLElement).style.display = "none"
            }}
          />
          <Sparkles className="h-4 w-4 text-purple-400 hidden" />
        </div>
        <span>Astro</span>
      </button>
    </div>
  )
}
