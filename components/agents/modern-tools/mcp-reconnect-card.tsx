'use client';

import React, { useState } from 'react';
import { RefreshCw, AlertCircle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface McpReconnectCardProps {
  serviceName?: string;
  reason?: string;
  isDark?: boolean;
  submitting?: boolean;
  onReconnect?: (serviceName: string) => Promise<boolean> | void;
  className?: string;
}

export function McpReconnectCard({
  serviceName = 'GitHub',
  reason = 'MCP session expired or requires reauthorization to proceed with tool executions.',
  isDark = true,
  submitting: initialSubmitting = false,
  onReconnect,
  className = '',
}: McpReconnectCardProps) {
  const [submitting, setSubmitting] = useState(initialSubmitting);
  const [reconnected, setReconnected] = useState(false);

  const handleReconnect = async () => {
    if (submitting || reconnected) return;
    setSubmitting(true);
    try {
      if (onReconnect) {
        await onReconnect(serviceName);
      }
      setReconnected(true);
    } catch {
      // handled by parent
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn('relative flex items-start gap-3.5 w-full select-none', className)}>
      {/* Iridescent glowing dot indicator */}
      <div className="flex-shrink-0 mt-3">
        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-amber-400 via-orange-400 to-rose-400 shadow-[0_0_12px_rgba(245,158,11,0.5)] border border-white/20" />
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
        <div className="space-y-3.5">
          {/* Header */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-5 h-5 rounded-md bg-amber-500/20 text-amber-400 flex items-center justify-center">
                <AlertCircle className="w-3.5 h-3.5" />
              </div>
              <span className="text-[15px] font-semibold tracking-tight text-white">
                MCP Reconnection Required
              </span>
            </div>

            {reconnected ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <Check className="w-3 h-3 stroke-[2.5]" /> Reconnected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
                Disconnected
              </span>
            )}
          </div>

          <div className="text-[13px] text-zinc-300 leading-snug">
            {reason}
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 text-[12px] font-mono text-zinc-300">
              Service: <strong className="text-white">{serviceName}</strong>
            </span>

            {!reconnected && (
              <Button
                type="button"
                size="sm"
                onClick={handleReconnect}
                disabled={submitting}
                className="rounded-xl bg-white text-zinc-950 hover:bg-zinc-200 font-semibold px-4 h-8 text-xs shadow-sm transition-transform active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3 mr-1.5" />
                    Reconnect
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
