'use client'

// The Syra activity feed — a Cursor-like timeline of the agent turn.
//
// Renders, per turn: the user's message, a "Starting" affordance, the thinking
// disclosure (minimal shimmer title), grouped tool/command/file activities, the
// final reply, and any error. Consecutive same-kind activities are grouped
// ("Read 6 files", "Searched 3 times") to match the reference design.

import { memo, useMemo } from 'react'
import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SyraTurn } from '../../lib/useSyraAgent'
import type { SyraActivity } from '../../lib/syra-agent-events'
import { SyraActivityItem } from './SyraActivityItem'
import { SyraThinking } from './SyraThinking'

interface GroupedActivity {
  activity: SyraActivity
  count: number
}

// Collapse consecutive activities of the same kind + status into one row.
function groupActivities(activities: SyraActivity[]): GroupedActivity[] {
  const out: GroupedActivity[] = []
  for (const activity of activities) {
    const last = out[out.length - 1]
    const sameKind = last && last.activity.kind === activity.kind
    const bothFinished =
      last && last.activity.status !== 'running' && activity.status !== 'running'
    // Only group non-detail-critical kinds; keep single-file edits/writes distinct
    // so their paths stay visible.
    const groupable = ['read', 'search', 'list'].includes(activity.kind)
    if (sameKind && bothFinished && groupable) {
      last.count += 1
      // Keep the most recent as representative; drop per-file detail when grouped.
      last.activity = { ...activity, detail: undefined }
    } else {
      out.push({ activity, count: 1 })
    }
  }
  return out
}

function StartingLine({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center gap-1.5 py-1">
      <span
        className={cn(
          'text-[13px] font-medium text-shimmer',
          isDark ? 'text-shimmer-dark' : 'text-shimmer-light',
        )}
      >
        Starting
      </span>
    </div>
  )
}

const SyraTurnView = memo(function SyraTurnView({
  turn,
  isDark,
}: {
  turn: SyraTurn
  isDark: boolean
}) {
  const grouped = useMemo(() => groupActivities(turn.activities), [turn.activities])

  const showStarting =
    turn.phase === 'starting' &&
    turn.activities.length === 0 &&
    turn.thinking.trim().length === 0

  const thinkingActive = turn.phase === 'thinking'

  return (
    <div className="mb-5">
      {/* User message */}
      {turn.userMessage && (
        <div className="mb-3 flex justify-end">
          <div
            className={cn(
              'max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-relaxed',
              isDark ? 'bg-[#26272a] text-[#e5e5e5]' : 'bg-gray-100 text-gray-900',
            )}
          >
            {turn.userMessage}
          </div>
        </div>
      )}

      {/* Agent activity */}
      <div className="space-y-0.5">
        {showStarting && <StartingLine isDark={isDark} />}

        <SyraThinking text={turn.thinking} active={thinkingActive} isDark={isDark} />

        {grouped.map(({ activity, count }) => (
          <SyraActivityItem key={activity.id} activity={activity} count={count} isDark={isDark} />
        ))}

        {/* Final reply */}
        {turn.reply && turn.reply.trim().length > 0 && (
          <div
            className={cn(
              'mt-2 whitespace-pre-wrap text-[15px] leading-relaxed',
              isDark ? 'text-[#e5e5e5]' : 'text-gray-900',
            )}
          >
            {turn.reply}
          </div>
        )}

        {/* Error */}
        {turn.error && (
          <div className="mt-2 flex items-start gap-2 text-[13px] text-red-400">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>{turn.error}</span>
          </div>
        )}
      </div>
    </div>
  )
})

interface SyraActivityFeedProps {
  turns: SyraTurn[]
  isDark?: boolean
}

export const SyraActivityFeed = memo(function SyraActivityFeed({
  turns,
  isDark = true,
}: SyraActivityFeedProps) {
  return (
    <div>
      {turns.map((turn) => (
        <SyraTurnView key={turn.id} turn={turn} isDark={isDark} />
      ))}
    </div>
  )
})
