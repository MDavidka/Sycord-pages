'use client'

import React, { useState } from 'react';
import { ChevronDown, Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface AutoCompactContainerProps {
  children: React.ReactNode[];
  threshold?: number;
  isDark?: boolean;
  className?: string;
}

export function AutoCompactContainer({
  children,
  threshold = 5,
  isDark = true,
  className,
}: AutoCompactContainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter out null/undefined/empty children
  const validChildren = React.Children.toArray(children).filter(Boolean);

  // If items do not exceed the threshold, render all normally
  if (validChildren.length <= threshold) {
    return <div className={cn("w-full space-y-1.5", className)}>{validChildren}</div>;
  }

  // Auto-compact mechanism (5 tools threshold):
  // Compact first N - 2 items into accordion, keep last 2 permanently visible
  const splitIndex = validChildren.length - 2;
  const collapsedItems = validChildren.slice(0, splitIndex);
  const activeItems = validChildren.slice(splitIndex);

  return (
    <div className={cn("w-full space-y-1.5", className)}>
      <div className={cn(
        "rounded-[var(--radius-control,18px)] border transition-colors overflow-hidden",
        isDark
          ? "bg-[var(--surface-muted,#141414)] border-[var(--border,#242424)]"
          : "bg-zinc-100 border-zinc-200"
      )}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full flex items-center justify-between px-3.5 py-2 text-xs font-medium select-none transition-colors cursor-pointer",
            isDark
              ? "text-[var(--text-muted,#8C8C8C)] hover:text-[var(--foreground,#FFFFFF)] hover:bg-[var(--surface,#191919)]"
              : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
          )}
          aria-expanded={isExpanded}
        >
          <div className="flex items-center gap-2">
            <Layers className="size-3.5 text-zinc-400" />
            <span>
              {isExpanded
                ? `Előzmények elrejtése (${collapsedItems.length} művelet)`
                : `+ ${collapsedItems.length} korábbi művelet összecsukva`}
            </span>
          </div>

          <ChevronDown
            className={cn(
              "size-3.5 transition-transform duration-150",
              isExpanded && "rotate-180"
            )}
          />
        </button>

        {isExpanded && (
          <div className={cn(
            "p-2 space-y-1.5 border-t",
            isDark ? "border-[var(--border-subtle,#242424)]" : "border-zinc-200"
          )}>
            {collapsedItems}
          </div>
        )}
      </div>

      {/* Permanently visible last 2 actions */}
      {activeItems}
    </div>
  );
}
