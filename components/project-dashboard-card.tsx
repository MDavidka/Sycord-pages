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
import {
  MoreHorizontal,
  Settings,
  Trash2,
  ExternalLink,
  GitBranch,
  Clock,
  Layout,
  Globe,
  Monitor,
} from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"

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
  if (!dateInput) return "Just now"
  const date = new Date(dateInput)
  if (isNaN(date.getTime())) return "Recently"
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

/**
 * Preview icon with distinct glyphs based on project metadata:
 * - "testbest": Syte glyph
 * - "test010": Wireframe layout glyph
 * - "test007": Viewport / monitor mockup glyph
 * - Astro: Astro icon
 * - Default: Monogram fallback
 */
function ProjectPreviewIcon({
  businessName,
  isAstro,
  profileImage,
  resolvedIcon,
}: {
  businessName: string
  isAstro: boolean
  profileImage?: string | null
  resolvedIcon?: string | null
}) {
  const nameLower = businessName.toLowerCase()

  if (resolvedIcon) {
    return (
      <img
        src={resolvedIcon}
        alt={businessName}
        className={isAstro ? "size-6 object-contain" : "size-full object-cover"}
        onError={(e) => {
          ;(e.currentTarget as HTMLElement).style.display = "none"
        }}
      />
    )
  }

  // Card 1 archetype: "testbest" -> "Syte" glyph
  if (nameLower.includes("testbest") || nameLower.includes("syte")) {
    return (
      <div className="flex flex-col items-center justify-center">
        <span className="font-mono text-xs font-bold tracking-tight text-[#F4F4F5]">
          Syte
        </span>
      </div>
    )
  }

  // Card 2 archetype: "test010" -> Wireframe preview icon
  if (nameLower.includes("test010") || nameLower.includes("wireframe")) {
    return (
      <div className="flex items-center justify-center text-[#71717A] group-hover:text-[#F4F4F5] transition-colors">
        <Layout className="size-5 sm:size-5.5" strokeWidth={1.75} />
      </div>
    )
  }

  // Card 3 archetype: "test007" -> Viewport mockup icon
  if (nameLower.includes("test007") || nameLower.includes("viewport") || nameLower.includes("mockup")) {
    return (
      <div className="flex items-center justify-center text-[#71717A] group-hover:text-[#F4F4F5] transition-colors">
        <Monitor className="size-5 sm:size-5.5" strokeWidth={1.75} />
      </div>
    )
  }

  // General fallback
  const initial = (businessName[0] || "P").toUpperCase()
  return (
    <div className="size-full bg-[#1A1A1A] flex items-center justify-center">
      <span className="text-[#71717A] group-hover:text-[#F4F4F5] font-mono text-sm sm:text-base font-medium transition-colors">
        {initial}
      </span>
    </div>
  )
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
  githubBranch = "main",
  githubSavedAt,
  githubCommitMessage,
  profileImage,
}: ProjectDashboardCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const displayDomain = domain ? domain.replace(/^https?:\/\//, "") : "example.com"
  const displayUrl = domain ? (domain.startsWith("http") ? domain : `https://${domain}`) : "#"
  const isAstro = framework === "astro" || style === "astro" || businessName.toLowerCase().includes("astro")
  const resolvedIcon = profileImage || (isAstro ? "/astro-icon.png" : null)
  const timeAgo = formatTimeAgo(githubSavedAt || createdAt)
  const branchName = githubBranch || "main"

  return (
    <motion.div
      whileHover={
        shouldReduceMotion
          ? undefined
          : { y: -2, transition: { type: "spring", visualDuration: 0.22, bounce: 0.1 } }
      }
      whileTap={
        shouldReduceMotion
          ? undefined
          : { scale: 0.985, transition: { type: "spring", visualDuration: 0.22, bounce: 0.1 } }
      }
      className="group relative flex flex-col justify-between rounded-[14px] sm:rounded-2xl border border-[#262626] bg-[#1A1A1A] hover:bg-[#222222] hover:border-[#383838] text-[#F4F4F5] p-3.5 sm:p-4 transition-colors duration-150 focus-within:ring-2 focus-within:ring-zinc-400 focus-within:ring-offset-2 focus-within:ring-offset-[#131313]"
    >
      {/* Primary Clickable Link Area */}
      <Link
        href={`/dashboard/sites/${projectId}`}
        className="absolute inset-0 z-0 rounded-[14px] sm:rounded-2xl focus:outline-none"
        aria-label={`Open project ${businessName}`}
      />

      {/* Top Section: App Preview Icon + Title & URL + Action Menu */}
      <div className="relative z-10 flex items-start justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 sm:gap-3.5 min-w-0 flex-1">
          {/* Concentric Preview Icon: Mobile 44x44px (size-11) rounded-[10px], Desktop 48x48px (size-12) rounded-lg */}
          <div className="size-11 sm:size-12 rounded-[10px] sm:rounded-lg bg-[#222222] border border-[#262626] flex items-center justify-center shrink-0 overflow-hidden relative group-hover:border-[#383838] transition-colors">
            <ProjectPreviewIcon
              businessName={businessName}
              isAstro={isAstro}
              profileImage={profileImage}
              resolvedIcon={resolvedIcon}
            />
          </div>

          {/* Stacked Info */}
          <div className="flex flex-col min-w-0 flex-1">
            <h3 className="text-sm sm:text-base font-medium text-[#F4F4F5] group-hover:text-white transition-colors leading-tight tracking-tight truncate">
              {businessName}
            </h3>
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              <a
                href={displayUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-[#71717A] hover:text-[#F4F4F5] transition-colors truncate flex items-center gap-1 z-20 focus-visible:outline-none focus-visible:underline"
                title={displayDomain}
                aria-label={`Open ${displayDomain}`}
              >
                <span className="truncate">{displayDomain}</span>
                <ExternalLink
                  className="size-3 opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
                  strokeWidth={1.75}
                />
              </a>
            </div>
          </div>
        </div>

        {/* Hover / Focus Triggered Action Menu */}
        <div className="relative z-20 flex items-center shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Project actions"
                className="size-8 rounded-lg text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#2A2A2A] transition-all opacity-80 sm:opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-4" strokeWidth={1.75} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-40 bg-[#1A1A1A] border border-[#262626] text-[#F4F4F5] shadow-2xl rounded-lg p-1.5"
            >
              <DropdownMenuItem asChild>
                <Link
                  href={`/dashboard/sites/${projectId}`}
                  className="cursor-pointer flex items-center gap-2 text-xs hover:bg-[#222222] focus:bg-[#222222] rounded-[6px] py-1.5 px-2 text-[#71717A] hover:text-[#F4F4F5]"
                >
                  <Settings className="size-3.5 text-[#71717A]" strokeWidth={1.75} />
                  <span>Settings</span>
                </Link>
              </DropdownMenuItem>
              {onDelete && (
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(projectId)
                  }}
                  className="cursor-pointer text-red-400 focus:text-red-300 focus:bg-red-950/30 hover:bg-red-950/30 flex items-center gap-2 text-xs rounded-[6px] py-1.5 px-2"
                >
                  <Trash2 className="size-3.5 text-red-400" strokeWidth={1.75} />
                  <span>Delete</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Desktop Git Metadata & Deployment Timestamp Footer */}
      <div className="relative z-10 hidden sm:flex items-center justify-between border-t border-[#262626] pt-3 mt-3 text-[11px] text-[#71717A]">
        <div className="flex items-center gap-1.5 truncate max-w-[65%]">
          <GitBranch className="size-3 shrink-0 text-[#71717A]" strokeWidth={1.75} />
          <span className="truncate font-mono">{branchName}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0 font-mono text-[10.5px]">
          <Clock className="size-2.5 shrink-0 opacity-70" strokeWidth={1.75} />
          <span>{timeAgo}</span>
        </div>
      </div>
    </motion.div>
  )
}
