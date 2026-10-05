"use client"

import React from "react"
import { BarChart3, ChevronDown, FolderKanban } from "lucide-react"
import { cn } from "@/lib/utils"

export type DashboardMode = "projects" | "astro"

interface DashboardModeToggleProps {
  activeMode?: DashboardMode
  onChange?: (mode: DashboardMode) => void
  onAction?: (actionId: string) => void
  className?: string
}

export function DashboardModeToggle({
  activeMode = "projects",
  onChange,
  onAction,
  className,
}: DashboardModeToggleProps) {
  const handleAction = (id: string) => {
    if (id === "projects" || id === "astro") {
      onChange?.(id as DashboardMode)
    }
    onAction?.(id)
  }

  return (
    <div
      role="toolbar"
      aria-label="Floating Action Bar"
      className={cn(
        "relative inline-flex items-center rounded-[50px] bg-[#171717] border border-[#292929] shadow-xl shadow-black/40 px-3 py-2.5 select-none",
        className
      )}
    >
      {/* Section 1: Projects */}
      <button
        type="button"
        aria-label="Projects"
        aria-pressed={activeMode === "projects"}
        onClick={() => handleAction("projects")}
        className={cn(
          "flex items-center justify-center min-w-[68px] sm:min-w-[80px] h-[58px] rounded-full transition-all duration-150 active:scale-95 outline-none cursor-pointer",
          activeMode === "projects" ? "text-white" : "text-[#F0F0F0] hover:text-white hover:bg-white/[0.04]"
        )}
      >
        <FolderKanban className="size-[28px] shrink-0" strokeWidth={2.2} />
      </button>

      {/* Divider 1 */}
      <div className="h-[58px] w-[1px] bg-[#303030] shrink-0" />

      {/* Section 2: Astro */}
      <button
        type="button"
        aria-label="Astro"
        aria-pressed={activeMode === "astro"}
        onClick={() => handleAction("astro")}
        className={cn(
          "flex items-center justify-center min-w-[68px] sm:min-w-[80px] h-[58px] rounded-full transition-all duration-150 active:scale-95 outline-none cursor-pointer",
          activeMode === "astro" ? "text-white" : "text-[#F0F0F0] hover:text-white hover:bg-white/[0.04]"
        )}
      >
        <img src="/astro-icon.png" alt="Astro" className="size-[30px] rounded-[8px] object-cover" />
      </button>

      {/* Divider 2 */}
      <div className="h-[58px] w-[1px] bg-[#303030] shrink-0" />

      {/* Section 3: Stats */}
      <button
        type="button"
        aria-label="Stats"
        onClick={() => handleAction("stats")}
        className="flex items-center justify-center min-w-[68px] sm:min-w-[80px] h-[58px] rounded-full text-[#F0F0F0] hover:text-white hover:bg-white/[0.04] transition-all duration-150 active:scale-95 outline-none cursor-pointer"
      >
        <BarChart3 className="size-[28px] shrink-0" strokeWidth={2.2} />
      </button>

      {/* Divider 3 */}
      <div className="h-[58px] w-[1px] bg-[#303030] shrink-0" />

      {/* Section 4: More options */}
      <button
        type="button"
        aria-label="More options"
        onClick={() => handleAction("more")}
        className="flex items-center justify-center min-w-[68px] sm:min-w-[80px] h-[58px] rounded-full text-[#F0F0F0] hover:text-white hover:bg-white/[0.04] transition-all duration-150 active:scale-95 outline-none cursor-pointer"
      >
        <ChevronDown className="size-[30px] shrink-0" strokeWidth={2.2} />
      </button>
    </div>
  )
}


