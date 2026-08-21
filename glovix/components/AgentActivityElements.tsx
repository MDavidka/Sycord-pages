'use client'

import { useMemo, useState } from 'react'
import {
  BrainCircuit,
  FileCode2,
  FileSearch,
  Globe2,
  Search,
  SquareTerminal,
  Wrench,
  type LucideIcon,
} from 'lucide-react'

import { Chart } from '@/components/elements/chart'
import { DataTable } from '@/components/elements/data-table'
import { GuardrailNotice } from '@/components/elements/guardrail-notice'
import { PermissionGrant, type GrantScope } from '@/components/elements/permission-grant'
import { ReasoningPanel } from '@/components/elements/reasoning-panel'
import { StoppedRun } from '@/components/elements/stopped-run'
import { TerminalBlock } from '@/components/elements/terminal-block'
import { ToolTimeline } from '@/components/elements/tool-timeline'
import { WebSearch } from '@/components/elements/web-search'
import { cn } from '@/lib/utils'

import type { StreamingAction } from './ActionsList'

type PermissionRequest = {
  capability: string
  requester: string
  reach: string[]
  onGrant: (scope: GrantScope) => void
}

interface AgentActivityElementsProps {
  actions: StreamingAction[]
  thinking?: string
  thinkingTime?: number
  isLive: boolean
  elapsedSeconds?: number
  selectedModel?: string
  contextTokens?: number
  contextLimit?: number
  stoppedReason?: string | null
  partialResponse?: string
  onContinue?: () => void
  onDiscard?: () => void
  permissionRequest?: PermissionRequest | null
}

const commandPattern = /command|bash|shell|terminal|execute|install|lint|test|typecheck|preview/i
const searchPattern = /search|grep|web/i
const guardrailPattern = /(?:can't|cannot|unable to|won't|refus|blocked|policy|not allowed)/i

function parseArguments(value: unknown): Record<string, unknown> {
  if (!value) return {}
  if (typeof value === 'object') return value as Record<string, unknown>
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {}
  } catch {
    return {}
  }
}

function actionIcon(action: StreamingAction): LucideIcon {
  const name = action.toolName.toLowerCase()
  if (searchPattern.test(name)) return name.includes('web') ? Globe2 : Search
  if (commandPattern.test(name)) return SquareTerminal
  if (/read|file/.test(name)) return FileSearch
  if (/edit|write|patch/.test(name)) return FileCode2
  if (/think|plan/.test(name)) return BrainCircuit
  return Wrench
}

function actionVerb(action: StreamingAction): string {
  const name = action.toolName.toLowerCase()
  if (searchPattern.test(name)) return name.includes('web') ? 'Searching' : 'Finding'
  if (/read/.test(name)) return 'Reading'
  if (/edit|write|patch/.test(name)) return 'Editing'
  if (/install/.test(name)) return 'Installing'
  if (/lint|test|typecheck|validat/.test(name)) return 'Validating'
  if (commandPattern.test(name)) return 'Running'
  if (/think|plan/.test(name)) return 'Planning'
  return 'Using'
}

function actionTarget(action: StreamingAction): string {
  const args = parseArguments(action.args)
  const candidate = args.path || args.file || args.file_path || args.command || args.query || args.pattern || action.displayName || action.toolName
  const text = String(candidate || action.toolName)
  return text.length > 52 ? `${text.slice(0, 49)}…` : text
}

function actionDuration(action: StreamingAction): number {
  if (!action.startedAt) return 0
  return Math.max(0, (action.completedAt || Date.now()) - action.startedAt)
}

function terminalFrom(actions: StreamingAction[]) {
  const action = [...actions].reverse().find((entry) => commandPattern.test(entry.toolName))
  if (!action) return null
  const args = parseArguments(action.args)
  const command = String(args.command || args.cmd || action.displayName || action.toolName)
  const lines = String(action.result || '').split('\n').map((line) => line.trimEnd()).filter(Boolean)
  return { command, lines: lines.length > 0 ? lines : ['Waiting for command output…'], done: action.status === 'done' || action.status === 'error' }
}

function searchesFrom(actions: StreamingAction[]) {
  const searchActions = actions.filter((entry) => searchPattern.test(entry.toolName))
  const latest = searchActions.at(-1)
  if (!latest) return null
  const args = parseArguments(latest.args)
  const query = String(args.query || args.pattern || latest.displayName || latest.toolName)
  const lines = String(latest.result || '').split('\n').map((line) => line.trim()).filter(Boolean)
  const results = lines.slice(0, 5).map((line, index) => ({
    title: line.length > 100 ? `${line.slice(0, 97)}…` : line,
    domain: `source-${index + 1}`,
  }))
  return { query, results: results.length > 0 ? results : [{ title: 'Searching for matching sources…', domain: 'pending' }], searching: latest.status === 'running' || latest.status === 'pending' }
}

function reasoningSteps(thinking: string | undefined, actions: StreamingAction[]) {
  const explicit = (thinking || '').split(/\n{2,}/).map((item) => item.trim()).filter(Boolean)
  if (explicit.length > 0) {
    return explicit.map((body, index) => ({
      title: index === explicit.length - 1 ? 'Current reasoning' : `Reasoning step ${index + 1}`,
      body,
    }))
  }
  return actions
    .filter((action) => /think|plan/.test(action.toolName))
    .map((action) => ({ title: action.displayName || 'Agent reasoning', body: action.result || actionTarget(action) }))
}

