'use client'
import React, { useState, useEffect } from 'react'
import { ChevronDown, ChevronRight, CheckCircle2, Loader2, AlertCircle } from 'lucide-react'
import type { StreamingAction } from './ActionsList'

interface GenerationCardProps {
  actions: StreamingAction[]
  isLive: boolean
  isDark: boolean
  thinking?: string
  thinkingTime?: number
  startTime?: number | null
}

function getCardSummary(actions: StreamingAction[], isLive: boolean): string {
  if (actions.length === 0) return isLive ? 'Working\u2026' : 'Done'
  const running = actions.filter(a => a.status === 'running')
  const done = actions.filter(a => a.status === 'done')
  const errors = actions.filter(a => a.status === 'error')
  if (isLive && running.length > 0) {
    const current = running[running.length - 1]
    const toolLabel = current.toolName?.replace(/([A-Z])/g, ' $1').trim() || 'Processing\u2026'
    return current.displayName ? `${toolLabel} \u2014 ${current.displayName}` : toolLabel
  }
  const parts: string[] = []
  if (done.length > 0) parts.push(`${done.length} step${done.length > 1 ? 's' : ''} completed`)
  if (errors.length > 0) parts.push(`${errors.length} error${errors.length > 1 ? 's' : ''}`)
  return parts.join(', ') || 'Done'
}

export function GenerationCard({
  actions,
  isLive,
  isDark,
  thinking,
  thinkingTime,
  startTime,
}: GenerationCardProps) {
  const [open, setOpen] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const hasContent = actions.length > 0 || !!thinking
  const hasErrors = actions.some(a => a.status === 'error')
  const summary = getCardSummary(actions, isLive)

  useEffect(() => {
    if (!isLive || !startTime) return
    setElapsed(Math.max(1, Math.round((Date.now() - startTime) / 1000)))
    const t = setInterval(() => {
      setElapsed(Math.max(1, Math.round((Date.now() - startTime) / 1000)))
    }, 1000)
    return () => clearInterval(t)
  }, [isLive, startTime])

  return (
    <div
      className={`w-full rounded-2xl overflow-hidden transition-all ${
        isDark
          ? 'bg-[#1c1d1f] border border-[#2a2b2e]'
          : 'bg-gray-50 border border-gray-200'
      } ${
        isLive
          ? isDark
            ? 'shadow-[0_0_0_1px_rgba(99,102,241,0.15),0_0_16px_rgba(99,102,241,0.08)]'
            : 'shadow-[0_0_0_1px_rgba(99,102,241,0.10),0_0_12px_rgba(99,102,241,0.06)]'
          : ''
      }`}
    >
      {/* Header row */}
      <button
        type="button"
        onClick={() => hasContent && setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
          hasContent
            ? isDark ? 'hover:bg-white/5 cursor-pointer' : 'hover:bg-black/5 cursor-pointer'
            : 'cursor-default'
        }`}
      >
        {/* Status icon */}
        <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
          {isLive ? (
            <Loader2 className={`h-4 w-4 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
          ) : hasErrors ? (
            <AlertCircle className="h-4 w-4 text-amber-500" />
          ) : (
            <CheckCircle2 className={`h-4 w-4 ${isDark ? 'text-[#444]' : 'text-gray-300'}`} />
          )}
        </span>

        {/* Summary + optional elapsed */}
        <span className={`flex-1 min-w-0 text-[13px] font-medium truncate ${
          isDark ? 'text-[#c5c6c9]' : 'text-gray-600'
        }`}>
          {summary}
          {isLive && startTime && !thinkingTime && (
            <span className={`ml-1.5 text-[11px] font-normal tabular-nums ${
              isDark ? 'text-[#555]' : 'text-gray-400'
            }`}>{elapsed}s</span>
          )}
        </span>

        {/* Step count badge */}
        {actions.length > 0 && (
          <span className={`flex-shrink-0 text-[11px] px-1.5 py-0.5 rounded-md font-medium ${
            isDark ? 'bg-[#2a2b2e] text-[#666]' : 'bg-gray-200 text-gray-500'
          }`}>
            {actions.length}
          </span>
        )}

        {/* Chevron */}
        {hasContent && (
          <span className="flex-shrink-0">
            {open ? (
              <ChevronDown className={`h-3.5 w-3.5 ${isDark ? 'text-[#555]' : 'text-gray-400'}`} />
            ) : (
              <ChevronRight className={`h-3.5 w-3.5 ${isDark ? 'text-[#555]' : 'text-gray-400'}`} />
            )}
          </span>
        )}
      </button>

      {/* Expandable body */}
      {open && hasContent && (
        <div className={`border-t px-4 pb-3 pt-2 space-y-1.5 ${
          isDark ? 'border-[#2a2b2e]' : 'border-gray-200'
        }`}>
          {/* Thinking block */}
          {thinking && (
            <div className={`text-[12px] leading-relaxed whitespace-pre-wrap px-3 py-2 rounded-xl mb-1.5 ${
              isDark
                ? 'bg-[#18191b] text-[#555] border border-[#232426]'
                : 'bg-white text-gray-400 border border-gray-100'
            }`}>
              <span className={`text-[11px] font-semibold block mb-1 ${
                isDark ? 'text-[#666]' : 'text-gray-400'
              }`}>
                {thinkingTime ? `Thought for ${thinkingTime}s` : startTime ? 'Thinking\u2026' : 'Reasoning'}
              </span>
              {thinking.slice(0, 500)}{thinking.length > 500 ? '\u2026' : ''}
            </div>
          )}

          {/* Action rows */}
          {actions.map(action => (
            <div
              key={action.id}
              className={`flex items-start gap-2.5 py-1.5 px-3 rounded-xl text-[12px] ${
                isDark ? 'bg-[#18191b]' : 'bg-white border border-gray-100'
              }`}
            >
              <span className="mt-0.5 flex-shrink-0">
                {action.status === 'running' ? (
                  <Loader2 className={`h-3 w-3 animate-spin ${isDark ? 'text-indigo-400' : 'text-indigo-500'}`} />
                ) : action.status === 'error' ? (
                  <AlertCircle className="h-3 w-3 text-red-400" />
                ) : (
                  <CheckCircle2 className={`h-3 w-3 ${isDark ? 'text-[#444]' : 'text-gray-300'}`} />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <span className={`font-medium ${
                  isDark ? 'text-[#9a9b9e]' : 'text-gray-600'
                }`}>
                  {action.toolName?.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}
                </span>
                {action.displayName && (
                  <span className={`ml-1.5 ${
                    isDark ? 'text-[#555]' : 'text-gray-400'
                  }`}>
                    {action.displayName}
                  </span>
                )}
                {action.status === 'error' && action.result && (
                  <p className={`mt-0.5 text-[11px] truncate ${
                    isDark ? 'text-red-400/70' : 'text-red-500/70'
                  }`}>
                    {action.result.slice(0, 120)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
