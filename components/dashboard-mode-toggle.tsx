"use client"

import React from "react"
import { ChevronDown, CopyPlus, Link2 } from "lucide-react"
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
        "relative inline-flex h-[84px] w-full max-w-[428px] items-center rounded-[24px] border-2 border-[#292929] bg-[#171717] p-1.5 shadow-[0_8px_22px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.025)] select-none",
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
          "flex min-w-0 flex-1 items-center justify-center h-[78px] rounded-full transition-all duration-150 active:scale-[0.98] outline-none cursor-pointer",
          activeMode === "projects" ? "text-white" : "text-[#F0F0F0] hover:text-white hover:bg-white/[0.04]"
        )}
      >
        <Link2 className="size-[31px] shrink-0" strokeWidth={2} />
      </button>

      {/* Divider 1 */}
      <div className="h-[52px] w-px shrink-0 bg-[#343434]" />

      {/* Section 2: Astro */}
      <button
        type="button"
        aria-label="Astro"
        aria-pressed={activeMode === "astro"}
        onClick={() => handleAction("astro")}
        className={cn(
          "flex min-w-0 flex-1 items-center justify-center h-[78px] rounded-full transition-all duration-150 active:scale-[0.98] outline-none cursor-pointer",
          activeMode === "astro" ? "text-white" : "text-[#F0F0F0] hover:text-white hover:bg-white/[0.04]"
        )}
      >
        <CopyPlus className="size-[31px] shrink-0" strokeWidth={1.9} />
      </button>

      {/* Divider 2 */}
      <div className="h-[52px] w-px shrink-0 bg-[#343434]" />

      {/* Section 3: Stats */}
      <button
        type="button"
        aria-label="Stats"
        onClick={() => handleAction("stats")}
        className="flex items-center justify-center min-w-[68px] sm:min-w-[80px] h-[58px] rounded-full text-[#F0F0F0] hover:text-white hover:bg-white/[0.04] transition-all duration-150 active:scale-95 outline-none cursor-pointer"
      >
        <span aria-hidden="true" className="size-[50px] rounded-full bg-[linear-gradient(135deg,#4f83ee_0%,#a993ff_100%)] shadow-[0_0_18px_rgba(102,137,244,0.22)]" />
      </button>

      {/* Divider 3 */}
      <div className="h-[52px] w-px shrink-0 bg-[#343434]" />

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


