'use client'

import { memo } from 'react'
import { PlanTool } from '@/components/agent-elements/tools/plan-tool'
import type { GenerationPlan } from '../lib/generation-plan'
import { planProgress } from '../lib/generation-plan'

interface PlanChecklistProps {
  plan: GenerationPlan | null
  isDark?: boolean
  /** Embedded inside composer — compact 2-row scroll viewport */
  embedded?: boolean
}

/**
 * Plan UI via Agent Elements PlanTool.
 * Approval is auto-enabled (approved: true) because there is no manual
 * approve flow in the product yet.
 */
export const PlanChecklist = memo(function PlanChecklist({
  plan,
  embedded = false,
}: PlanChecklistProps) {
  if (!plan || plan.steps.length === 0) return null

  const { completed, total } = planProgress(plan)
  const steps = plan.steps
    .map((step, index) => {
      const mark =
        step.status === 'completed' ? '✓' :
        step.status === 'in_progress' ? '→' :
        step.status === 'skipped' ? '–' : '○'
      return `${index + 1}. [${mark}] ${step.title}${step.description ? ` — ${step.description}` : ''}`
    })
    .join('\n')

  const summary = [
    plan.notes?.trim() || '',
    steps,
    `Progress: ${completed}/${total}`,
  ].filter(Boolean).join('\n\n')

  return (
    <div className={embedded ? 'max-h-[148px] overflow-hidden' : undefined}>
      <PlanTool
        chatStatus="ready"
        part={{
          type: 'tool-PlanWrite',
          toolCallId: plan.id,
          state: 'output-available',
          input: {
            approved: true,
            plan: {
              id: plan.id,
              title: plan.title,
              summary,
            },
          },
        }}
      />
    </div>
  )
})
