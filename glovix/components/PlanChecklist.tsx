'use client'

import { memo } from 'react'
import { Check, Circle, Loader2, SkipForward } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { GenerationPlan } from '../lib/generation-plan'
import { planProgress } from '../lib/generation-plan'

interface PlanChecklistProps {
  plan: GenerationPlan | null
  isDark?: boolean
}

function StepIcon({ status }: { status: GenerationPlan['steps'][0]['status'] }) {
  if (status === 'completed') {
    return (
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
        <Check className="h-3 w-3" strokeWidth={2.5} />
      </span>
    )
  }
  if (status === 'in_progress') {
    return (
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-blue-400">
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    )
  }
  if (status === 'skipped') {
    return (
      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-zinc-500">
        <SkipForward className="h-3.5 w-3.5" />
      </span>
    )
  }
  return (
    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center text-zinc-600">
      <Circle className="h-3.5 w-3.5" />
    </span>
  )
}

export const PlanChecklist = memo(function PlanChecklist({ plan, isDark = true }: PlanChecklistProps) {
  if (!plan) return null

  const { completed, total } = planProgress(plan)

  return (
    <div
      className={cn(
        'mx-2 mb-2 rounded-2xl border px-4 py-3',
        isDark ? 'border-[#2a2b2e] bg-[#1c1d1f]' : 'border-gray-200 bg-gray-50',
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('truncate text-[13px] font-medium', isDark ? 'text-[#e5e5e5]' : 'text-gray-900')}>
            {plan.title}
          </p>
          {plan.pages.length > 0 && (
            <p className={cn('mt-0.5 truncate text-[11px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-500')}>
              {plan.pages.map((p) => p.name).join(' · ')}
            </p>
          )}
        </div>
        <span
          className={cn(
            'flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums',
            isDark ? 'bg-[#26272a] text-[#9a9b9e]' : 'bg-white text-gray-600',
          )}
        >
          {completed}/{total}
        </span>
      </div>

      <ul className="space-y-2">
        {plan.steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2.5">
            <StepIcon status={step.status} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p
                className={cn(
                  'text-[13px] leading-snug',
                  step.status === 'completed' && (isDark ? 'text-[#6b6c6f] line-through' : 'text-gray-400 line-through'),
                  step.status === 'in_progress' && (isDark ? 'text-[#e5e5e5]' : 'text-gray-900'),
                  step.status === 'pending' && (isDark ? 'text-[#9a9b9e]' : 'text-gray-600'),
                  step.status === 'skipped' && (isDark ? 'text-[#6b6c6f]' : 'text-gray-400'),
                )}
              >
                {step.title}
                {!step.strict && (
                  <span className={cn('ml-1.5 text-[10px]', isDark ? 'text-[#6b6c6f]' : 'text-gray-400')}>
                    optional
                  </span>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
})
