'use client'

import React, { useState } from 'react';
import { 
  FileCode, 
  Terminal, 
  CheckCircle2, 
  Server, 
  Globe, 
  ExternalLink, 
  ChevronDown, 
  AlertCircle, 
  Check, 
  Loader2 
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface BaseCardProps {
  isDark?: boolean;
  durationMs?: number;
  status?: 'pending' | 'running' | 'done' | 'error';
}

// 1. Fájlszerkesztés (FileEditCard)
export function FileEditCard({
  filePath,
  diff,
  status = 'done',
  durationMs,
  isDark = true,
}: BaseCardProps & {
  filePath: string;
  diff?: string;
}) {
  const [showDiff, setShowDiff] = useState(false);
  const parts = filePath.split('/');
  const fileName = parts.pop() || filePath;
  const dirPath = parts.join('/');

  return (
    <div className={cn(
      "w-full rounded-[var(--radius-control,18px)] border p-3 my-1.5 transition-colors",
      isDark ? "bg-[var(--surface,#191919)] border-[var(--border,#242424)]" : "bg-white border-zinc-200"
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <FileCode className="size-4 text-blue-400 shrink-0" />
          <div className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-[var(--foreground,#FFFFFF)] truncate">
              {fileName}
            </span>
            {dirPath && (
              <span className="text-[11px] text-[var(--text-muted,#8C8C8C)] truncate">
                {dirPath}/
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {durationMs !== undefined && (
            <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted,#8C8C8C)]">
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {status === 'running' && <Loader2 className="size-3.5 animate-spin text-zinc-400" />}
          {status === 'done' && <Check className="size-3.5 text-emerald-400" />}
          {status === 'error' && <AlertCircle className="size-3.5 text-red-400" />}
          {diff && (
            <button
              type="button"
              onClick={() => setShowDiff(!showDiff)}
              className="text-[11px] text-[var(--text-secondary,#B4B4B4)] hover:text-white px-1.5 py-0.5 rounded border border-[var(--border-subtle,#242424)]"
            >
              {showDiff ? 'Elrejt' : 'Diff'}
            </button>
          )}
        </div>
      </div>

      {showDiff && diff && (
        <div className="mt-2.5 pt-2 border-t border-[var(--border-subtle,#242424)] font-mono text-[11px] max-h-48 overflow-y-auto whitespace-pre-wrap">
          {diff.split('\n').map((line, idx) => (
            <div
              key={idx}
              className={cn(
                "px-1 py-0.5 rounded-sm",
                line.startsWith('+') ? "bg-emerald-500/10 text-emerald-400" :
                line.startsWith('-') ? "bg-red-500/10 text-red-400" :
                "text-[var(--text-muted,#8C8C8C)]"
              )}
            >
              {line}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 2. Parancsvégrehajtás (CommandCard)
export function CommandCard({
  command,
  output,
  status = 'done',
  durationMs,
  isDark = true,
}: BaseCardProps & {
  command: string;
  output?: string;
}) {
  const [isOpen, setIsOpen] = useState(status === 'error');

  return (
    <div className={cn(
      "w-full rounded-[var(--radius-control,18px)] border p-3 my-1.5 transition-colors",
      isDark ? "bg-[var(--surface,#191919)]" : "bg-white",
      status === 'error' ? "border-red-500/50" : "border-[var(--border,#242424)]"
    )}>
      <div 
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <Terminal className="size-4 text-purple-400 shrink-0" />
          <span className="text-xs font-mono font-medium text-[var(--foreground,#FFFFFF)] truncate">
            {command}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {durationMs !== undefined && (
            <span className="text-[11px] font-mono tabular-nums text-[var(--text-muted,#8C8C8C)]">
              {(durationMs / 1000).toFixed(1)}s
            </span>
          )}
          {status === 'running' && <Loader2 className="size-3.5 animate-spin text-zinc-400" />}
          {status === 'done' && <Check className="size-3.5 text-emerald-400" />}
          {status === 'error' && <AlertCircle className="size-3.5 text-red-400" />}
          <ChevronDown className={cn("size-3.5 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {isOpen && output && (
        <pre className="mt-2.5 p-2 rounded-lg bg-[var(--surface-muted,#141414)] border border-[var(--border-subtle,#242424)] font-mono text-[11px] text-[var(--text-secondary,#B4B4B4)] max-h-48 overflow-y-auto whitespace-pre-wrap">
          {output}
        </pre>
      )}
    </div>
  );
}

// 3. Típusellenőrzés (TypeCheckCard)
export function TypeCheckCard({
  errorsCount = 0,
  errorDetails = [],
  status = 'done',
  isDark = true,
}: BaseCardProps & {
  errorsCount?: number;
  errorDetails?: string[];
}) {
  const [isOpen, setIsOpen] = useState(errorsCount > 0);

  return (
    <div className={cn(
      "w-full rounded-[var(--radius-control,18px)] border p-3 my-1.5 transition-colors",
      isDark ? "bg-[var(--surface,#191919)]" : "bg-white",
      errorsCount > 0 ? "border-red-500/40" : "border-[var(--border,#242424)]"
    )}>
      <div 
        className="flex items-center justify-between gap-3 cursor-pointer select-none"
        onClick={() => errorsCount > 0 && setIsOpen(!isOpen)}
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 className={cn("size-4", errorsCount === 0 ? "text-emerald-400" : "text-red-400")} />
          <span className="text-xs font-medium text-[var(--foreground,#FFFFFF)]">
            TypeScript típusellenőrzés:
          </span>
          <span className={cn(
            "text-xs font-semibold tabular-nums",
            errorsCount === 0 ? "text-emerald-400" : "text-red-400"
          )}>
            {errorsCount === 0 ? '0 hiba található' : `${errorsCount} hiba található`}
          </span>
        </div>

        {errorsCount > 0 && (
          <ChevronDown className={cn("size-3.5 text-zinc-500 transition-transform", isOpen && "rotate-180")} />
        )}
      </div>

      {isOpen && errorDetails.length > 0 && (
        <div className="mt-2.5 p-2 rounded-lg bg-[var(--surface-muted,#141414)] border border-[var(--border-subtle,#242424)] font-mono text-[11px] text-red-400 max-h-48 overflow-y-auto space-y-1">
          {errorDetails.map((err, idx) => (
            <div key={idx}>{err}</div>
          ))}
        </div>
      )}
    </div>
  );
}

// 4. Szerverindítás és Élő Előnézet (ServerStatusCard)
export function ServerStatusCard({
  port = 3000,
  previewUrl,
  isDark = true,
}: BaseCardProps & {
  port?: number | string;
  previewUrl?: string;
}) {
  return (
    <div className={cn(
      "w-full rounded-[var(--radius-control,18px)] border p-3 my-1.5 transition-colors",
      isDark ? "bg-[var(--surface,#191919)] border-[var(--border,#242424)]" : "bg-white border-zinc-200"
    )}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Server className="size-4 text-emerald-400 shrink-0" />
          <span className="text-xs font-medium text-[var(--foreground,#FFFFFF)]">
            Fejlesztői szerver
          </span>
          <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded bg-[var(--surface-muted,#141414)] border border-[var(--border-subtle,#242424)] text-[var(--text-muted,#8C8C8C)]">
            :{port}
          </span>
        </div>

        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-inner,10px)] bg-white text-black text-xs font-semibold hover:bg-zinc-200 transition-colors cursor-pointer"
          >
            <span>Megnyitás</span>
            <ExternalLink className="size-3" />
          </a>
        )}
      </div>
    </div>
  );
}

// 5. Web Keresés (WebSearchCard)
export function WebSearchCard({
  query,
  results = [],
  isDark = true,
}: BaseCardProps & {
  query: string;
  results?: Array<{ title: string; url: string }>;
}) {
  return (
    <div className={cn(
      "w-full rounded-[var(--radius-control,18px)] border p-3 my-1.5 transition-colors",
      isDark ? "bg-[var(--surface,#191919)] border-[var(--border,#242424)]" : "bg-white border-zinc-200"
    )}>
      <div className="flex items-center gap-2 text-xs font-medium text-[var(--foreground,#FFFFFF)] mb-2">
        <Globe className="size-4 text-cyan-400 shrink-0" />
        <span>Keresés: <span className="font-semibold">{query}</span></span>
      </div>

      {results.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {results.map((item, idx) => (
            <a
              key={idx}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium bg-[var(--surface-muted,#141414)] border border-[var(--border-subtle,#242424)] text-[var(--text-secondary,#B4B4B4)] hover:text-white transition-colors"
            >
              <span className="truncate max-w-[140px]">{item.title}</span>
              <ExternalLink className="size-2.5 opacity-60" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
