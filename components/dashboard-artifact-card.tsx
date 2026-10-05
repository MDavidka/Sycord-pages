"use client"

import React from "react"
import { Folder, Monitor, FileSpreadsheet, FileCode, FileText, ExternalLink } from "lucide-react"
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
}: DashboardArtifactCardProps) {
  const getIcon = () => {
    if (artifact.profileImage) {
      return (
        <img
          src={artifact.profileImage}
          alt={artifact.name}
          className="size-5 rounded-md object-cover"
          onError={(e) => {
            ;(e.currentTarget as HTMLElement).style.display = "none"
          }}
        />
      )
    }

    switch (artifact.type) {
      case "spreadsheet":
        return <FileSpreadsheet className="size-4 text-zinc-300" strokeWidth={1.8} />
      case "code":
        return <FileCode className="size-4 text-zinc-300" strokeWidth={1.8} />
      case "document":
        return <FileText className="size-4 text-zinc-300" strokeWidth={1.8} />
      case "website":
      default:
        return <Folder className="size-4 text-zinc-300" strokeWidth={1.8} />
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
        "group relative flex flex-col justify-between w-[116px] sm:w-[124px] h-[78px] sm:h-[82px] rounded-[18px] sm:rounded-[20px] p-3 transition-all duration-150 select-none cursor-pointer outline-none text-left shrink-0",
        isSelected
          ? "bg-[#181818] border border-white/20 shadow-md ring-1 ring-white/10"
          : "bg-[#151515] border border-[#242424] hover:bg-[#1a1a1a] hover:border-[#303030]"
      )}
    >
      <div className="flex items-center justify-between w-full">
        {getIcon()}
        {artifact.url && (
          <button
            type="button"
            title="Open"
            aria-label={`Open ${artifact.name}`}
            onClick={(e) => {
              e.stopPropagation()
              if (onOpen) {
                onOpen(artifact)
              } else {
                window.open(artifact.url, "_blank", "noopener,noreferrer")
              }
            }}
            className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-white p-0.5 transition-opacity"
          >
            <ExternalLink className="size-3" />
          </button>
        )}
      </div>

      <div className="w-full">
        <span className="block text-[12px] sm:text-[13px] font-medium text-[#EDEDED] truncate tracking-tight">
          {artifact.name}
        </span>
      </div>
    </div>
  )
}

