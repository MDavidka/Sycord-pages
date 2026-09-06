'use client'

import React, { useState, memo } from 'react'
import {
  Brain,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CircleDashed,
  ListTodo,
  FileCode,
  Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ThinkingShimmer } from './loading-states/thinking-shimmer'

export interface StreamActionItem {
  id: string
  toolName: string
  displayName: string
  status: 'pending' | 'running' | 'done' | 'error'
  result?: string
  args?: unknown
  additions?: number
  deletions?: number
  badges?: string[]
  actionKind?: 'file' | 'command' | 'tool' | 'status'
  filePath?: string
  command?: string
}

export interface StreamPlanStep {
  id: string | number
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'active' | 'complete'
  progress?: number
}

export interface StreamPlan {
  id?: string
  title?: string
  steps: StreamPlanStep[]
  totalSteps?: number
  completedSteps?: number
}

export type TimelineSegment =
  | {
      type: 'thinking'
      id: string
      content: string
      duration?: number
      isLive?: boolean
    }
  | {
      type: 'text'
      id: string
      content: string
      isLive?: boolean
    }
  | {
      type: 'action'
      id: string
      action: StreamActionItem
    }
  | {
      type: 'compact_actions'
      id: string
      actions: StreamActionItem[]
    }
  | {
      type: 'plan'
      id: string
      plan: StreamPlan
    }
  | {
      type: 'question'
      id: string
      question: any
    }
  | {
      type: 'tools'
      toolCalls?: any[]
    }

