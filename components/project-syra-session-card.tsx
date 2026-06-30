"use client"

import { MessageSquare, Zap, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ProjectChatSessionSummary } from "@/lib/types"

interface ProjectSyraSessionCardProps {
  session: ProjectChatSessionSummary | null
  onOpenChat: () => void
}

function formatRelativeTime(value?: string | Date) {
  if (!value) return ""
  const ts = new Date(value).getTime()
  if (Number.isNaN(ts)) return ""

  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days === 1) return "yesterday"
  if (days < 7) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export function ProjectSyraSessionCard({ session, onOpenChat }: ProjectSyraSessionCardProps) {
  const hasMessages = (session?.messageCount ?? 0) > 0

  return (
    <div
      className="rounded-[18px] sm:rounded-[22px] p-4 sm:p-5 flex flex-col gap-4"
      style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
          >
            <Zap className="h-4 w-4 text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[15px] sm:text-[16px] font-semibold text-zinc-100 truncate">
              {hasMessages ? session?.title || "Syra Chat" : "Syra AI Builder"}
            </p>
            <p className="text-[12px] sm:text-[13px] text-zinc-500 mt-0.5">
              {hasMessages
                ? `${session?.messageCount} message${session?.messageCount === 1 ? "" : "s"} saved for this project`
                : "Start a conversation to build your site with AI"}
            </p>
          </div>
        </div>
        {hasMessages && session?.updatedAt && (
          <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-zinc-500 tabular-nums">
            <Clock className="h-3 w-3" />
            {formatRelativeTime(session.updatedAt)}
          </span>
        )}
      </div>

      <Button
        type="button"
        onClick={onOpenChat}
        className="w-full sm:w-auto self-start rounded-full h-9 px-4 text-[13px] font-semibold"
        variant={hasMessages ? "default" : "outline"}
      >
        <MessageSquare className="h-4 w-4 mr-2" />
        {hasMessages ? "Continue in Syra" : "Open Syra"}
      </Button>
    </div>
  )
}
