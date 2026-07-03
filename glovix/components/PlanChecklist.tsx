'use client'

import { memo, useEffect, useRef } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GenerationPlan } from '../lib/generation-plan'
import { planProgress } from '../lib/generation-plan'

interface PlanChecklistProps {
  plan: GenerationPlan | null
  isDark?: boolean
  /** Embedded inside composer — compact 2-row scroll viewport */
  embedded?: boolean
}

const ROW_H = 28

function SquareStepIcon({ status, isDark }: { status: GenerationPlan['steps'][0]['status']; isDark: boolean }) {
  const base = cn(
    'flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[4px] border',
    isDark ? 'border-[#4a4b4e]' : 'border-gray-300',
  )

  if (status === 'completed') {
    return (
      <span className={cn(base, 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400')}>
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
    )
  }

  // in_progress, pending, skipped — empty square (no spinner)
  return (
    <span
      className={cn(
        base,
        status === 'in_progress' && (isDark ? 'border-[#6b6c6f] bg-[#26272a]' : 'border-gray-400 bg-gray-50'),
        status === 'pending' && (isDark ? 'bg-transparent' : 'bg-transparent'),
        status === 'skipped' && 'opacity-40',
      )}
    />
  )
}

export const PlanChecklist = memo(function PlanChecklist({
  plan,
  isDark = true,
  embedded = false,
}: PlanChecklistProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!plan || !scrollRef.current) return
    const inProgressIdx = plan.steps.findIndex((s) => s.status === 'in_progress')
    const focusIdx = inProgressIdx >= 0 ? Math.max(0, inProgressIdx - 1) : plan.steps.findIndex((s) => s.status === 'pending')
    if (focusIdx >= 0) {
      scrollRef.current.scrollTop = focusIdx * ROW_H
    }
  }, [plan])

  if (!plan) return null

  const { completed, total } = planProgress(plan)

  if (embedded) {
    return (
      <div className={cn('border-b px-3 pt-2 pb-1.5', isDark ? 'border-[#2a2b2e]' : 'border-gray-100')}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <span className={cn('truncate text-[12px] font-medium', isDark ? 'text-[#c5c6c9]' : 'text-gray-700')}>
            {plan.title}
          </span>
          <span
            className={cn(
              'flex-shrink-0 text-[11px] tabular-nums',
              isDark ? 'text-[#6b6c6f]' : 'text-gray-400',
            )}
          >
            {completed}/{total}
          </span>
        </div>
        <div
          ref={scrollRef}
          className="overflow-y-auto overscroll-contain"
          style={{ maxHeight: ROW_H * 2 }}
        >
          <ul className="space-y-0">
            {plan.steps.map((step) => (
              <li
                key={step.id}
                className="flex items-center gap-2.5"
                style={{ minHeight: ROW_H }}
              >
                <SquareStepIcon status={step.status} isDark={isDark} />
                <p
                  className={cn(
                    'min-w-0 flex-1 truncate text-[13px] leading-none',
                    step.status === 'completed' && (isDark ? 'text-[#6b6c6f] line-through' : 'text-gray-400 line-through'),
                    step.status === 'in_progress' && (isDark ? 'text-[#e5e5e5]' : 'text-gray-900'),
                    step.status === 'pending' && (isDark ? 'text-[#9a9b9e]' : 'text-gray-600'),
                    step.status === 'skipped' && (isDark ? 'text-[#6b6c6f]' : 'text-gray-400'),
                  )}
                >
                  {step.title.toLowerCase()}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'mx-2 mb-2 rounded-2xl border px-4 py-3',
        isDark ? 'border-[#2a2b2e] bg-[#1c1d1f]' : 'border-gray-200 bg-gray-50',
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <p className={cn('truncate text-[13px] font-medium', isDark ? 'text-[#e5e5e5]' : 'text-gray-900')}>
          {plan.title}
        </p>
        <span className={cn('text-[11px] tabular-nums', isDark ? 'text-[#6b6c6f]' : 'text-gray-400')}>
          {completed}/{total}
        </span>
      </div>
      <div ref={scrollRef} className="overflow-y-auto" style={{ maxHeight: ROW_H * 2 }}>
        <ul>
          {plan.steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2.5" style={{ minHeight: ROW_H }}>
              <SquareStepIcon status={step.status} isDark={isDark} />
              <p className={cn('truncate text-[13px]', isDark ? 'text-[#e5e5e5]' : 'text-gray-800')}>
                {step.title}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
})
