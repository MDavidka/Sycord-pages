'use client';

import { memo } from 'react';
import { LivePlanCard } from '@/components/agents/live-plan-card';
import { normalizeStepStatus, type PlanStep } from '@/glovix/lib/plan-connection-language';

export type Plan = {
  id?: string;
  title: string;
  summary?: string;
  steps?: PlanStep[];
};

export type PlanToolProps = {
  part: {
    type: string;
    toolCallId?: string;
    state?: string;
    input?: {
      plan?: Plan;
      onApprove?: () => void;
      approveLabel?: string;
      approved?: boolean;
    };
  };
  chatStatus?: string;
  isDark?: boolean;
};

function parseStepsFromSummary(summary: string): PlanStep[] {
  if (!summary) return [];
  const lines = summary.split('\n');
  const steps: PlanStep[] = [];
  let idx = 1;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('Progress:') || line.startsWith('Notes:')) continue;

    // e.g. 1. [✓] Step title or - [in_progress] Step title or 1. [→] Step title
    const match = line.match(/^(?:[-*•]|\d+[.)])\s*(?:\[([^\]]+)\])?\s*(.*)$/);
    if (match) {
      const rawStatus = match[1];
      const rawTitle = match[2]?.trim();
      if (rawTitle) {
        steps.push({
          id: `step-${idx}`,
          title: rawTitle,
          status: normalizeStepStatus(rawStatus || (idx === 1 ? 'in_progress' : 'pending')),
        });
        idx++;
      }
    }
  }

  return steps;
}

export const PlanTool = memo(function PlanTool({
  part,
  chatStatus,
  isDark = true,
}: PlanToolProps) {
  const plan = part.input?.plan;
  if (!plan) return null;

  const rawSteps = plan.steps?.length ? plan.steps : parseStepsFromSummary(plan.summary || '');
  const steps: PlanStep[] = rawSteps.length > 0
    ? rawSteps
    : [
        {
          id: 'step-1',
          title: plan.title || 'Plan execution',
          status: part.state === 'input-streaming' || chatStatus === 'streaming' ? 'in_progress' : 'completed',
        },
      ];

  const isPending = part.state === 'input-streaming' || chatStatus === 'streaming';
  const isCompleted = steps.every((s) => s.status === 'completed' || s.status === 'skipped');
  const hasFailed = steps.some((s) => s.status === 'failed');

  return (
    <LivePlanCard
      title={plan.title || 'plan'}
      steps={steps}
      status={hasFailed ? 'failed' : isPending ? 'active' : isCompleted ? 'completed' : 'active'}
      isDark={isDark}
      className="my-2"
    />
  );
});
