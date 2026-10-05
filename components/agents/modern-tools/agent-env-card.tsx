'use client';

import React, { useState } from 'react';
import { Key, Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface AgentEnvCardProps {
  variableName?: string;
  description?: string;
  isDark?: boolean;
  submitting?: boolean;
  submitted?: boolean;
  onSubmit?: (variableName: string, value: string) => void;
  className?: string;
}

export function AgentEnvCard({
  variableName = 'API_KEY',
  description = 'Agent requires this environment variable to connect with external services.',
  isDark = true,
  submitting = false,
  submitted = false,
  onSubmit,
  className = '',
}: AgentEnvCardProps) {
  const [value, setValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isDone, setIsDone] = useState(submitted);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isDone || !value.trim()) return;
    setIsDone(true);
    onSubmit?.(variableName, value.trim());
  };

  return (
    <div className={cn('relative flex items-start gap-3.5 w-full select-none', className)}>
      {/* Iridescent glowing dot indicator */}
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
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <Key className="w-3.5 h-3.5" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-white">
                Environment variable requested
              </span>
            </div>

            {isDone && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Check className="w-3 h-3 stroke-[2.5]" /> Saved
              </span>
            )}
          </div>

          <div className="text-[13px] text-zinc-400 leading-snug">
            {description}
          </div>

          {/* Key pill & input */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[12px] font-mono text-indigo-300">
                {variableName}
              </span>
            </div>

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                disabled={submitting || isDone}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Enter secret value..."
                className="w-full bg-[#111113] border border-zinc-800/80 rounded-xl pl-4 pr-10 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action button */}
          {!isDone && (
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={submitting || !value.trim()}
                className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold px-5 h-8 text-xs shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Saving...
                  </>
                ) : (
                  'Save & Continue'
                )}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
