'use client';

import React, { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface McpInputField {
  id: string;
  label?: string;
  placeholder?: string;
  type?: string;
  defaultValue?: string;
}

export interface McpInputCardProps {
  serviceName?: string;
  title?: string;
  icon?: React.ReactNode;
  fields?: McpInputField[];
  isDark?: boolean;
  submitting?: boolean;
  submitted?: boolean;
  buttonLabel?: string;
  onSubmit?: (values: Record<string, string>) => void;
  className?: string;
}

// Gmail 4-color SVG logo matching the screenshot
function GmailLogo({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path
        d="M2 6.5V17.5C2 18.6 2.9 19.5 4 19.5H7.5V11L12 14.5L16.5 11V19.5H20C21.1 19.5 22 18.6 22 17.5V6.5L12 14.5L2 6.5Z"
        fill="#EA4335"
      />
      <path
        d="M20 4.5H4C2.9 4.5 2 5.4 2 6.5L12 14.5L22 6.5C22 5.4 21.1 4.5 20 4.5Z"
        fill="#FBBC05"
      />
      <path
        d="M2 6.5V17.5C2 18.6 2.9 19.5 4 19.5H7.5V11L2 6.5Z"
        fill="#4285F4"
      />
      <path
        d="M22 6.5V17.5C22 18.6 21.1 19.5 20 19.5H16.5V11L22 6.5Z"
        fill="#34A853"
      />
    </svg>
  );
}

export function McpInputCard({
  serviceName = 'gmail',
  title,
  icon,
  fields = [
    { id: 'field1', placeholder: 'Enter text' },
    { id: 'field2', placeholder: 'Enter text' },
  ],
  isDark = true,
  submitting = false,
  submitted = false,
  buttonLabel = 'Button',
  onSubmit,
  className = '',
}: McpInputCardProps) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    fields.forEach((f) => {
      initial[f.id] = f.defaultValue || '';
    });
    return initial;
  });

  const [isDone, setIsDone] = useState(submitted);

  const displayTitle = title || `${serviceName} want your input`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || isDone) return;
    setIsDone(true);
    onSubmit?.(values);
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
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Header Row: MCP Logo + Service Title */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {icon || (serviceName.toLowerCase().includes('gmail') ? (
                <GmailLogo className="w-5 h-5 flex-shrink-0" />
              ) : (
                <div className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs font-bold">
                  {serviceName.slice(0, 1).toUpperCase()}
                </div>
              ))}
              <span className="text-[15px] font-semibold tracking-tight text-white">
                {displayTitle}
              </span>
            </div>

            {isDone && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Check className="w-3 h-3 stroke-[2.5]" /> Submitted
              </span>
            )}
          </div>

          {/* Stacked Input Fields */}
          <div className="space-y-2.5 pt-1">
            {fields.map((field) => (
              <div key={field.id} className="space-y-1">
                {field.label && (
                  <label className="text-[12px] font-medium text-zinc-400 px-1">
                    {field.label}
                  </label>
                )}
                <input
                  type={field.type || 'text'}
                  disabled={submitting || isDone}
                  value={values[field.id] || ''}
                  onChange={(e) =>
                    setValues((prev) => ({ ...prev, [field.id]: e.target.value }))
                  }
                  placeholder={field.placeholder || 'Enter text'}
                  className="w-full bg-[#111113] border border-zinc-800/80 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors disabled:opacity-60"
                />
              </div>
            ))}
          </div>

          {/* Bottom Right: Shadcn Button */}
          {!isDone && (
            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={submitting}
                className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold px-5 h-8 text-xs shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                    Sending...
                  </>
                ) : (
                  buttonLabel
                )}
              </Button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
