"use client"

import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"

type SyraMobileDashboardBarProps = {
  siteName?: string
  onMenu: () => void
}

/** Compact dashboard header shown when Syra back is pressed on mobile (no full navigation). */
export function SyraMobileDashboardBar({ siteName, onMenu }: SyraMobileDashboardBarProps) {
  return (
    <header className="shrink-0 border-b border-white/10 bg-background/95 backdrop-blur-sm z-30">
      <div className="flex h-14 items-center gap-2 px-4">
        <Button variant="ghost" size="icon" onClick={onMenu} className="-ml-2" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
        <span className="font-semibold text-base truncate flex-1">{siteName || "Your site"}</span>
      </div>
    </header>
  )
}
