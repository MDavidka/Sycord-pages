'use client';

import React from 'react';
import { Download, FileCode, FileText, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface FileOutputItem {
  id?: string;
  name: string;
  size?: string;
  type?: 'xls' | 'pdf' | 'code' | 'doc' | 'archive' | 'image' | 'generic';
  url?: string;
  content?: string;
}

export interface FileOutputCardProps {
  files?: FileOutputItem[];
  isDark?: boolean;
  onFileClick?: (file: FileOutputItem) => void;
  className?: string;
}

// Green Spreadsheet icon matching test.xsl in screenshot
function XlsSheetIcon({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 28 34" fill="none">
      <rect width="28" height="34" rx="4" fill="#1D6F42" fillOpacity="0.25" stroke="#107C41" strokeWidth="1.2" />
      <path d="M18 0H4C1.79 0 0 1.79 0 4V30C0 32.21 1.79 34 4 34H24C26.21 34 28 32.21 28 30V10L18 0Z" fill="#107C41" fillOpacity="0.15" />
      <rect x="5" y="16" width="18" height="2" rx="1" fill="#107C41" />
      <rect x="5" y="21" width="18" height="2" rx="1" fill="#107C41" />
      <rect x="5" y="26" width="18" height="2" rx="1" fill="#107C41" />
      <rect x="13" y="14" width="2" height="15" rx="1" fill="#107C41" />
      <text x="5" y="11" fill="#22C55E" fontSize="7.5" fontWeight="bold" fontFamily="monospace">XLS</text>
    </svg>
  );
}

function getFileIcon(type?: string, name?: string) {
  const ext = (name?.split('.').pop() || '').toLowerCase();
  if (type === 'xls' || ext === 'xls' || ext === 'xlsx' || ext === 'csv') {
    return <XlsSheetIcon className="w-8 h-9 flex-shrink-0" />;
  }
  if (type === 'pdf' || ext === 'pdf') {
    return (
      <div className="w-8 h-9 rounded-lg bg-rose-500/15 border border-rose-500/30 flex flex-col items-center justify-center text-rose-400">
        <span className="text-[8px] font-bold">PDF</span>
      </div>
    );
  }
  if (type === 'code' || ['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'html', 'css'].includes(ext)) {
    return (
      <div className="w-8 h-9 rounded-lg bg-sky-500/15 border border-sky-500/30 flex flex-col items-center justify-center text-sky-400">
        <FileCode className="w-4 h-4" />
      </div>
    );
  }
  return (
    <div className="w-8 h-9 rounded-lg bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center text-zinc-300">
      <FileText className="w-4 h-4" />
    </div>
  );
}

export function FileOutputCard({
  files = [
    { name: 'test.xsl', size: '20GB', type: 'xls' },
    { name: 'test.xsl', size: '20GB', type: 'xls' },
  ],
  isDark = true,
  onFileClick,
  className = '',
}: FileOutputCardProps) {
  if (!files || files.length === 0) return null;

  return (
    <div className={cn('relative flex items-center gap-3.5 w-full select-none', className)}>
      {/* Iridescent glowing dot indicator from design screenshot */}
      <div className="flex-shrink-0">
        <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-blue-400 via-indigo-400 to-purple-300 shadow-[0_0_12px_rgba(99,102,241,0.5)] border border-white/20" />
      </div>

      {/* Horizontal Files Grid/Row */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none">
        {files.map((file, idx) => (
          <div
            key={file.id || `file-${idx}`}
            onClick={() => onFileClick?.(file)}
            className={cn(
              'group flex items-center gap-3.5 px-4 py-2.5 rounded-2xl border transition-all duration-200 cursor-pointer',
              isDark
                ? 'bg-[#1e1e21] hover:bg-[#252529] border-white/[0.08] text-white shadow-md'
                : 'bg-white hover:bg-zinc-50 border-zinc-200 text-zinc-900 shadow-sm'
            )}
          >
            {/* File Icon */}
            {getFileIcon(file.type, file.name)}

            {/* File Meta */}
            <div className="min-w-0 pr-1">
              <p className="text-[13.5px] font-semibold tracking-tight text-white group-hover:text-sky-300 transition-colors truncate max-w-[130px]">
                {file.name}
              </p>
              {file.size && (
                <p className="text-[11.5px] text-zinc-400 font-mono tracking-tight mt-0.5">
                  {file.size}
                </p>
              )}
            </div>

            {/* Hover Action */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity pl-1 text-zinc-400 hover:text-white">
              <Download className="w-3.5 h-3.5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
