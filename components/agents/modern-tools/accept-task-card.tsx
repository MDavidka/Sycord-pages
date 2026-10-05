'use client';

import React, { useState } from 'react';
import { Check, X, FileText, Edit3, ChevronDown, ChevronUp, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AcceptTaskCardProps {
  title?: string;
  planMarkdown?: string;
  fileName?: string;
  isDark?: boolean;
  status?: 'pending' | 'accepted' | 'declined';
  onAccept?: (editedPlan?: string) => void;
  onDecline?: () => void;
  className?: string;
}

export function AcceptTaskCard({
  title = 'Are you accept',
  planMarkdown = '• Here must be displayed the plan , using markdown and expandable for bigger also in expanded user can edit it.',
  fileName = 'testplan.md',
  isDark = true,
  status: initialStatus = 'pending',
  onAccept,
  onDecline,
  className = '',
}: AcceptTaskCardProps) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>(initialStatus);
  const [isExpanded, setIsExpanded] = useState(false);
  const [editedPlan, setEditedPlan] = useState(planMarkdown);
  const [isEditing, setIsEditing] = useState(false);

  const handleAccept = () => {
    setStatus('accepted');
    onAccept?.(editedPlan);
  };

  const handleDecline = () => {
    setStatus('declined');
    onDecline?.();
  };

  return (
    <div className={cn('relative flex items-start gap-3.5 w-full select-none', className)}>
      {/* Iridescent glowing dot indicator from design screenshot */}
      <div className="flex-shrink-0 mt-3">
        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-300 shadow-[0_0_12px_rgba(99,102,241,0.5)] border border-white/20" />
      </div>

      {/* Main Card */}
      <div
        className={cn(
          'flex-1 rounded-2xl border transition-all duration-200 p-5 shadow-xl',
          isDark
            ? 'bg-[#18181b] border-zinc-800/80 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-sm'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[15px] font-semibold tracking-tight text-white">
            {title}
          </h3>
          {status === 'accepted' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <Check className="w-3 h-3 stroke-[2.5]" /> Accepted
            </span>
          )}
          {status === 'declined' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <X className="w-3 h-3 stroke-[2.5]" /> Declined
            </span>
          )}
        </div>

        {/* Plan Markdown Preview */}
        {!isExpanded ? (
          <div className="mt-3 text-[13.5px] leading-relaxed text-zinc-300 whitespace-pre-line font-normal">
            {editedPlan.slice(0, 220)}
            {editedPlan.length > 220 && '...'}
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 pb-1 border-b border-zinc-800">
              <span>{isEditing ? 'Editing Plan (Markdown)' : 'Plan Details (Markdown)'}</span>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 cursor-pointer"
              >
                {isEditing ? (
                  <>
                    <Eye className="w-3 h-3" /> Preview
                  </>
                ) : (
                  <>
                    <Edit3 className="w-3 h-3" /> Edit Plan
                  </>
                )}
              </button>
            </div>

            {isEditing ? (
              <textarea
                value={editedPlan}
                onChange={(e) => setEditedPlan(e.target.value)}
                rows={6}
                className="w-full bg-[#111113] border border-zinc-800 rounded-xl p-3 text-xs font-mono text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 resize-y"
                placeholder="Edit the markdown plan here..."
              />
            ) : (
              <div className="bg-[#111113] border border-zinc-800/80 rounded-xl p-3 text-[13px] leading-relaxed text-zinc-200 font-normal whitespace-pre-line max-h-60 overflow-y-auto">
                {editedPlan}
              </div>
            )}
          </div>
        )}

        {/* Footer Row: Markdown Attachment Chip on left, Shadcn Button on right */}
        <div className="mt-4 pt-3 flex items-center justify-between gap-3 border-t border-zinc-800/50">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/80 hover:bg-zinc-800/80 border border-zinc-800 text-[12.5px] text-zinc-300 hover:text-white transition-all cursor-pointer group"
          >
            {/* Markdown Icon M with down arrow */}
            <span className="inline-flex items-center justify-center w-4 h-4 rounded text-[11px] font-bold text-sky-400 bg-sky-500/10">
              M↓
            </span>
            <span className="font-mono text-zinc-300 group-hover:text-white">{fileName}</span>
            {isExpanded ? (
              <ChevronUp className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
            ) : (
              <ChevronDown className="w-3 h-3 text-zinc-500 group-hover:text-zinc-300" />
            )}
          </button>

          {status === 'pending' && (
            <div className="flex items-center gap-2">
              {onDecline && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDecline}
                  className="rounded-xl border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 h-8 px-3 text-xs"
                >
                  Decline
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                onClick={handleAccept}
                className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold px-4 h-8 text-xs shadow-sm transition-transform active:scale-95"
              >
                Button
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
