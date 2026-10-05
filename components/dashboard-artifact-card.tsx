"use client"

import React from "react"
import { Monitor, FileSpreadsheet, FileCode, FileText, ExternalLink, Check, Trash2, Globe } from "lucide-react"
import { cn } from "@/lib/utils"

export type ArtifactType = "website" | "spreadsheet" | "code" | "document" | "other"

export interface DashboardArtifact {
  id: string
  name: string
  type: ArtifactType
  meta?: string
  url?: string
  profileImage?: string | null
  rawProject?: any
}

interface DashboardArtifactCardProps {
  artifact: DashboardArtifact
  isSelected: boolean
  onSelect: (artifact: DashboardArtifact) => void
  onOpen?: (artifact: DashboardArtifact) => void
  onDelete?: (artifact: DashboardArtifact) => void
}

export function DashboardArtifactCard({
  artifact,
  isSelected,
  onSelect,
  onOpen,
  onDelete,
}: DashboardArtifactCardProps) {
  const getIcon = () => {
    if (artifact.profileImage) {
      return (
        <img
          src={artifact.profileImage}
          alt={artifact.name}
          className="size-7 rounded-[8px] object-cover shrink-0"
          onError={(e) => {
            ;(e.currentTarget as HTMLElement).style.display = "none"
          }}
        />
      )
    }

    switch (artifact.type) {
      case "spreadsheet":
        return (
          <div className="size-8 rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
            <span className="text-[10px] font-bold tracking-tighter">XLS</span>
          </div>
        )
      case "code":
        return (
          <div className="size-8 rounded-[8px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <FileCode className="size-4" strokeWidth={1.75} />
          </div>
        )
      case "document":
        return (
          <div className="size-8 rounded-[8px] bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <FileText className="size-4" strokeWidth={1.75} />
          </div>
        )
      case "website":
      default:
        return (
          <div className="size-8 rounded-[8px] bg-zinc-800/80 border border-zinc-700/50 flex items-center justify-center text-zinc-300 shrink-0">
            <Monitor className="size-4" strokeWidth={1.75} />
          </div>
        )
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(artifact)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect(artifact)
        }
      }}
      className={cn(
        "group relative flex items-center justify-between min-w-[200px] sm:min-w-[220px] max-w-[280px] rounded-[18px] border p-3 sm:p-3.5 transition-all duration-150 select-none cursor-pointer outline-none text-left shrink-0",
        isSelected
          ? "bg-surface-raised border-indigo-500/80 shadow-md ring-1 ring-indigo-500/50"
          : "bg-surface border-border hover:bg-surface-muted hover:border-border-strong"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {getIcon()}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-white transition-colors">
              {artifact.name}
            </span>
            {isSelected && (
              <span className="size-1.5 rounded-full bg-indigo-400 shrink-0" />
            )}
          </div>
          {artifact.meta && (
            <span className="text-[11px] text-text-muted truncate mt-0.5 font-mono">
              {artifact.meta}
            </span>
          )}
        </div>
      </div>

      {/* Quick open / link trigger */}
      {artifact.url && (
        <button
          type="button"
          title="Open in new tab"
          aria-label={`Open ${artifact.name}`}
          onClick={(e) => {
            e.stopPropagation()
            if (onOpen) {
              onOpen(artifact)
            } else {
              window.open(artifact.url, "_blank", "noopener,noreferrer")
            }
          }}
          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1.5 rounded-[8px] text-text-muted hover:text-foreground hover:bg-white/[0.08] transition-all ml-1 shrink-0 cursor-pointer"
        >
          <ExternalLink className="size-3.5" strokeWidth={1.75} />
        </button>
      )}
    </div>
  )
}
