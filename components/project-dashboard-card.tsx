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
import { MoreVertical, Settings, Trash2, Calendar, ExternalLink, Globe } from "lucide-react"

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
    <div className="group relative flex flex-col justify-between rounded-[18px] sm:rounded-[20px] bg-[#18181b]/80 hover:bg-[#1f1f23] border border-[#27272a] hover:border-[#3f3f46] text-white p-5 transition-all duration-200 shadow-sm hover:shadow-md min-h-[148px]">
      {/* Clickable primary area */}
      <Link
        href={`/dashboard/sites/${projectId}`}
        className="absolute inset-0 z-0 rounded-[18px] sm:rounded-[20px] focus:outline-none focus:ring-2 focus:ring-primary/40"
        aria-label={`Open project ${businessName}`}
      />

      {/* Top Header Row */}
      <div className="relative z-10 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3.5 min-w-0">
          {/* Project Icon container (48-52px) */}
          <div className="h-12 w-12 rounded-[14px] bg-[#222226] border border-[#2f2f35] flex items-center justify-center shrink-0 overflow-hidden shadow-inner">
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
            <h3 className="text-[17px] sm:text-[18px] font-semibold text-zinc-100 truncate group-hover:text-primary transition-colors leading-snug">
              {businessName}
            </h3>
            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[13px] sm:text-[14px] text-zinc-400 hover:text-zinc-200 transition-colors truncate flex items-center gap-1 leading-snug z-20"
                title={displayDomain}
              >
                <span>{displayDomain}</span>
                <ExternalLink className="h-3 w-3 opacity-60 shrink-0" />
              </a>
            </div>
          </div>
        </div>

        {/* Top Right: Status & Actions */}
        <div className="relative z-20 flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-zinc-900/60 border border-zinc-800 text-[11px]"
            title={isLive ? "Deployment is live" : "Building or preparing"}
          >
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                  isLive ? "bg-emerald-400" : "bg-amber-400"
                } opacity-75`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  isLive ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                }`}
              />
            </span>
            <span className="text-zinc-400 font-medium text-[10px] hidden sm:inline">
              {isLive ? "Live" : "Building"}
            </span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 bg-[#1c1d21] border-[#2c2d33] text-zinc-200 z-50">
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/sites/${projectId}`}
                  className="cursor-pointer flex items-center gap-2 text-sm"
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

      {/* Bottom Metadata Footer */}
      <div className="relative z-10 flex flex-col gap-1 mt-4 pt-3.5 border-t border-[#27272a]/70 text-[13px] sm:text-[14px] text-zinc-400">
        {isGitConnected ? (
          <div className="flex items-center justify-between gap-2">
            <span className="font-mono text-zinc-300 truncate max-w-[180px]">
              {fullGitName}
            </span>
            <span className="text-zinc-500 shrink-0">{gitTimeAgo}</span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2 text-zinc-500">
            <span className="flex items-center gap-1.5 truncate">
              <Globe className="h-3.5 w-3.5 shrink-0 opacity-70" />
              <span>Sycord Hosted</span>
            </span>
            <span className="shrink-0">{createdTimeAgo || "Recently"}</span>
          </div>
        )}
      </div>
    </div>
  )
}
