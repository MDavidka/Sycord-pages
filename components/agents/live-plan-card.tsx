'use client';

import React, { memo, useEffect, useState } from 'react';
import { Target, Circle, CheckCircle2, XCircle } from 'lucide-react';
import type { PlanStep, StreamingPlan } from '@/glovix/lib/plan-connection-language';

function ProgressCircle({ progress = 65, className = 'w-4 h-4' }: { progress?: number; className?: string }) {
  const radius = 6;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(5, progress)) / 100) * circumference;

  return (
    <svg className={`${className} -rotate-90`} viewBox="0 0 16 16" fill="none">
      {/* Background circle outline */}
      <circle
        cx="8"
        cy="8"
        r={radius}
        stroke="currentColor"
        strokeWidth="1.75"
        className="text-zinc-700/60"
      />
      {/* Active progress arc (white) */}
      <circle
        cx="8"
        cy="8"
        r={radius}
        stroke="currentColor"
        strokeWidth="1.75"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        className="text-white"
      />
    </svg>
  );
}

export interface LivePlanCardProps {
  plan?: StreamingPlan | null;
  title?: string;
  steps?: (PlanStep & { progress?: number })[];
  status?: 'active' | 'completed' | 'failed';
  isDark?: boolean;
  className?: string;
  elapsedSeconds?: number;
  startTime?: number;
}

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs}`;
}

export const LivePlanCard = memo(function LivePlanCard({
  plan,
  title: propTitle,
  steps: propSteps,
  status: propStatus,
  isDark = true,
  className = '',
  elapsedSeconds: propElapsed,
  startTime: propStartTime,
}: LivePlanCardProps) {
  const effectiveTitle = (propTitle || plan?.title || 'plan').toLowerCase();
  const effectiveSteps = propSteps || plan?.steps || [];
  const effectiveStatus = propStatus || plan?.status || 'active';

  // Live timer counting up while plan is running/streaming
  const [seconds, setSeconds] = useState<number>(() => {
    if (typeof propElapsed === 'number') return propElapsed;
    if (propStartTime) {
      return Math.max(0, Math.floor((Date.now() - propStartTime) / 1000));
    }
    if (plan?.createdAt) {
      return Math.max(0, Math.floor((Date.now() - plan.createdAt) / 1000));
    }
    return 0;
  });

  const isRunning = effectiveStatus === 'active';

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  if (!effectiveSteps || effectiveSteps.length === 0) {
    return null;
  }

  return (
    <div
      className={`w-full rounded-2xl border transition-all duration-200 select-none ${
        isDark
          ? 'bg-[#18181b] border-zinc-800/80 text-zinc-100 shadow-md shadow-black/20'
          : 'bg-white border-gray-200 text-gray-900 shadow-sm'
      } p-4 sm:px-4.5 sm:py-3.5 ${className}`}
    >
      {/* Header Row: Target Icon + plan label on left, 0:0 timer on right */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Target
            className={`w-4 h-4 stroke-[2] ${
              isDark ? 'text-zinc-400' : 'text-gray-500'
            }`}
          />
          <span
            className={`text-[13.5px] font-semibold tracking-tight ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            {effectiveTitle}
          </span>
        </div>

        <div
          className={`text-[12px] font-mono tabular-nums ${
            isDark ? 'text-zinc-400' : 'text-gray-500'
          }`}
        >
          {formatTimer(seconds)}
        </div>
      </div>

      {/* Step List Items */}
      <div className="mt-3.5 space-y-2.5">
        {effectiveSteps.map((step, index) => {
          const isInProgress = step.status === 'in_progress';
          const isCompleted = step.status === 'completed';
          const isFailed = step.status === 'failed';
          const isPending = step.status === 'pending' || (!isInProgress && !isCompleted && !isFailed);

          return (
            <div
              key={step.id || `step-${index}`}
              className="flex items-center gap-3 text-[13.5px] leading-snug group"
            >
              {/* Status indicator icon */}
              <div className="flex-shrink-0 flex items-center justify-center w-4 h-4">
                {isInProgress ? (
                  <ProgressCircle
                    progress={(step as any)?.progress ?? 65}
                    className="w-4 h-4"
                  />
                ) : isCompleted ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 stroke-[2]" />
                ) : isFailed ? (
                  <XCircle className="w-4 h-4 text-rose-400 stroke-[2]" />
                ) : (
                  <Circle
                    className={`w-4 h-4 stroke-[1.5] ${
                      isDark ? 'text-zinc-600' : 'text-gray-400'
                    }`}
                  />
                )}
              </div>

              {/* Step text */}
              <span
                className={`truncate transition-colors ${
                  isInProgress
                    ? isDark
                      ? 'text-zinc-100 font-normal'
                      : 'text-gray-900 font-medium'
                    : isCompleted
                    ? isDark
                      ? 'text-zinc-300 font-normal'
                      : 'text-gray-700'
                    : isFailed
                    ? 'text-rose-400'
                    : isDark
                    ? 'text-zinc-400 font-normal'
                    : 'text-gray-500'
                }`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
