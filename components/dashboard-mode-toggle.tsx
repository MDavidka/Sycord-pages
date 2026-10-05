"use client"

import React from "react"
import { Folder, BarChart2, ChevronDown } from "lucide-react"
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
        "relative inline-flex items-center rounded-full bg-surface border border-border/80 px-2 py-1.5 shadow-sm select-none",
        className
      )}
    >
      {/* 1. Projects (Lucide Icon) */}
      <button
        type="button"
        role="tab"
        id="dashboard-tab-projects"
        aria-selected={activeMode === "projects"}
        aria-controls="dashboard-panel-projects"
        onClick={() => onChange("projects")}
        title="Projects"
        className={cn(
          "relative z-10 inline-flex items-center justify-center size-9 rounded-full transition-colors outline-none cursor-pointer",
          activeMode === "projects"
            ? "text-foreground"
            : "text-text-muted hover:text-foreground"
        )}
      >
        {activeMode === "projects" && (
          <motion.div
            layoutId={shouldReduceMotion ? undefined : "active-dock-pill"}
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            className="absolute inset-0 rounded-full bg-surface-raised border border-border-strong shadow-xs -z-10"
          />
        )}
        <Folder className="size-4 shrink-0" strokeWidth={1.75} />
      </button>

      {/* Divider */}
      <div className="h-4 w-[1px] bg-border/60 mx-1 shrink-0" />

      {/* 2. Astro (PNG Icon) */}
      <button
        type="button"
        role="tab"
        id="dashboard-tab-astro"
        aria-selected={activeMode === "astro"}
        aria-controls="dashboard-panel-astro"
        onClick={() => onChange("astro")}
        title="Astro AI"
        className={cn(
          "relative z-10 inline-flex items-center justify-center size-9 rounded-full transition-colors outline-none cursor-pointer",
          activeMode === "astro"
            ? "text-foreground"
            : "text-text-muted hover:text-foreground"
        )}
      >
        {activeMode === "astro" && (
          <motion.div
            layoutId={shouldReduceMotion ? undefined : "active-dock-pill"}
            transition={{ type: "spring", stiffness: 450, damping: 35 }}
            className="absolute inset-0 rounded-full bg-surface-raised border border-border-strong shadow-xs -z-10"
          />
        )}
        <img
          src="/astro-icon.png"
          alt="Astro"
          className={cn(
            "size-4 rounded-full object-contain shrink-0 transition-opacity",
            activeMode === "astro" ? "opacity-100" : "opacity-60 hover:opacity-100"
          )}
        />
      </button>

      {/* Divider */}
      <div className="h-4 w-[1px] bg-border/60 mx-1 shrink-0" />

      {/* 3. Stats / Analytics */}
      <button
        type="button"
        title="Analytics & Stats"
        className="inline-flex items-center justify-center size-9 rounded-full text-text-muted hover:text-foreground transition-colors outline-none cursor-pointer"
        onClick={() => {
          // Keep mode active or trigger stats
          onChange("projects")
        }}
      >
        <BarChart2 className="size-4 shrink-0" strokeWidth={1.75} />
      </button>

      {/* Divider */}
      <div className="h-4 w-[1px] bg-border/60 mx-1 shrink-0" />

      {/* 4. Down Bar / Dropdown Trigger */}
      <button
        type="button"
        title="More options"
        className="inline-flex items-center justify-center size-9 rounded-full text-text-muted hover:text-foreground transition-colors outline-none cursor-pointer"
        onClick={() => {
          // toggle or switch
        }}
      >
        <ChevronDown className="size-4 shrink-0" strokeWidth={1.75} />
      </button>
    </div>
  )
}

