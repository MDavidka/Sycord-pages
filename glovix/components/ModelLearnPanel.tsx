'use client'

import { memo, useCallback } from 'react'
import { ChevronLeft, Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ModelLearnEntry } from '../lib/model-learn'
import { exportModelLearnLog } from '../lib/model-learn'

interface ModelLearnPanelProps {
  entries: ModelLearnEntry[]
  isDark?: boolean
  onClose: () => void
  /** Compact inline strip under a chat segment */
  compact?: boolean
  filterToolCallIds?: string[]
}

function StatusMarker({ success }: { success: boolean }) {
  return (
    <span
      className={cn(
        'inline-block h-0 w-0 flex-shrink-0 border-y-[5px] border-y-transparent border-l-[8px]',
        success ? 'border-l-emerald-500' : 'border-l-red-500',
      )}
      aria-hidden
    />
  )
}

const LearnEntryRow = memo(function LearnEntryRow({
  entry,
  isDark,
  defaultExpanded,
}: {
  entry: ModelLearnEntry
  isDark: boolean
  defaultExpanded?: boolean
}) {
  const label =
    entry.toolName === 'executeCommand'
      ? `Command finished ${entry.displayLabel}`
      : `${entry.toolName} ${entry.displayLabel}`.trim()

  return (
    <div className="space-y-2">
      <div
        className={cn(
          'flex items-center gap-2 rounded-full px-3 py-2',
          isDark ? 'bg-[#26272a]' : 'bg-gray-100',
        )}
      >
        <StatusMarker success={entry.success} />
        <span className={cn('min-w-0 flex-1 truncate text-[13px]', isDark ? 'text-[#e5e5e5]' : 'text-gray-800')}>
          {label}
        </span>
      </div>
      <div className={cn('space-y-1 pl-1 text-[12px]', isDark ? 'text-[#9a9b9e]' : 'text-gray-600')}>
        <p>
          <span className={isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}>call reason </span>
          {entry.reason || '—'}
        </p>
        <details open={defaultExpanded || !entry.success} className="group">
          <summary className={cn('cursor-pointer select-none', isDark ? 'text-[#6b6c6f]' : 'text-gray-400')}>
            output
          </summary>
          <pre
            className={cn(
              'mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-lg p-2 text-[11px] leading-relaxed',
              isDark ? 'bg-[#141516] text-[#c5c6c9]' : 'bg-gray-50 text-gray-700',
            )}
          >
            {entry.output || '—'}
          </pre>
        </details>
      </div>
    </div>
  )
})

export const ModelLearnStrip = memo(function ModelLearnStrip({
  entries,
  isDark = true,
  filterToolCallIds,
}: Omit<ModelLearnPanelProps, 'onClose'>) {
  const filtered = filterToolCallIds?.length
    ? entries.filter((e) => e.toolCallId && filterToolCallIds.includes(e.toolCallId))
    : entries.slice(-3)

  if (filtered.length === 0) return null

  return (
    <div className={cn('mt-2 space-y-3 border-t pt-2', isDark ? 'border-[#2a2b2e]' : 'border-gray-200')}>
      <p className={cn('text-[10px] font-medium uppercase tracking-wide', isDark ? 'text-[#6b6c6f]' : 'text-gray-400')}>
        Model-learn
      </p>
      {filtered.map((entry) => (
        <LearnEntryRow key={entry.id} entry={entry} isDark={isDark} defaultExpanded={!entry.success} />
      ))}
    </div>
  )
})

export const ModelLearnPanel = memo(function ModelLearnPanel({
  entries,
  isDark = true,
  onClose,
}: ModelLearnPanelProps) {
  const handleDownload = useCallback(() => {
    const blob = new Blob([exportModelLearnLog(entries)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `model-learn-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [entries])

  return (
    <div className={cn('fixed inset-0 z-50 flex flex-col', isDark ? 'bg-[#0f1011]' : 'bg-white')}>
      <div
        className={cn(
          'flex items-center gap-3 border-b px-4 py-3',
          isDark ? 'border-[#2a2b2e]' : 'border-gray-200',
        )}
        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Back"
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-xl',
            isDark ? 'text-[#9a9b9e] hover:bg-white/5' : 'text-gray-500 hover:bg-gray-100',
          )}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className={cn('flex-1 text-center text-[15px] font-medium', isDark ? 'text-[#9a9b9e]' : 'text-gray-600')}>
          Model-learn (debug)
        </h1>
        <div className="w-10" />
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
        {entries.length === 0 ? (
          <p className={cn('text-center text-sm pt-8', isDark ? 'text-[#6b6c6f]' : 'text-gray-400')}>
            No tool calls logged yet. Commands and tools appear here with reason and output.
          </p>
        ) : (
          entries.map((entry) => <LearnEntryRow key={entry.id} entry={entry} isDark={isDark} />)
        )}
      </div>

      <div
        className={cn('border-t px-4 py-4', isDark ? 'border-[#2a2b2e]' : 'border-gray-200')}
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}
      >
        <button
          type="button"
          onClick={handleDownload}
          className={cn(
            'mx-auto flex w-full max-w-xs items-center justify-center gap-2 rounded-full py-3 text-[14px] font-medium',
            isDark ? 'bg-[#26272a] text-[#e5e5e5] hover:bg-[#2f3033]' : 'bg-gray-100 text-gray-800 hover:bg-gray-200',
          )}
        >
          <Download className="h-4 w-4" />
          Download (self-log)
        </button>
      </div>
    </div>
  )
})
