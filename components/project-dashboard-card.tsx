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
  const displayDomain = domain ? domain.replace(/^https?:\/\//, "") : "sycord.com"
  const displayUrl = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "#"
  const resolvedIcon = profileImage || null

  return (
    <div className="group relative flex items-center justify-between rounded-[22px] border border-border/80 bg-surface/90 hover:bg-surface hover:border-border-strong text-foreground p-4 sm:p-5 transition-all duration-200 shadow-sm active:scale-[0.99]">
      <Link
        href={`/dashboard/sites/${projectId}`}
        className="flex items-center gap-3.5 min-w-0 flex-1 focus:outline-none"
      >
        {/* Octopus / Project Avatar */}
        <div className="size-11 rounded-[14px] bg-surface-raised border border-border-subtle flex items-center justify-center shrink-0 overflow-hidden group-hover:border-border transition-colors">
          {resolvedIcon ? (
            <img
              src={resolvedIcon}
              alt={businessName}
              className="size-full object-cover"
              onError={(e) => {
                ;(e.currentTarget as HTMLElement).style.display = "none"
              }}
            />
          ) : (
            <div className="size-full flex items-center justify-center bg-sky-500/10 text-sky-400">
              <svg className="size-6 text-sky-400" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a6 6 0 0 0-6 6v1c0 .6.4 1 1 1h.1c.5 0 .9-.4 1-.9.4-2.3 2.1-4.1 4.5-4.1s4.1 1.8 4.5 4.1c.1.5.5.9 1 .9h.1c.6 0 1-.4 1-1V8a6 6 0 0 0-6-6zm-7 9c-.6 0-1 .4-1 1v4c0 1.7 1.3 3 3 3 .6 0 1-.4 1-1s-.4-1-1-1c-.6 0-1-.4-1-1v-4c0-.6-.4-1-1-1zm14 0c-.6 0-1 .4-1 1v4c0 .6-.4 1-1 1s-1 .4-1 1c0 .6.4 1 1 1 1.7 0 3-1.3 3-3v-4c0-.6-.4-1-1-1zm-10 1c-.6 0-1 .4-1 1v5c0 .6.4 1 1 1s1-.4 1-1v-5c0-.6-.4-1-1-1zm6 0c-.6 0-1 .4-1 1v5c0 .6.4 1 1 1s1-.4 1-1v-5c0-.6-.4-1-1-1zm-3 1c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <h3 className="text-sm sm:text-base font-semibold text-foreground group-hover:text-white transition-colors leading-tight truncate">
            {businessName}
          </h3>
          <span className="text-xs text-text-muted transition-colors truncate mt-0.5">
            {displayDomain}
          </span>
        </div>
      </Link>

      {/* Action Button & Dropdown Menu */}
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <Link
          href={`/dashboard/sites/${projectId}`}
          className="inline-flex items-center justify-center h-8 sm:h-9 px-4 rounded-[12px] bg-surface-raised hover:bg-surface-muted border border-border/80 text-xs font-medium text-foreground transition-all active:scale-[0.97]"
        >
          Manage
        </Link>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Project actions"
              className="size-8 sm:size-9 rounded-[10px] text-text-muted hover:text-foreground hover:bg-surface-muted transition-all"
            >
              <MoreHorizontal className="size-4" strokeWidth={1.75} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40 bg-surface border border-border text-foreground shadow-2xl rounded-[16px] p-1.5">
            <DropdownMenuItem asChild>
              <Link
                href={`/dashboard/sites/${projectId}`}
                className="cursor-pointer flex items-center gap-2 text-xs hover:bg-surface-muted focus:bg-surface-muted rounded-[10px] py-2 px-2.5 text-text-secondary hover:text-foreground"
              >
                <Settings className="size-3.5 text-text-muted" strokeWidth={1.75} />
                <span>Settings</span>
              </Link>
            </DropdownMenuItem>
            {displayUrl !== "#" && (
              <DropdownMenuItem asChild>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer flex items-center gap-2 text-xs hover:bg-surface-muted focus:bg-surface-muted rounded-[10px] py-2 px-2.5 text-text-secondary hover:text-foreground"
                >
                  <ExternalLink className="size-3.5 text-text-muted" strokeWidth={1.75} />
                  <span>Visit Live</span>
                </a>
              </DropdownMenuItem>
            )}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(projectId)}
                className="cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 flex items-center gap-2 text-xs rounded-[10px] py-2 px-2.5"
              >
                <Trash2 className="size-3.5 text-destructive" strokeWidth={1.75} />
                <span>Delete</span>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
