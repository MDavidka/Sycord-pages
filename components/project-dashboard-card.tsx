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
import { MoreVertical, Settings, Trash2, ExternalLink } from "lucide-react"

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
  const createdTimeAgo = formatTimeAgo(createdAt)

  const isGitConnected = Boolean(githubRepo && (githubOwner || githubRepo))
  const fullGitName = isGitConnected
    ? githubOwner
      ? `${githubOwner}/${githubRepo}`
      : githubRepo
    : ""
  const gitTimeAgo = formatTimeAgo(githubSavedAt || createdAt)

  const isAstro = framework === "astro" || style === "astro" || businessName.toLowerCase().includes("astro")
  const resolvedIcon = profileImage || (isAstro ? "/astro-icon.png" : "/logo.png")

  return (
    <div className="group relative flex items-center justify-between rounded-[18px] sm:rounded-[20px] bg-[#17181b] hover:bg-[#1e1f22] border border-[#262830] hover:border-[#33363e] text-white p-5 transition-all duration-200 shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
      {/* Clickable primary area */}
      <Link
        href={`/dashboard/sites/${projectId}`}
        className="absolute inset-0 z-0 rounded-[18px] sm:rounded-[20px] focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={`Open project ${businessName}`}
      />

      {/* Main Content: Icon + Info */}
      <div className="relative z-10 flex items-center gap-3.5 min-w-0">
        {/* Project Icon container (48-52px) */}
        <div className="h-12 w-12 rounded-[13px] bg-[#111214] border border-[#272930] flex items-center justify-center shrink-0 overflow-hidden shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          {resolvedIcon ? (
            <img
              src={resolvedIcon}
              alt={businessName}
              className="h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none"
              }}
            />
          ) : (
            <span className="text-zinc-200 font-semibold text-base">
              {(businessName[0] || "P").toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <h3 className="text-[15px] sm:text-[16px] font-semibold text-zinc-100 truncate group-hover:text-white transition-colors leading-snug tracking-[-0.01em]">
            {businessName}
          </h3>
          <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-[12.5px] text-zinc-500 hover:text-zinc-300 transition-colors truncate flex items-center gap-1 leading-snug z-20"
              title={displayDomain}
            >
              <span>{displayDomain}</span>
              <ExternalLink className="h-3 w-3 opacity-50 shrink-0" />
            </a>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="relative z-20 flex items-center gap-1 shrink-0 ml-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-zinc-600 hover:text-zinc-200 hover:bg-[#2b2d31] transition-colors opacity-0 group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-[#17181b] border-[#2b2d31] text-zinc-200 z-50">
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/sites/${projectId}`}
                className="cursor-pointer flex items-center gap-2 text-sm hover:bg-[#2b2d31] focus:bg-[#2b2d31]"
              >
                <Settings className="h-3.5 w-3.5" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(projectId)
                }}
                className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-950/30 flex items-center gap-2 text-sm"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
