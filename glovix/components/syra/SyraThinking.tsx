'use client'

// Minimal "thinking" affordance for the Syra activity feed.
//
// While the agent is reasoning we show a compact title with a left→right shine
// (the shared .text-shimmer sweep). Once thinking text exists it becomes an
// expandable "Thought" disclosure, mirroring the reference design.

import { memo, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SyraThinkingProps {
  text: string
  /** true while the model is still producing reasoning. */
  active: boolean
  isDark?: boolean
}

export const SyraThinking = memo(function SyraThinking({
  text,
  active,
  isDark = true,
}: SyraThinkingProps) {
  const [expanded, setExpanded] = useState(false)
  const hasText = text.trim().length > 0

  // Nothing to show yet and not actively thinking.
  if (!active && !hasText) return null

  // Active with no text yet → just the shining title.
  if (active) {
    return (
      <div className="flex items-center gap-1.5 py-1">
        <span className={cn('text-[13px] font-medium text-shimmer', isDark ? 'text-shimmer-dark' : 'text-shimmer-light')}>
          Thinking
        </span>
      </div>
    )
  }

  // Finished → collapsible thought.
  return (
    <div className="py-1">
      <button
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          'flex items-center gap-1.5 text-[13px] transition-colors',
          isDark ? 'text-[#6b6c6f] hover:text-[#9a9b9e]' : 'text-gray-400 hover:text-gray-600',
        )}
      >
        <span>Thought</span>
        <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-90')} />
      </button>
      {expanded && hasText && (
        <div
          className={cn(
            'mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed',
            isDark ? 'text-[#8a8b8e]' : 'text-gray-500',
          )}
        >
          {text}
        </div>
      )}
    </div>
  )
})
