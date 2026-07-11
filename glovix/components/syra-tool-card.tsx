'use client'

import { useState, memo } from 'react'
import { ChevronDown, Loader2, Check, X } from 'lucide-react'
import type { SyraToolCallUI } from '../../types/syra'

interface SyraToolCardProps {
  tool: SyraToolCallUI
  isDark?: boolean
}

export const SyraToolCard = memo(function SyraToolCard({ tool, isDark = true }: SyraToolCardProps) {
  const [open, setOpen] = useState(false)
  const running = tool.status === 'running' || tool.status === 'pending'
  const failed = tool.status === 'error'

  return (
    <div
      className={`rounded-xl border text-[13px] ${
        isDark ? 'border-[#2a2b2e] bg-[#141516]/90' : 'border-gray-200 bg-gray-50'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center">
          {running ? (
            <Loader2 className={`h-3.5 w-3.5 animate-spin ${isDark ? 'text-blue-400' : 'text-blue-600'}`} />
          ) : failed ? (
            <X className="h-3.5 w-3.5 text-red-400" />
          ) : (
            <Check className={`h-3.5 w-3.5 ${isDark ? 'text-emerald-400/90' : 'text-emerald-600'}`} />
          )}
        </span>
        <span className={`min-w-0 flex-1 truncate font-medium ${isDark ? 'text-[#d4d4d8]' : 'text-gray-800'}`}>
          {tool.name.replace(/_/g, ' ')}
        </span>
        <span className={`truncate text-[12px] ${isDark ? 'text-[#6b6c6f]' : 'text-gray-500'}`}>
          {tool.detail}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''} ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`}
        />
      </button>
      {open && (
        <div
          className={`border-t px-3 py-2 font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-all ${
            isDark ? 'border-[#2a2b2e] text-[#9a9b9e]' : 'border-gray-200 text-gray-600'
          }`}
        >
          {tool.result || tool.detail}
          {tool.payload && Object.keys(tool.payload).length > 0 && (
            <pre className="mt-2 opacity-80">{JSON.stringify(tool.payload, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  )
})

interface SyraToolCardListProps {
  tools: SyraToolCallUI[]
  isLive?: boolean
  isDark?: boolean
}

export function SyraToolCardList({ tools, isLive, isDark = true }: SyraToolCardListProps) {
  const visible = tools.filter(
    (t) => !['assistant_message', 'request_completed', 'token_delta', 'message_snapshot'].includes(t.name),
  )

  if (!visible.length && !isLive) return null

  return (
    <div className="mb-3 space-y-1.5">
      {isLive && !visible.length && (
        <div className={`flex items-center gap-2 text-[13px] ${isDark ? 'text-[#9a9b9e]' : 'text-gray-500'}`}>
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Agent is starting…</span>
        </div>
      )}
      {visible.map((tool) => (
        <SyraToolCard key={tool.id} tool={tool} isDark={isDark} />
      ))}
    </div>
  )
}
