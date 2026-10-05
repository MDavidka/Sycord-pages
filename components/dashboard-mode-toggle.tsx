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
      aria-label="Dashboard mode selection"
      className={cn(
        "relative inline-flex items-center rounded-[18px] bg-surface p-1 border border-border select-none",
        className
      )}
    >
      {/* Projects Segment */}
      <button
        type="button"
        role="tab"
        id="dashboard-tab-projects"
        aria-selected={activeMode === "projects"}
        aria-controls="dashboard-panel-projects"
        onClick={() => onChange("projects")}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-[14px] text-xs font-medium transition-colors outline-none cursor-pointer",
          activeMode === "projects"
            ? "text-foreground"
            : "text-text-muted hover:text-text-secondary"
        )}
      >
        {activeMode === "projects" && (
          <motion.div
            layoutId={shouldReduceMotion ? undefined : "active-segmented-pill"}
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            className="absolute inset-0 rounded-[14px] bg-surface-raised border border-border-strong shadow-xs -z-10"
          />
        )}
        <Folder className="size-4 shrink-0" strokeWidth={1.75} />
        <span>Projects</span>
      </button>

      {/* Astro Segment */}
      <button
        type="button"
        role="tab"
        id="dashboard-tab-astro"
        aria-selected={activeMode === "astro"}
        aria-controls="dashboard-panel-astro"
        onClick={() => onChange("astro")}
        className={cn(
          "relative z-10 inline-flex items-center justify-center gap-2 h-9 px-4 rounded-[14px] text-xs font-medium transition-colors outline-none cursor-pointer",
          activeMode === "astro"
            ? "text-foreground"
            : "text-text-muted hover:text-text-secondary"
        )}
      >
        {activeMode === "astro" && (
          <motion.div
            layoutId={shouldReduceMotion ? undefined : "active-segmented-pill"}
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            className="absolute inset-0 rounded-[14px] bg-surface-raised border border-border-strong shadow-xs -z-10"
          />
        )}
        <img
          src="/astro-icon.png"
          alt=""
          aria-hidden="true"
          className={cn(
            "size-4 rounded-full object-contain shrink-0 transition-opacity",
            activeMode === "astro" ? "opacity-100" : "opacity-50"
          )}
        />
        <span>Astro</span>
      </button>
    </div>
  )
}

