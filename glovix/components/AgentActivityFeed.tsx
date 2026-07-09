'use client'

import { memo, useMemo } from 'react'
import {
  Brain,
  Check,
  FileCode,
  FileMinus,
  FilePlus,
  Loader2,
  Sparkles,
  Terminal,
  Wrench,
  X,
} from 'lucide-react'
import type { AgentActivityItem } from '../lib/agentActivity'
import { activityDisplayText } from '../lib/agentActivity'

interface AgentActivityFeedProps {
  activities: AgentActivityItem[]
  isLive?: boolean
  isDark?: boolean
}

function ActivityIcon({ eventType, active, isDark }: { eventType: string; active: boolean; isDark: boolean }) {
  const className = `h-3.5 w-3.5 flex-shrink-0 ${active ? (isDark ? 'text-blue-400' : 'text-blue-600') : isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`
  switch (eventType) {
    case 'thinking':
    case 'plan':
      return <Brain className={className} />
    case 'tool_call':
    case 'mcp_tool_call':
    case 'tool_result':
      return <Wrench className={className} />
    case 'skill_invoked':
      return <Sparkles className={className} />
    case 'command_run':
      return <Terminal className={className} />
    case 'file_created':
      return <FilePlus className={className} />
    case 'file_deleted':
      return <FileMinus className={className} />
    case 'file_modified':
    case 'file_read':
      return <FileCode className={className} />
    default:
      return <Sparkles className={className} />
  }
}

const ActivityRow = memo(function ActivityRow({
  item,
  isDark,
}: {
  item: AgentActivityItem
  isDark: boolean
}) {
  const active = item.status === 'running'
  const failed = item.status === 'error'
  const text = activityDisplayText(item)

  return (
    <div className="flex items-start gap-2.5 py-1.5 animate-fade-in">
      <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center">
        {active ? (
          <Loader2 className={`h-3.5 w-3.5 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
        ) : failed ? (
          <X className="h-3.5 w-3.5 text-red-400" />
        ) : (
          <Check className={`h-3.5 w-3.5 ${isDark ? 'text-emerald-400/80' : 'text-emerald-600'}`} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <ActivityIcon eventType={item.eventType} active={active} isDark={isDark} />
          <span
            className={`text-[13px] leading-snug ${
              active
                ? isDark
                  ? 'text-[#d4d4d8]'
                  : 'text-gray-800'
                : failed
                  ? 'text-red-400'
                  : isDark
                    ? 'text-[#a1a1aa]'
                    : 'text-gray-600'
            }`}
          >
            {text}
          </span>
        </div>
      </div>
    </div>
  )
})

export const AgentActivityFeed = memo(function AgentActivityFeed({
  activities,
  isLive = false,
  isDark = true,
}: AgentActivityFeedProps) {
  const visible = useMemo(
    () => activities.filter((a) => a.eventType !== 'assistant_message' && a.eventType !== 'request_completed'),
    [activities],
  )

  if (visible.length === 0 && !isLive) return null

  return (
    <div
      className={`mb-3 rounded-2xl border px-3 py-2 ${
        isDark ? 'border-[#2a2b2e] bg-[#141516]/80' : 'border-gray-200 bg-gray-50/80'
      }`}
    >
      {isLive && visible.length === 0 && (
        <div className={`flex items-center gap-2 py-1.5 text-[13px] ${isDark ? 'text-[#9a9b9e]' : 'text-gray-500'}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Agent is starting…</span>
        </div>
      )}
      <div className="space-y-0.5">
        {visible.map((item) => (
          <ActivityRow key={item.key} item={item} isDark={isDark} />
        ))}
      </div>
    </div>
  )
})
