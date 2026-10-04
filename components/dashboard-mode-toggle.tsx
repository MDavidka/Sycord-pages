"use client"

import React from "react"
import { Folder } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
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
  const shouldReduceMotion = useReducedMotion()

  return (
    <div
      role="tablist"
      aria-label="Dashboard mode filter"
      className={cn(
        "inline-flex items-center gap-1.5 sm:gap-2 p-1 rounded-lg sm:rounded-lg bg-[#1A1A1A] border border-[#262626] select-none",
        className
      )}
    >
      {/* Projects Filter Chip */}
      <button
        type="button"
        role="tab"
        id="dashboard-tab-projects"
        aria-selected={activeMode === "projects"}
        aria-controls="dashboard-panel-projects"
        onClick={() => onChange("projects")}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-1.5 h-8 sm:h-7 px-3 sm:px-2.5 rounded-[6px] text-xs font-medium transition-colors outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]",
          activeMode === "projects"
            ? "text-[#F4F4F5]"
            : "text-[#71717A] hover:text-[#F4F4F5]"
        )}
      >
        {activeMode === "projects" && (
          <motion.div
            layoutId={shouldReduceMotion ? undefined : "active-segmented-pill"}
            transition={
              shouldReduceMotion
                ? { duration: 0.12 }
                : { type: "spring", visualDuration: 0.22, bounce: 0.1 }
            }
            className="absolute inset-0 rounded-[6px] bg-[#2A2A2A] border border-[#383838] -z-10 shadow-xs"
          />
        )}
        <Folder className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span>Projects</span>
      </button>

      {/* Astro Filter Chip */}
      <button
        type="button"
        role="tab"
        id="dashboard-tab-astro"
        aria-selected={activeMode === "astro"}
        aria-controls="dashboard-panel-astro"
        onClick={() => onChange("astro")}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-1.5 h-8 sm:h-7 px-3 sm:px-2.5 rounded-[6px] text-xs font-medium transition-colors outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]",
          activeMode === "astro"
            ? "text-[#F4F4F5]"
            : "text-[#71717A] hover:text-[#F4F4F5]"
        )}
      >
        {activeMode === "astro" && (
          <motion.div
            layoutId={shouldReduceMotion ? undefined : "active-segmented-pill"}
            transition={
              shouldReduceMotion
                ? { duration: 0.12 }
                : { type: "spring", visualDuration: 0.22, bounce: 0.1 }
            }
            className="absolute inset-0 rounded-[6px] bg-[#2A2A2A] border border-[#383838] -z-10 shadow-xs"
          />
        )}
        {/* Subtle blue status dot */}
        <span
          className="size-1.5 rounded-full bg-blue-500 shrink-0 shadow-[0_0_6px_rgba(59,130,246,0.6)]"
          aria-hidden="true"
        />
        <span>Astro</span>
      </button>
    </div>
  )
}
