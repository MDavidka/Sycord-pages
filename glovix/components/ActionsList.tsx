'use client'

import { useMemo, useState, memo, type ComponentType } from 'react'
import {
  Brain,
  Check,
  ChevronRight,
  CircleAlert,
  Code2,
  Copy,
  Edit3,
  Eye,
  FileSearch,
  FolderSearch2,
  LoaderCircle,
  Search,
  Terminal,
  Wrench,
} from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'
import { FileTypeIcon, getFileNameAccent } from '../lib/file-icons'
import {
  getActionDisplayName,
  normalizeAgentTool,
  shortFilePath,
  stackGroupForKind,
  type AgentToolKind,
} from '../lib/agent-tools'

export interface StreamingAction {
  id: string
  toolName: string
  displayName: string
  status: 'pending' | 'running' | 'done' | 'error'
  result?: string
  args?: unknown
  kind?: AgentToolKind
}

interface ActionsListProps {
  actions: StreamingAction[]
  isLive?: boolean
  isDark?: boolean
}

type StackGroupKey = ReturnType<typeof stackGroupForKind>

interface StackedGroup {
  key: string
  stack: StackGroupKey
  kind: AgentToolKind
  label: string
  actions: StreamingAction[]
  active: boolean
}

function cleanResultForDisplay(result: string): string {
  return result.replace(/^\[SYSTEM\]\s*/gm, '').trim()
}

function resolveActionMeta(action: StreamingAction) {
  const normalized = normalizeAgentTool(action.toolName, action.args, action.result)
  return {
    toolName: normalized.toolName,
    kind: action.kind || normalized.kind,
    label: normalized.label,
    paths: normalized.paths.length
      ? normalized.paths
      : action.displayName
        ? [action.displayName]
        : [],
    command: normalized.command || (normalized.kind === 'command' || normalized.kind === 'validate' || normalized.kind === 'install'
      ? action.displayName
      : undefined),
  }
}

function ActionIcon({ kind, status, className }: { kind: AgentToolKind; status: StreamingAction['status']; className?: string }) {
  if (status === 'running' || status === 'pending') {
    return <LoaderCircle className={cn('size-4 shrink-0 animate-spin text-blue-300', className)} strokeWidth={1.8} />
  }
  if (status === 'error') {
    return <CircleAlert className={cn('size-4 shrink-0 text-red-300', className)} strokeWidth={1.8} />
  }

  const Icon: ComponentType<{ className?: string; strokeWidth?: number }> = (() => {
    switch (kind) {
      case 'thinking':
      case 'planning':
        return Brain
      case 'read':
        return FileSearch
      case 'edit':
        return Edit3
      case 'patch':
        return Code2
      case 'command':
      case 'validate':
        return Terminal
      case 'install':
      case 'service':
        return Wrench
      case 'search':
        return FolderSearch2
      case 'preview':
        return Eye
      case 'deploy':
        return Wrench
      default:
        return Search
    }
  })()

  const accent =
    kind === 'edit' || kind === 'patch' || kind === 'preview'
      ? 'text-blue-300/90'
      : kind === 'install'
        ? 'text-violet-300/80'
        : status === 'done'
          ? 'text-white/65'
          : 'text-white/65'

  return <Icon className={cn('size-4 shrink-0', accent, className)} strokeWidth={1.8} />
}

function FileChip({ path }: { path: string }) {
  const name = shortFilePath(path.includes(' → ') ? path.split(' → ').pop() || path : path)
  const color = getFileNameAccent(name)
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      <FileTypeIcon path={name} size={14} />
      <span className="truncate font-mono text-[13px] font-medium" style={{ color }}>
        {name}
      </span>
    </span>
  )
}

function FileChipStack({ paths }: { paths: string[] }) {
  const visible = paths.slice(0, 3)
  const overflow = paths.length - visible.length
  return (
    <div className="flex min-w-0 flex-col gap-1 sm:gap-1.5">
      {visible.map((path, i) => (
        <FileChip key={`${path}-${i}`} path={path} />
      ))}
      {overflow > 0 && (
        <span className="pl-[22px] font-mono text-[12px] text-white/35">
          … +{overflow} more
        </span>
      )}
    </div>
  )
}