export function AgentActivityElements({
  actions,
  thinking,
  thinkingTime,
  isLive,
  elapsedSeconds,
  selectedModel = 'Syra',
  contextTokens = 0,
  contextLimit = 0,
  stoppedReason,
  partialResponse,
  onContinue,
  onDiscard,
  permissionRequest,
}: AgentActivityElementsProps) {
  const [reasoningOpen, setReasoningOpen] = useState(isLive)
  const [timelineOpen, setTimelineOpen] = useState(isLive)
  const [grantScope, setGrantScope] = useState<GrantScope | 'pending'>('pending')

  const reasoning = useMemo(() => reasoningSteps(thinking, actions), [thinking, actions])
  const timelineSteps = useMemo(() => actions.slice(-12).map((action) => ({
    verb: actionVerb(action),
    chip: actionTarget(action),
    icon: actionIcon(action),
  })), [actions])
  const stats = useMemo(() => actions
    .filter((action) => /edit|write|patch|create|delete/.test(action.toolName))
    .slice(-5)
    .map((action) => ({ file: actionTarget(action), added: action.status === 'done' ? 1 : 0 })), [actions])
  const terminal = useMemo(() => terminalFrom(actions), [actions])
  const search = useMemo(() => searchesFrom(actions), [actions])
  const guardrail = useMemo(() => actions.find((action) => action.status === 'error' && guardrailPattern.test(`${action.displayName} ${action.result || ''}`)), [actions])
  const activityPoints = useMemo(() => actions.slice(-12).map((action) => Math.max(1, Math.round(actionDuration(action) / 1000))), [actions])
  const visibleActions = actions.length
  const totalElapsed = elapsedSeconds ?? Math.max(0, ...actions.map(actionDuration).map((value) => Math.round(value / 1000)))

  if (actions.length === 0 && reasoning.length === 0 && !stoppedReason && !permissionRequest) return null

  return (
    <section className="space-y-3 py-1" aria-label="Agent activity">
      {reasoning.length > 0 && (
        <ReasoningPanel
          steps={reasoning}
          visibleSteps={reasoning.length}
          streaming={isLive}
          open={reasoningOpen}
          onOpenChange={setReasoningOpen}
          restingLabel={thinkingTime ? `Reasoned for ${thinkingTime}s` : `Reasoned through ${reasoning.length} step${reasoning.length === 1 ? '' : 's'}`}
          elapsed={isLive ? `${totalElapsed}s` : undefined}
          className="max-w-none"
        />
      )}

      {timelineSteps.length > 0 && (
        <ToolTimeline
          steps={timelineSteps}
          visibleSteps={timelineSteps.length}
          streaming={isLive}
          open={timelineOpen}
          onOpenChange={setTimelineOpen}
          restingLabel={`Worked through ${visibleActions} step${visibleActions === 1 ? '' : 's'}`}
          activeLabel={`Working for ${totalElapsed}s`}
          stats={stats}
          className="max-w-none"
        />
      )}

      {terminal && (
        <TerminalBlock
          command={terminal.command}
          lines={terminal.lines}
          visibleCount={terminal.lines.length}
          done={terminal.done}
          variant="ink"
          className="max-w-none"
        />
      )}

      {search && (
        <WebSearch
          query={search.query}
          results={search.results}
          visibleResults={search.results.length}
          searching={search.searching}
          cycle={actions.length}
          className="max-w-none"
        />
      )}

      {permissionRequest && (
        <PermissionGrant
          capability={permissionRequest.capability}
          requester={permissionRequest.requester}
          reach={permissionRequest.reach}
          scope={grantScope}
          onGrant={(scope) => {
            setGrantScope(scope)
            permissionRequest.onGrant(scope)
          }}
          className="max-w-none"
        />
      )}

      {guardrail && (
        <GuardrailNotice
          title="The agent stopped at a safety boundary"
          explanation={guardrail.result || guardrail.displayName}
          policy="guardrail"
          alternatives={['Review the safe alternative', 'Explain the constraint']}
          className="max-w-none"
        />
      )}

      {stoppedReason && (
        <StoppedRun
          words={(partialResponse || '').split(/\s+/).filter(Boolean)}
          reason={stoppedReason}
          onContinue={onContinue}
          onDiscard={onDiscard}
          className="max-w-none"
        />
      )}

      {actions.length > 0 && !isLive && (
        <div className="grid gap-3 sm:grid-cols-2">
          <DataTable
            rows={[{
              name: selectedModel,
              context: contextLimit > 0 ? `${Math.round((contextTokens / contextLimit) * 100)}%` : '—',
              cost: `${actions.length} steps`,
            }]}
            cycle={actions.length}
            className="max-w-none"
          />
          <Chart
            label="Agent step duration"
            value={`${actions.length} steps`}
            delta={activityPoints.length > 1 ? `${activityPoints.at(-1)}s latest` : undefined}
            points={activityPoints.length > 0 ? activityPoints : [0]}
            visibleCount={activityPoints.length || 1}
            variant="bars"
            className="max-w-none"
          />
        </div>
      )}

      <p className={cn('sr-only', isLive && 'not-sr-only text-xs text-foreground/40')}> 
        {isLive ? 'Agent activity is streaming.' : 'Agent activity is complete.'}
      </p>
    </section>
  )
}
