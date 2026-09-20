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
  const isAstro = framework === "astro" || style === "astro" || businessName.toLowerCase().includes("astro")
  const resolvedIcon = profileImage || (isAstro ? "/astro-icon.png" : null)
  const initial = (businessName[0] || "P").toUpperCase()

  return (
    <div className="group relative flex items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/40 hover:bg-zinc-900/80 hover:border-zinc-700/80 text-zinc-100 p-4 sm:p-4.5 transition-all duration-200 shadow-xs hover:shadow-md hover:shadow-black/20">
      {/* Clickable primary area */}
      <Link
        href={`/dashboard/sites/${projectId}`}
        className="absolute inset-0 z-0 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-600/40"
        aria-label={`Open project ${businessName}`}
      />

      {/* Main Content: Minimalist Icon + Info */}
      <div className="relative z-10 flex items-center gap-3.5 min-w-0">
        {/* Modern Minimalist Website Icon container (Vercel Style) */}
        <div className="h-10 w-10 sm:h-11 sm:w-11 rounded-lg bg-zinc-950 border border-zinc-800/90 flex items-center justify-center shrink-0 overflow-hidden shadow-xs relative group-hover:border-zinc-700/90 transition-colors">
          {resolvedIcon ? (
            <img
              src={resolvedIcon}
              alt={businessName}
              className={isAstro ? "h-6 w-6 object-contain" : "h-full w-full object-cover"}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = "none"
              }}
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-b from-zinc-800 to-zinc-950 flex items-center justify-center">
              <span className="text-zinc-200 font-mono text-xs sm:text-sm font-semibold tracking-wider">
                {initial}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <h3 className="text-sm sm:text-[15px] font-medium text-zinc-100 group-hover:text-white transition-colors leading-tight tracking-tight truncate">
            {businessName}
          </h3>
          <div className="flex items-center gap-1.5 mt-1 min-w-0">
            <a
              href={displayUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors truncate flex items-center gap-1 font-mono z-20"
              title={displayDomain}
            >
              <span>{displayDomain}</span>
              <ExternalLink className="h-3 w-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
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
              className="h-8 w-8 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/80 transition-all opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-zinc-950 border border-zinc-800 text-zinc-200 shadow-xl rounded-lg p-1">
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/sites/${projectId}`}
                className="cursor-pointer flex items-center gap-2 text-xs hover:bg-zinc-800 focus:bg-zinc-800 rounded-md py-1.5 px-2.5"
              >
                <Settings className="h-3.5 w-3.5 text-zinc-400" />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            {onDelete && (
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(projectId)
                }}
                className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-950/40 hover:bg-red-950/40 flex items-center gap-2 text-xs rounded-md py-1.5 px-2.5"
              >
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
