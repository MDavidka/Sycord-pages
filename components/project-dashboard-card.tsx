"use client"

import React from "react"
import Link from "next/link"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { MoreHorizontal, Settings, Trash2, ExternalLink } from "lucide-react"

export interface ProjectDashboardCardProps {
  fallbackHtml?: string
  domain: string
  isLive?: boolean
  deploymentId?: string
  projectId?: string
  businessName?: string
  createdAt?: string
  chatSession?: { title?: string; messageCount?: number } | null
  onDelete?: (id?: string) => void
  style?: string
  framework?: string
  githubOwner?: string | null
  githubRepo?: string | null
  githubBranch?: string | null
  githubUrl?: string | null
  githubSavedAt?: string | Date | null
  githubCommitMessage?: string | null
  profileImage?: string | null
}

function formatTimeAgo(dateInput?: string | Date | null): string {
  if (!dateInput) return ""
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return ""
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  if (diffHours < 1) {
    const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)))
    return `${diffMins}m ago`
  }
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}d ago`
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

export function ProjectDashboardCard({
  domain,
  isLive = true,
  projectId,
  businessName = "Website",
  createdAt = new Date().toISOString(),
  onDelete,
  style,
  framework,
  githubOwner,
  githubRepo,
  githubBranch,
  githubSavedAt,
  githubCommitMessage,
  profileImage,
}: ProjectDashboardCardProps) {
  const displayDomain = domain ? domain.replace(/^https?:\/\//, "") : "example.com"
  const displayUrl = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "#"
  const isAstro = framework === "astro" || style === "astro" || businessName.toLowerCase().includes("astro")
  const resolvedIcon = profileImage || (isAstro ? "/astro-icon.png" : null)
  const initial = (businessName[0] || "P").toUpperCase()

  return (
    <div className="group relative flex items-center justify-between rounded-[26px] border border-[#292929] bg-[#171717] hover:bg-[#1D1D1D] hover:border-[#383838] text-[#F5F5F5] p-5 sm:p-6 transition-all duration-200 active:scale-[0.99]">
      {/* Clickable primary area */}
      <Link
        href={`/dashboard/sites/${projectId}`}
        className="absolute inset-0 z-0 rounded-[26px] focus:outline-none focus-visible:ring-1 focus-visible:ring-[#383838]"
        aria-label={`Open project ${businessName}`}
      />

      {/* Main Content: 56px Thumbnail Container + Stacked Info */}
      <div className="relative z-10 flex items-center gap-4 min-w-0">
        {/* Normalized 56px Thumbnail Container */}
        <div className="size-14 rounded-[16px] bg-[#1D1D1D] border border-[#222222] flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-[#292929] transition-colors">
          {resolvedIcon ? (
            <img
              src={resolvedIcon}
              alt={businessName}
              className={isAstro ? "size-8 object-contain" : "size-full object-cover"}
              onError={(e) => {
                ;(e.currentTarget as HTMLElement).style.display = "none"
              }}
            />
          ) : (
            <div className="size-full bg-[#1D1D1D] flex items-center justify-center">
              <span className="text-[#A3A3A3] font-mono text-base font-medium">
                {initial}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <h3 className="text-base sm:text-lg font-medium text-[#F5F5F5] group-hover:text-white transition-colors leading-snug tracking-tight truncate">
            {businessName}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs sm:text-sm text-[#737373] hover:text-[#A3A3A3] transition-colors truncate flex items-center gap-1.5 z-20"
              title={displayDomain}
              aria-label={`Open ${displayDomain}`}
            >
              <span className="truncate">{displayDomain}</span>
              <ExternalLink className="size-3.5 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" strokeWidth={1.75} />
            </a>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-20 flex items-center gap-1 shrink-0 ml-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Project actions"
              className="size-9 rounded-[12px] text-[#737373] hover:text-[#F5F5F5] hover:bg-[#202020] transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-[#171717] border border-[#292929] text-[#F5F5F5] shadow-2xl rounded-[16px] p-1.5">
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/sites/${projectId}`}
                className="cursor-pointer flex items-center gap-2 text-xs hover:bg-[#202020] focus:bg-[#202020] rounded-[10px] py-2 px-2.5 text-[#A3A3A3] hover:text-[#F5F5F5]"
              >
                <Settings className="size-3.5 text-[#737373]" strokeWidth={1.75} />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(projectId)
                }}
                className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-950/30 hover:bg-red-950/30 flex items-center gap-2 text-xs rounded-[10px] py-2 px-2.5"
              >
                <Trash2 className="size-3.5 text-red-400" strokeWidth={1.75} />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
