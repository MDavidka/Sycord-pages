"use client"

import React from "react"
import { Folder } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
    <Tabs
      value={activeMode}
      onValueChange={(v) => onChange(v as DashboardMode)}
      className={cn("w-auto", className)}
    >
      <TabsList
        className={cn(
          "h-10 p-1 rounded-[12px]",
          "bg-[#17181b] border border-[#2b2d31]",
          "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
        )}
      >
        {/* Projects tab */}
        <TabsTrigger
          value="projects"
          className={cn(
            "h-8 px-3.5 gap-2 rounded-[9px] text-[13.5px] font-medium transition-all duration-150 select-none",
            "text-zinc-500 hover:text-zinc-300",
            "data-[state=active]:bg-[#2b2d31] data-[state=active]:text-zinc-100",
            "data-[state=active]:shadow-[0_1px_4px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]",
            "data-[state=active]:border-[0.5px] data-[state=active]:border-white/[0.07]",
            "focus-visible:ring-2 focus-visible:ring-primary/40"
          )}
        >
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span>your projects</span>
        </TabsTrigger>

        {/* Astro tab */}
        <TabsTrigger
          value="astro"
          className={cn(
            "h-8 px-3.5 gap-2 rounded-[9px] text-[13.5px] font-medium transition-all duration-150 select-none",
            "text-zinc-500 hover:text-zinc-300",
            "data-[state=active]:bg-[#2b2d31] data-[state=active]:text-zinc-100",
            "data-[state=active]:shadow-[0_1px_4px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]",
            "data-[state=active]:border-[0.5px] data-[state=active]:border-white/[0.07]",
            "focus-visible:ring-2 focus-visible:ring-primary/40"
          )}
        >
          <img
            src="/astro-icon.png"
            alt=""
            aria-hidden
            className={cn(
              "h-4 w-4 rounded-full object-contain shrink-0 transition-opacity",
              activeMode === "astro" ? "opacity-100" : "opacity-50"
            )}
          />
          <span>astro</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
