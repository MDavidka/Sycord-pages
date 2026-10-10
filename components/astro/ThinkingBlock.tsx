'use client'

import React, { useState, useEffect } from 'react';
import { ChevronDown, Check, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ThinkingBlockProps {
  thinking: string;
  isDark?: boolean;
  startTime?: number | null;
  thinkingTime?: number;
  effortLevel?: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({
  thinking,
  isDark = true,
  startTime,
  thinkingTime,
  effortLevel,
  isStreaming = false,
}: ThinkingBlockProps) {
  if (effortLevel === 'low') return null;
  if (!thinking || thinking.trim().length === 0) return null;

  // Track live duration in seconds with tabular numbers
  const [elapsed, setElapsed] = useState<number>(() => {
    if (typeof thinkingTime === 'number') return thinkingTime;
    if (startTime) return Math.max(0.1, Number(((Date.now() - startTime) / 1000).toFixed(1)));
    return 0;
  });

  // By default, if completed (not streaming and thinkingTime is provided or streaming finished), start collapsed
  const isDone = !isStreaming && (typeof thinkingTime === 'number' || Boolean(thinking && !startTime));
  const [isExpanded, setIsExpanded] = useState<boolean>(!isDone);

  useEffect(() => {
    if (isDone) {
      setIsExpanded(false);
    }
  }, [isDone]);

  useEffect(() => {
    if (!isStreaming || !startTime) return;
    const interval = setInterval(() => {
      setElapsed(Number(((Date.now() - startTime) / 1000).toFixed(1)));
    }, 100);
    return () => clearInterval(interval);
  }, [isStreaming, startTime]);

  const durationText = typeof thinkingTime === 'number' 
    ? `${thinkingTime.toFixed(1)}s` 
    : `${elapsed.toFixed(1)}s`;

  return (
    <div className={cn(
      "w-full rounded-[var(--radius-control,18px)] border transition-opacity overflow-hidden my-1.5",
      isDark
        ? "bg-[var(--surface-muted,#141414)] border-[var(--border,#242424)]"
        : "bg-zinc-100 border-zinc-200"
    )}>
      <button
        type="button"
        onClick={() => setIsExpanded((prev) => !prev)}
        className={cn(
          "w-full flex items-center justify-between px-3.5 py-2 text-xs select-none transition-colors cursor-pointer",
          isDark 
            ? "hover:bg-[var(--surface,#191919)] text-[var(--text-muted,#8C8C8C)] hover:text-[var(--foreground,#FFFFFF)]"
            : "hover:bg-zinc-200/60 text-zinc-600 hover:text-zinc-900"
        )}
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 min-w-0">
          {isDone ? (
            <Check className="size-3.5 text-emerald-500 shrink-0" strokeWidth={2.5} />
          ) : (
            <Brain className="size-3.5 text-zinc-400 shrink-0 animate-pulse" />
          )}
          <span className="font-medium truncate">
            {isDone ? `Megfontolva ${durationText} alatt` : `Gondolkodás folyamatban…`}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="tabular-nums text-[11px] font-mono opacity-80">
            {durationText}
          </span>
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-150",
              isExpanded ? "rotate-180" : "rotate-0"
            )}
          />
        </div>
      </button>

      {isExpanded && (
        <div className={cn(
          "px-3.5 py-2.5 text-xs font-mono leading-relaxed border-t whitespace-pre-wrap max-h-60 overflow-y-auto select-text",
          isDark
            ? "border-[var(--border-subtle,#242424)] text-[var(--text-secondary,#B4B4B4)] bg-[var(--surface-muted,#141414)]"
            : "border-zinc-200 text-zinc-700 bg-zinc-50"
        )}>
          {thinking}
        </div>
      )}
    </div>
  );
}
