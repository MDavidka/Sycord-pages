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
      <TabsList className="h-9 items-center justify-center rounded-lg bg-zinc-900/60 p-1 border border-zinc-800/80 text-muted-foreground shadow-xs">
        {/* Projects tab with icon */}
        <TabsTrigger
          value="projects"
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all select-none text-zinc-400 hover:text-zinc-200 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-xs [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          <Folder className="h-3.5 w-3.5 shrink-0" />
          <span>Projects</span>
        </TabsTrigger>

        {/* Astro tab with icon */}
        <TabsTrigger
          value="astro"
          className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1 text-xs font-medium transition-all select-none text-zinc-400 hover:text-zinc-200 data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 data-[state=active]:shadow-xs [&_svg]:pointer-events-none [&_svg]:size-3.5 [&_svg]:shrink-0"
        >
          <img
            src="/astro-icon.png"
            alt=""
            aria-hidden
            className={cn(
              "h-3.5 w-3.5 rounded-full object-contain shrink-0 transition-opacity",
              activeMode === "astro" ? "opacity-100" : "opacity-60"
            )}
          />
          <span>Astro</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
