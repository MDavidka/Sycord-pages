"use client"

import React from "react"
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
        "relative inline-flex items-center rounded-[50px] bg-[#171717] border border-[#292929] shadow-lg shadow-black/30 px-1.5 py-1.5 select-none",
        className
      )}
    >
      {/* Section 1: Link */}
      <button
        type="button"
        aria-label="Link"
        onClick={() => handleAction("link")}
        className="flex items-center justify-center w-[44px] h-[40px] rounded-full text-[#F0F0F0] hover:text-white hover:bg-white/[0.06] transition-all duration-150 active:scale-95 outline-none cursor-pointer"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[20px] shrink-0"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>
      </button>

      {/* Divider 1 */}
      <div className="h-[28px] w-[1px] bg-[#303030] shrink-0" />

      {/* Section 2: Copy / Add */}
      <button
        type="button"
        aria-label="Copy / Add"
        onClick={() => handleAction("copy-add")}
        className="flex items-center justify-center w-[44px] h-[40px] rounded-full text-[#F0F0F0] hover:text-white hover:bg-white/[0.06] transition-all duration-150 active:scale-95 outline-none cursor-pointer"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[20px] shrink-0"
        >
          <rect width="13" height="13" x="8" y="8" rx="2.5" ry="2.5" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          <line x1="14.5" x2="14.5" y1="11.5" y2="17.5" />
          <line x1="11.5" x2="17.5" y1="14.5" y2="14.5" />
        </svg>
      </button>

      {/* Divider 2 */}
      <div className="h-[28px] w-[1px] bg-[#303030] shrink-0" />

      {/* Section 3: Astro AI Orb (blue/purple gradient circle) */}
      <button
        type="button"
        aria-label="Astro AI"
        onClick={() => handleAction("astro")}
        className="flex items-center justify-center w-[44px] h-[40px] rounded-full hover:bg-white/[0.06] transition-all duration-150 active:scale-95 outline-none cursor-pointer"
      >
        <div
          className="size-[22px] rounded-full shrink-0"
          style={{
            background: "linear-gradient(135deg, #818cf8 0%, #6366f1 40%, #a78bfa 70%, #c4b5fd 100%)",
            boxShadow: "0 0 8px rgba(99,102,241,0.5)",
          }}
        />
      </button>

      {/* Divider 3 */}
      <div className="h-[28px] w-[1px] bg-[#303030] shrink-0" />

      {/* Section 4: ChevronDown */}
      <button
        type="button"
        aria-label="More options"
        onClick={() => handleAction("more")}
        className="flex items-center justify-center w-[44px] h-[40px] rounded-full text-[#F0F0F0] hover:text-white hover:bg-white/[0.06] transition-all duration-150 active:scale-95 outline-none cursor-pointer"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="size-[20px] shrink-0"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  )
}