export function getFileBadge(filename: string) {
  const clean = filename.split('?')[0].split('#')[0]
  const ext = clean.split('.').pop()?.toLowerCase() || ''
  if (ext === 'ts' || ext === 'tsx') {
    return { label: 'TS', bg: 'bg-[#3178c6] text-white', badgeClass: 'text-[#3178c6] bg-blue-500/10 border-blue-500/20' }
  }
  if (ext === 'js' || ext === 'jsx') {
    return { label: 'JS', bg: 'bg-[#f7df1e] text-black font-bold', badgeClass: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' }
  }
  if (ext === 'py') {
    return { label: 'PY', bg: 'bg-[#3776ab] text-white', badgeClass: 'text-sky-500 bg-sky-500/10 border-sky-500/20' }
  }
  if (ext === 'css' || ext === 'scss') {
    return { label: 'CSS', bg: 'bg-[#264de4] text-white', badgeClass: 'text-blue-400 bg-blue-500/10 border-blue-500/20' }
  }
  if (ext === 'html') {
    return { label: 'HTML', bg: 'bg-[#e34f26] text-white', badgeClass: 'text-orange-500 bg-orange-500/10 border-orange-500/20' }
  }
  if (ext === 'json') {
    return { label: 'JSON', bg: 'bg-[#cb3837] text-white', badgeClass: 'text-red-400 bg-red-500/10 border-red-500/20' }
  }
  if (ext === 'md' || ext === 'mdx') {
    return { label: 'MD', bg: 'bg-[#083fa1] text-white', badgeClass: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20' }
  }
  return { label: ext.slice(0, 3).toUpperCase() || 'FILE', bg: 'bg-zinc-700 text-zinc-200', badgeClass: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20' }
}

export function ThinkingTimelineItem({
  content,
  duration = 1,
  isLive = false,
  defaultOpen = false,
}: {
  content: string
  duration?: number
  isLive?: boolean
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="py-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="group flex items-center gap-1.5 text-xs text-muted-foreground/80 hover:text-foreground transition-colors select-none"
      >
        <Brain className="size-3.5 text-muted-foreground/70 group-hover:text-foreground" />
        <span className="font-medium">
          {isLive ? <ThinkingShimmer>Thinking...</ThinkingShimmer> : `Thought for ${duration}s`}
        </span>
        <ChevronDown
          className={cn('size-3.5 text-muted-foreground/70 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="mt-1.5 pl-3 border-l-2 border-white/10 text-xs leading-relaxed text-zinc-400 font-sans whitespace-pre-wrap max-h-64 overflow-y-auto">
              {content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ActionRowItem({
  action,
  isDark = true,
}: {
  action: StreamActionItem
  isDark?: boolean
}) {
  const name = (action.toolName || '').toLowerCase()
  const isCommand =
    action.actionKind === 'command' ||
    name.includes('command') ||
    name.includes('terminal') ||
    name === 'bash' ||
    name === 'shell' ||
    name === 'command_run'

  if (isCommand) {
    const cmd = action.command || (typeof action.args === 'object' ? (action.args as any)?.command || (action.args as any)?.cmd : '') || action.displayName
    return (
      <div className="flex items-center gap-2 py-1 px-0.5 text-xs text-zinc-300">
        <span className="size-5 rounded flex items-center justify-center bg-zinc-800 border border-zinc-700/80 text-zinc-300 font-mono text-[10px] shrink-0 font-medium">
          &lt;/&gt;_
        </span>
        <span className="font-medium text-foreground/90">run command :</span>
        {cmd && cmd !== 'run command :' && (
          <span className="font-mono text-[11px] text-muted-foreground truncate max-w-[280px]">
            {cmd}
          </span>
        )}
        {action.status === 'running' && (
          <span className="size-1.5 rounded-full bg-blue-400 animate-pulse ml-auto" />
        )}
      </div>
    )
  }

  // File action or other tool
  const rawPath = action.filePath || action.displayName || ''
  const filename = rawPath.split('/').pop() || rawPath
  const badge = getFileBadge(filename)
  let actionVerb = 'edited'
  if (name.includes('create') || name.includes('write')) actionVerb = 'created'
  else if (name.includes('delete')) actionVerb = 'deleted'
  else if (name.includes('read')) actionVerb = 'read'

  const additions = action.additions ?? 10
  const deletions = action.deletions ?? 0

  return (
    <div className="flex items-center gap-2 py-1 px-0.5 text-xs text-zinc-300">
      <span className={cn('size-5 rounded flex items-center justify-center font-bold text-[9px] tracking-tight shrink-0 shadow-sm', badge.bg)}>
        {badge.label}
      </span>
      <span className="font-normal text-foreground/90">
        {actionVerb} <span className="font-medium">{filename}</span>
      </span>
      <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums font-medium">
        <span className="text-emerald-500 dark:text-emerald-400">+{additions}</span>
        <span className="text-rose-500 dark:text-rose-400">-{deletions}</span>
      </span>
      {action.badges && action.badges.length > 0 && (
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {action.badges.map((b, i) => {
            const bBadge = getFileBadge(`file.${b.toLowerCase()}`)
            return (
              <span
                key={i}
                className={cn('px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-tight', bBadge.badgeClass)}
              >
                {b}
              </span>
            )
          })}
        </div>
      )}
      {action.status === 'running' && (
        <span className="size-1.5 rounded-full bg-blue-400 animate-pulse ml-auto" />
      )}
    </div>
  )
}

export function CompactActionsItem({
  actions,
  isDark = true,
}: {
  actions: StreamActionItem[]
  isDark?: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  if (!actions.length) return null

  const first = actions[0]
  const otherCount = actions.length - 1
  const firstPath = first.filePath || first.displayName || ''
  const filename = firstPath.split('/').pop() || firstPath
  const badge = getFileBadge(filename)

  // Collect unique language badges
  const distinctExts = Array.from(
    new Set(
      actions
        .map((a) => {
          const p = a.filePath || a.displayName || ''
          return p.split('.').pop()?.toUpperCase() || ''
        })
        .filter((ext) => ext && ext.length <= 4),
    ),
  ).slice(0, 3)

  return (
    <div className="py-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-zinc-300 min-w-0">
          <span className={cn('size-5 rounded flex items-center justify-center font-bold text-[9px] tracking-tight shrink-0 shadow-sm', badge.bg)}>
            {badge.label}
          </span>
          <span className="font-normal text-foreground/90 truncate">
            edited <span className="font-medium">{filename}</span>
          </span>
          <span className="flex items-center gap-1 font-mono text-[11px] tabular-nums font-medium shrink-0">
            <span className="text-emerald-500 dark:text-emerald-400">+{first.additions ?? 10}</span>
            <span className="text-rose-500 dark:text-rose-400">-{first.deletions ?? 0}</span>
          </span>
          <div className="flex items-center gap-1 shrink-0 ml-1">
            {distinctExts.map((ext, i) => {
              const bBadge = getFileBadge(`file.${ext.toLowerCase()}`)
              return (
                <span
                  key={i}
                  className={cn('px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-tight', bBadge.badgeClass)}
                >
                  {ext}
                </span>
              )
            })}
            {otherCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-zinc-500/10 border border-zinc-500/20 text-zinc-400 font-medium text-[9px]">
                +{otherCount}
              </span>
            )}
          </div>
        </div>
        {actions.length > 1 && (
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-1"
          >
            <ChevronDown className={cn('size-3.5 transition-transform duration-200', expanded && 'rotate-180')} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mt-1 pl-4 space-y-1 border-l border-white/10"
          >
            {actions.slice(1).map((act) => (
              <ActionRowItem key={act.id} action={act} isDark={isDark} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function ImplementationPlanCard({
  plan,
  isDark = true,
}: {
  plan: StreamPlan
  isDark?: boolean
}) {
  const [open, setOpen] = useState(true)
  const steps = plan.steps || []
  const totalSteps = plan.totalSteps ?? steps.length
  const completedSteps =
    plan.completedSteps ??
    steps.filter((s) => s.status === 'completed' || s.status === 'complete').length

  return (
    <div
      className={cn(
        'my-2.5 rounded-xl border p-3.5 sm:p-4 text-xs shadow-sm transition-all',
        isDark
          ? 'border-zinc-800/90 bg-[#121316] text-zinc-100'
          : 'border-zinc-200/90 bg-zinc-50 text-zinc-900',
      )}
    >
      <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
        <div className="flex items-center gap-2 font-medium text-xs sm:text-[13px]">
          <ListTodo className="size-4 text-zinc-400" />
          <span>{plan.title || 'Implementation plan'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-400 text-[11px] tabular-nums">
            {completedSteps}/{totalSteps}
          </span>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label="Toggle plan"
            className="text-zinc-400 hover:text-zinc-200 transition-colors p-0.5"
          >
            <ChevronUp className={cn('size-3.5 transition-transform duration-200', !open && 'rotate-180')} />
          </button>
        </div>
      </div>
      {open && (
        <div className="mt-3 space-y-2.5">
          {steps.map((step) => {
            const isActive = step.status === 'in_progress' || step.status === 'active'
            const isComplete =
              step.status === 'completed' || step.status === 'complete'
            return (
              <div key={step.id} className="flex items-center justify-between gap-2.5">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {isActive ? (
                    <div className="relative size-4 shrink-0 grid place-items-center">
                      <svg className="size-4 -rotate-90 animate-spin" viewBox="0 0 24 24">
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="text-zinc-700"
                          fill="none"
                        />
                        <circle
                          cx="12"
                          cy="12"
                          r="9"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          className="text-blue-400"
                          strokeDasharray="56"
                          strokeDashoffset="14"
                          strokeLinecap="round"
                          fill="none"
                        />
                      </svg>
                    </div>
                  ) : isComplete ? (
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-400" />
                  ) : (
                    <CircleDashed className="size-4 shrink-0 text-zinc-500" />
                  )}
                  <span
                    className={cn(
                      'truncate text-xs',
                      isActive ? 'text-zinc-100 font-medium' : isComplete ? 'text-zinc-300' : 'text-zinc-500',
                    )}
                  >
                    {step.title}
                  </span>
                </div>
                {isActive && (
                  <span className="font-mono text-[11px] text-zinc-400 tabular-nums shrink-0">
                    {step.progress ?? 75}%
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
