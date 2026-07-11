'use client'

import { FilePenLine, Search, Terminal } from 'lucide-react'
import { Marker, MarkerContent, MarkerIcon } from '@/components/ui/marker'
import { Spinner } from '@/components/ui/spinner'
import type { AgentActivityItem } from '../lib/agentActivity'
import { activityDisplayText, shouldRenderInFeed } from '../lib/agentActivity'

const HIDDEN_MARKER_TYPES = new Set([
  'assistant_message',
  'request_completed',
  'asking_user',
  'token_delta',
  'message_snapshot',
])

function markerIcon(eventType: string) {
  switch (eventType) {
    case 'file_created':
    case 'file_modified':
    case 'file_deleted':
    case 'file_read':
      return FilePenLine
    case 'command_run':
    case 'tool_call':
    case 'mcp_tool_call':
      return Terminal
    default:
      return Search
  }
}

function pickLatestActivity(activities: AgentActivityItem[]): AgentActivityItem | null {
  const visible = activities.filter(
    (a) => shouldRenderInFeed(a.eventType) && !HIDDEN_MARKER_TYPES.has(a.eventType),
  )
  return visible[visible.length - 1] ?? null
}

interface SyraAgentMarkerProps {
  activities: AgentActivityItem[]
  isLive?: boolean
  isDark?: boolean
  label?: string
}

/** Single shadcn Marker for the current agent step — only while streaming. */
export function SyraAgentMarker({
  activities,
  isLive = false,
  isDark = true,
  label: labelOverride,
}: SyraAgentMarkerProps) {
  if (!isLive && !labelOverride) return null

  const latest = pickLatestActivity(activities)
  const label = labelOverride || (latest ? activityDisplayText(latest) : 'Working…')
  const Icon = latest ? markerIcon(latest.eventType) : Search
  const shimmer = `text-shimmer ${isDark ? 'text-shimmer-dark' : 'text-shimmer-light'}`

  return (
    <div className="mb-2">
      <Marker role="status" className={isDark ? 'text-[#6b6c6f]' : undefined}>
        <MarkerIcon>
          {isLive ? <Spinner className="size-3.5" /> : <Icon className="size-3.5 opacity-70" />}
        </MarkerIcon>
        <MarkerContent className={isLive ? shimmer : undefined}>{label}</MarkerContent>
      </Marker>
    </div>
  )
}
