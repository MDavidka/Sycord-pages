'use client'

// A single activity row in the Syra feed.
//
// Each row is a lucide icon + a short verb. File activities append a monospace
// path; commands deliberately show only "Ran command" (never the executed
// command string), per the product requirement. While running, the verb uses
// the left→right shimmer; when finished it settles to a muted/success/error tint.

import { memo } from 'react'
import {
  BookOpenText,
  Check,
  FilePenLine,
  FilePlus2,
  FileText,
  FolderTree,
  ListChecks,
  Rocket,
  Search,
  SquareTerminal,
  Trash2,
  Wrench,
  X,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { KIND_VERBS, type ActivityKind, type SyraActivity } from '../../lib/syra-agent-events'

const KIND_ICON: Record<ActivityKind, LucideIcon> = {
  read: FileText,
  write: FilePlus2,
  edit: FilePenLine,
  delete: Trash2,
  command: SquareTerminal,
  search: Search,
  list: FolderTree,
  plan: ListChecks,
  deploy: Rocket,
  generic: Wrench,
}

interface SyraActivityItemProps {
  activity: SyraActivity
  /** Grouped count (e.g. "Read 6 files") — omit or 1 for a single item. */
  count?: number
  isDark?: boolean
}

export const SyraActivityItem = memo(function SyraActivityItem({
  activity,
  count = 1,
  isDark = true,
}: SyraActivityItemProps) {
  const Icon = KIND_ICON[activity.kind] ?? BookOpenText
  const running = activity.status === 'running'
  const [runVerb, doneVerb] = KIND_VERBS[activity.kind]
  const verb = running ? runVerb : doneVerb

  // Grouped label: "Read 6 files" / "Searched 3 times".
  const label =
    count > 1
      ? activity.kind === 'search'
        ? `${doneVerb} ${count} times`
        : `${verb.replace(/ file$/, '')} ${count} files`
      : verb

  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span
        className={cn(
          'flex-shrink-0',
          running
            ? isDark
              ? 'text-[#9a9b9e]'
              : 'text-gray-500'
            : activity.status === 'error'
              ? 'text-red-400'
              : isDark
                ? 'text-[#6b6c6f]'
                : 'text-gray-400',
        )}
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </span>

      <span
        className={cn(
          'truncate text-[13px]',
          running
            ? cn('text-shimmer', isDark ? 'text-shimmer-dark' : 'text-shimmer-light')
            : activity.status === 'error'
              ? 'text-red-400/80'
              : isDark
                ? 'text-[#9a9b9e]'
                : 'text-gray-500',
        )}
      >
        {label}
      </span>

      {/* File path detail — commands intentionally have none. */}
      {activity.detail && count <= 1 && (
        <span
          className={cn(
            'truncate font-mono text-[12px]',
            isDark ? 'text-[#6b6c6f]' : 'text-gray-400',
          )}
        >
          {activity.detail}
        </span>
      )}

      {!running && (
        <span className="ml-auto flex-shrink-0">
          {activity.status === 'error' ? (
            <X className="h-3.5 w-3.5 text-red-400" strokeWidth={2.5} />
          ) : (
            <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
          )}
        </span>
      )}
    </div>
  )
})
