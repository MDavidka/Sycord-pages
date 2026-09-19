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
        "inline-flex items-center h-11 sm:h-12 p-1 rounded-[14px] sm:rounded-[16px] bg-[#1e1f22]/90 border border-[#2b2d31] shadow-inner backdrop-blur-sm",
        className
      )}
    >
      <button
        type="button"
        role="tab"
        aria-selected={activeMode === "projects"}
        onClick={() => onChange("projects")}
        className={cn(
          "flex items-center gap-2 h-full px-3.5 sm:px-4 rounded-[10px] sm:rounded-[12px] text-[14px] font-medium transition-all duration-200 select-none outline-none whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary/40",
          activeMode === "projects"
            ? "bg-[#2b2d31] text-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.35)] font-semibold border border-white/5"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
        )}
      >
        <Folder
          className={cn(
            "h-4 w-4 transition-colors shrink-0",
            activeMode === "projects" ? "text-zinc-100" : "text-zinc-400"
          )}
        />
        <span className="whitespace-nowrap">your projects</span>
      </button>

      <button
        type="button"
        role="tab"
        aria-selected={activeMode === "astro"}
        onClick={() => onChange("astro")}
        className={cn(
          "flex items-center gap-2 h-full px-3.5 sm:px-4 rounded-[10px] sm:rounded-[12px] text-[14px] font-medium transition-all duration-200 select-none outline-none whitespace-nowrap focus-visible:ring-2 focus-visible:ring-primary/40",
          activeMode === "astro"
            ? "bg-[#2b2d31] text-zinc-100 shadow-[0_1px_3px_rgba(0,0,0,0.35)] font-semibold border border-white/5"
            : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.03] border border-transparent"
        )}
      >
        <img
          src="/astro-icon.png"
          alt="Astro"
          className={cn(
            "h-5 w-5 rounded-full object-contain shrink-0 transition-opacity",
            activeMode === "astro" ? "opacity-100" : "opacity-75"
          )}
        />
        <span className="whitespace-nowrap">astro</span>
      </button>
    </div>
  )
}
