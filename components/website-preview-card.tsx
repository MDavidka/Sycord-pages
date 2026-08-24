"use client"

import React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { ChevronsUpDown, Settings, Trash2, Calendar } from "lucide-react"

interface WebsitePreviewCardProps {
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

export function WebsitePreviewCard({
  domain,
  isLive = true,
  projectId,
  businessName = "Website",
  createdAt = new Date().toISOString(),
  onDelete,
  githubOwner,
  githubRepo,
  githubBranch,
  githubSavedAt,
  githubCommitMessage,
  profileImage,
}: WebsitePreviewCardProps) {
  const displayDomain = domain ? domain.replace(/^https?:\/\//, "") : "example.com"
  const displayUrl = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "#"
  const formattedCreatedDate = new Date(createdAt).toLocaleDateString("hu-HU")
  const createdTimeAgo = formatTimeAgo(createdAt)

  const isGitConnected = Boolean(githubRepo && (githubOwner || githubRepo))
  const fullGitName = isGitConnected
    ? githubOwner
      ? `${githubOwner}/${githubRepo}`
      : githubRepo
    : ""
  const gitTimeAgo = formatTimeAgo(githubSavedAt || createdAt)

  return (
    <Card className="relative overflow-hidden bg-[#0e0e10] border-[#232328] text-white rounded-2xl transition-all duration-200 hover:border-zinc-700/80 hover:shadow-lg shadow-md">
      <CardContent className="p-4 sm:p-5 flex flex-col gap-3.5">
        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Project Avatar / Icon */}
            <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0 overflow-hidden text-zinc-200 font-semibold text-base shadow-inner">
              {profileImage ? (
                <img src={profileImage} alt={businessName} className="h-full w-full object-cover" />
              ) : (
                (businessName[0] || "P").toUpperCase()
              )}
            </div>

            <div className="flex flex-col min-w-0">
              <Link href={`/dashboard/sites/${projectId}`} className="group/title flex items-center gap-1.5">
                <h3 className="text-base font-semibold text-zinc-100 truncate group-hover/title:text-primary transition-colors leading-tight">
                  {businessName}
                </h3>
              </Link>
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors truncate mt-0.5 leading-snug"
              >
                {displayDomain}
              </a>
            </div>
          </div>

          {/* Top Right Action & Status Indicator */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="relative flex items-center justify-center h-8 w-8 rounded-full bg-zinc-900/80 border border-zinc-800" title={isLive ? "Live" : "Building"}>
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isLive ? "bg-emerald-400" : "bg-amber-400"} opacity-75`} />
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isLive ? "bg-emerald-500" : "bg-amber-500"}`} />
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800/80">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40 bg-zinc-900 border-zinc-800 text-zinc-200">
                <DropdownMenuItem asChild>
                  <Link href={`/dashboard/sites/${projectId}`} className="cursor-pointer flex items-center gap-2">
                    <Settings className="h-3.5 w-3.5" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                {onDelete && (
                  <DropdownMenuItem
                    onClick={() => onDelete(projectId)}
                    className="cursor-pointer text-red-400 focus:text-red-400 focus:bg-red-950/30 flex items-center gap-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Middle Row: Branch / Commit / Date */}
        {isGitConnected ? (
          <div className="flex items-center gap-2 text-xs font-medium text-zinc-200 pt-0.5">
            {/* Git Branch / Commit -o- Icon */}
            <span className="text-zinc-400 shrink-0 flex items-center">
              <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 8H10" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span className="truncate text-zinc-200 font-normal">
              {githubCommitMessage || (githubBranch ? `Branch: ${githubBranch}` : "Latest commit")}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-400 pt-0.5">
            <span className="text-zinc-400 shrink-0 flex items-center">
              <svg className="w-4 h-4 text-zinc-500" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="4" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
                <path d="M6 8H10" stroke="currentColor" strokeWidth="1.5" />
                <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            </span>
            <span className="truncate text-zinc-400">Not connected to Git</span>
          </div>
        )}

        {/* Bottom Row: GitHub SVGL logo + Real Git name + date */}
        {isGitConnected ? (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            {/* Real svgl.app GitHub icon */}
            <img
              src="https://svgl.app/library/github_dark.svg"
              alt="GitHub"
              className="w-4 h-4 shrink-0 filter invert dark:invert-0"
            />
            <span className="font-mono text-zinc-300 truncate">
              {fullGitName}
            </span>
            {gitTimeAgo && (
              <>
                <span className="text-zinc-600">·</span>
                <span className="text-zinc-400 shrink-0">{gitTimeAgo}</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
            <span>Marked date:</span>
            <span className="text-zinc-300 font-medium">{createdTimeAgo || formattedCreatedDate}</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