function CommandStack({ actions }: { actions: StreamingAction[] }) {
  const visible = actions.slice(0, 3)
  const overflow = actions.length - visible.length
  return (
    <div className="mt-1 space-y-1 border-l border-white/10 pl-4 ml-[15px]">
      {visible.map((action) => {
        const meta = resolveActionMeta(action)
        const line = meta.command || action.displayName || action.toolName
        return (
          <div key={action.id} className="flex min-w-0 items-center gap-2 py-0.5">
            <Terminal className="size-3.5 shrink-0 text-white/45" strokeWidth={1.8} />
            <span className="truncate font-mono text-[12px] leading-5 text-white/55">
              Ran {line.length > 72 ? `${line.slice(0, 69)}…` : line}
            </span>
            {action.status === 'done' && <Check className="ml-auto size-3.5 shrink-0 text-emerald-300/80" strokeWidth={2.4} />}
            {action.status === 'error' && <CircleAlert className="ml-auto size-3.5 shrink-0 text-red-300" strokeWidth={1.8} />}
          </div>
        )
      })}
      {overflow > 0 && (
        <div className="pl-6 font-mono text-[12px] text-white/35">…</div>
      )}
    </div>
  )
}

const ToolGroupRow = memo(function ToolGroupRow({
  group,
}: {
  group: StackedGroup
}) {
  const failed = group.actions.some(a => a.status === 'error')
  const running = group.active
  const [open, setOpen] = useState(failed && !running)

  const allPaths = useMemo(() => {
    const paths: string[] = []
    for (const action of group.actions) {
      const meta = resolveActionMeta(action)
      if (meta.paths.length) paths.push(...meta.paths)
      else if (action.displayName && (group.stack === 'file-read' || group.stack === 'file-edit')) {
        paths.push(action.displayName)
      }
    }
    return Array.from(new Set(paths.filter(Boolean)))
  }, [group.actions, group.stack])

  const primary = group.actions[group.actions.length - 1]
  const meta = resolveActionMeta(primary)
  const isFileStack = group.stack === 'file-read' || group.stack === 'file-edit'
  const isCommandStack = group.stack === 'command'
  const detailText = group.actions
    .map(a => a.result)
    .filter(Boolean)
    .map(r => cleanResultForDisplay(String(r)))
    .join('\n\n')
  const hasDetails = Boolean(detailText) || allPaths.length > 3 || (isCommandStack && group.actions.length > 0)

  const statusIcon = failed ? (
    <CircleAlert className="size-3.5 shrink-0 text-red-300" strokeWidth={1.8} />
  ) : running ? null : (
    <Check className="size-3.5 shrink-0 text-emerald-300/85" strokeWidth={2.4} />
  )

  const body = (
    <div
      className={cn(
        'group flex w-full min-h-[44px] items-start gap-3 rounded-lg px-2 py-2.5 text-left transition-colors sm:min-h-[48px] sm:py-2.5 lg:min-h-[52px]',
        'hover:bg-white/[0.055]',
        running && 'agent-step-active bg-gradient-to-r from-blue-500/10 to-transparent',
        hasDetails && 'cursor-pointer',
      )}
    >
      {hasDetails ? (
        <ChevronRight
          className={cn(
            'mt-1 size-4 shrink-0 text-white/40 transition-transform',
            open && 'rotate-90',
          )}
          strokeWidth={1.8}
        />
      ) : (
        <span className="mt-1 size-4 shrink-0" />
      )}

      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md sm:h-[30px] sm:w-[30px] lg:h-8 lg:w-8">
        <ActionIcon kind={group.kind} status={running ? 'running' : failed ? 'error' : 'done'} />
      </span>

      <div className="min-w-0 flex-1">
        {/* Mobile: label + files on separate lines; desktop: inline */}
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-start sm:gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="tool-label shrink-0 text-sm font-semibold text-white/85">{group.label}</span>
            <span className="ml-auto flex shrink-0 items-center gap-2 sm:hidden">
              {group.actions.length > 1 && !isFileStack && (
                <span className="text-xs text-white/35">×{group.actions.length}</span>
              )}
              {statusIcon}
            </span>
          </div>
          {isFileStack && allPaths.length > 0 && (
            <div className="min-w-0 flex-1">
              <FileChipStack paths={allPaths} />
            </div>
          )}
          {!isFileStack && !isCommandStack && (
            <span className="tool-meta min-w-0 flex-1 truncate font-mono text-[13px] text-white/50">
              {meta.command || meta.paths[0] || primary.displayName || getActionDisplayName(primary.toolName, typeof primary.args === 'string' ? primary.args : JSON.stringify(primary.args || {}))}
            </span>
          )}
          <span className="ml-auto mt-0.5 hidden shrink-0 items-center gap-2 sm:flex">
            {group.actions.length > 1 && !isFileStack && (
              <span className="text-xs text-white/35">×{group.actions.length}</span>
            )}
            {statusIcon}
          </span>
        </div>

        {isCommandStack && <CommandStack actions={group.actions} />}
      </div>
    </div>
  )

  if (!hasDetails) {
    return (
      <div data-active={running ? 'true' : 'false'} className={cn(running && 'agent-group')}
      >
        {body}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        data-active={running ? 'true' : 'false'}
        className={cn(running && 'agent-group')}
      >
        <CollapsibleTrigger asChild>
          <button type="button" className="w-full text-left">
            {body}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-9 mt-1 border-l border-white/15 pl-4">
          {allPaths.length > 0 && (
            <div className="mb-2 space-y-1.5 py-1">
              {allPaths.map((path, i) => (
                <div key={`${path}-${i}`} className="flex min-w-0 items-center gap-2">
                  <FileTypeIcon path={path} size={14} />
                  <span className="agent-path truncate font-mono text-[12px] text-white/55">{path}</span>
                  <button
                    type="button"
                    className="ml-auto hidden shrink-0 rounded-md p-1.5 text-white/35 hover:bg-white/[0.055] hover:text-white/70 sm:inline-flex"
                    aria-label="Copy path"
                    onClick={(e) => {
                      e.stopPropagation()
                      void navigator.clipboard?.writeText(path).catch(() => {})
                    }}
                  >
                    <Copy className="size-3.5" strokeWidth={1.8} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {detailText && (
            <div className="relative">
              <pre className="tool-log agent-output max-h-[360px] overflow-auto py-2 font-mono text-xs leading-5 text-white/60 whitespace-pre-wrap break-words">
                {detailText.slice(0, 8000)}
              </pre>
              <button
                type="button"
                className="absolute right-1 top-1 rounded-md p-1.5 text-white/35 hover:bg-white/[0.055] hover:text-white/70"
                aria-label="Copy output"
                onClick={(e) => {
                  e.stopPropagation()
                  void navigator.clipboard?.writeText(detailText).catch(() => {})
                }}
              >
                <Copy className="size-3.5" strokeWidth={1.8} />
              </button>
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
})

function stackActions(actions: StreamingAction[]): StackedGroup[] {
  const groups: StackedGroup[] = []

  for (const action of actions) {
    const meta = resolveActionMeta(action)
    const stack = stackGroupForKind(meta.kind)
    const active = action.status === 'running' || action.status === 'pending'
    const last = groups[groups.length - 1]

    // Consecutive same stack kind merges (file reads/edits, commands by meaning).
    // Running and finished stay in separate groups so the active rail stays accurate.
    const canMerge =
      Boolean(last) &&
      last!.stack === stack &&
      stack !== 'solo' &&
      last!.active === active

    if (canMerge && last) {
      last.actions.push(action)
      last.active = last.active || active
      // Prefer a more specific label when the stack grows (e.g. Create → Edit file)
      if (meta.label && meta.label !== last.label && stack === 'file-edit') {
        last.label = 'Edit file'
      }
      continue
    }

    groups.push({
      key: `${action.id}-${stack}`,
      stack,
      kind: meta.kind,
      label: meta.label,
      actions: [action],
      active,
    })
  }

  return groups
}

export const ActionsList = memo(function ActionsList({ actions, isLive = false }: ActionsListProps) {
  const filtered = useMemo(
    () => actions.filter(a => a.toolName !== 'drawDiagram'),
    [actions],
  )
  const groups = useMemo(() => stackActions(filtered), [filtered])

  if (filtered.length === 0) return null

  const runningN = filtered.filter(a => a.status === 'running' || a.status === 'pending').length
  const errN = filtered.filter(a => a.status === 'error').length

  return (
    <section className="agent-feed my-2 space-y-1.5 sm:space-y-2">
      {(isLive || runningN > 0 || errN > 0) && (
        <div className="mb-1 flex items-center gap-2 px-2 text-[12px] text-white/40">
          {runningN > 0 ? (
            <>
              <LoaderCircle className="size-3.5 animate-spin text-blue-300" strokeWidth={1.8} />
              <span>Running {runningN} action{runningN === 1 ? '' : 's'}…</span>
            </>
          ) : errN > 0 ? (
            <>
              <CircleAlert className="size-3.5 text-red-300" strokeWidth={1.8} />
              <span>Needs attention · {errN} failed</span>
            </>
          ) : (
            <>
              <Check className="size-3.5 text-emerald-300/80" strokeWidth={2.4} />
              <span>{filtered.length} action{filtered.length === 1 ? '' : 's'}</span>
            </>
          )}
        </div>
      )}

      <div
        className={cn(
          'space-y-1',
          runningN > 0 && 'agent-group border-l border-white/10 ml-[15px] pl-5 data-[active=true]:border-blue-400/55',
        )}
        data-active={runningN > 0 ? 'true' : 'false'}
        style={runningN > 0 ? { borderColor: 'rgb(96 165 250 / 0.55)' } : undefined}
      >
        {groups.map((group) => (
          <ToolGroupRow key={group.key} group={group} />
        ))}
      </div>
    </section>
  )
})

// Re-export helpers used by Chat historical mapping
export { getActionDisplayName, normalizeAgentTool }
