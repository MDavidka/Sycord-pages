'use client';

import { memo } from 'react';
import { LivePlanCard } from '@/components/agents/live-plan-card';
import type { GenerationPlan } from '../lib/generation-plan';

interface PlanChecklistProps {
  plan: GenerationPlan | null;
  isDark?: boolean;
  embedded?: boolean;
  className?: string;
}

export const PlanChecklist = memo(function PlanChecklist({
  plan,
  isDark = true,
  embedded = false,
  className = '',
}: PlanChecklistProps) {
  if (!plan || !plan.steps || plan.steps.length === 0) return null;

  const isCompleted = plan.steps.every((s) => s.status === 'completed' || s.status === 'skipped');
  const hasFailed = plan.steps.some((s) => s.status === 'failed');

  return (
    <div className={embedded ? 'w-full' : 'w-full'}>
      <LivePlanCard
        title={plan.title || 'plan'}
        steps={plan.steps.map((s) => ({
          id: s.id,
          title: s.title,
          description: s.description,
          status: s.status,
          notes: (s as any).notes,
        }))}
        status={hasFailed ? 'failed' : isCompleted ? 'completed' : 'active'}
        isDark={isDark}
        startTime={plan.createdAt}
        className={className}
      />
    </div>
  );
});
