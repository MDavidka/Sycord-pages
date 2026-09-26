'use client';

import React from 'react';
import { Check, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AnsweredQuestionBoxProps {
  prompt: string;
  answer?: any;
  isDark?: boolean;
  questionId?: string;
  className?: string;
}

export function AnsweredQuestionBox({
  prompt,
  answer,
  isDark = true,
  className = '',
}: AnsweredQuestionBoxProps) {
  const displayAnswer = typeof answer === 'object' && answer !== null
    ? (Array.isArray(answer) ? answer.join(', ') : JSON.stringify(answer))
    : String(answer ?? '');

  return (
    <div
      className={cn(
        'w-full rounded-2xl border transition-all duration-200 p-4 select-none my-2.5',
        isDark
          ? 'bg-[#18181b] border-zinc-800/80 text-zinc-100 shadow-md'
          : 'bg-white border-zinc-200 text-zinc-900 shadow-sm',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
          <span className="text-[12.5px] font-semibold tracking-tight text-zinc-200 uppercase tracking-wider text-[11px]">
            Answered question
          </span>
        </div>

        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          <Check className="w-3 h-3 stroke-[2.5]" /> Completed
        </span>
      </div>

      {/* Prompt */}
      <p className="mt-2 text-[13.5px] font-medium text-zinc-200 leading-snug">
        {prompt}
      </p>

      {/* Answer pill */}
      {displayAnswer && (
        <div className="mt-2.5 px-3 py-2 rounded-xl text-[12.5px] font-mono border bg-[#111113] border-zinc-800 text-zinc-200">
          <span className="text-zinc-500 select-none mr-2">&gt;</span>
          {displayAnswer}
        </div>
      )}
    </div>
  );
}
