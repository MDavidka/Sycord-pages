'use client'

import React from 'react';
import { GitBranch, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StepIntentProps {
  intent: string;
  isDark?: boolean;
  className?: string;
}

export function StepIntent({
  intent,
  isDark = true,
  className,
}: StepIntentProps) {
  if (!intent || intent.trim().length === 0) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 px-3 py-1.5 my-1.5 rounded-[var(--radius-inner,10px)] text-xs border transition-colors",
        isDark
          ? "bg-[var(--surface-muted,#141414)] border-[var(--border-subtle,#242424)] text-[var(--foreground,#FFFFFF)]"
          : "bg-zinc-100 border-zinc-200 text-zinc-900",
        className
      )}
    >
      <div className="flex items-center gap-1 shrink-0 text-[var(--text-muted,#8C8C8C)]">
        <GitBranch className="size-3.5" />
        <ArrowRight className="size-2.5" />
      </div>
      <span className="font-semibold truncate tracking-tight">
        {intent}
      </span>
    </div>
  );
}
