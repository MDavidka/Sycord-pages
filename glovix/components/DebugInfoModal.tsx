'use client'

import React, { useState } from 'react'
import {
  Bug,
  Check,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Download,
  ExternalLink,
  Layers,
  Network,
  RefreshCw,
  Server,
  ShieldAlert,
  Terminal,
  X,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export interface DebugReportData {
  topLevel: {
    timestamp: string
    localTime: string
    chosenModel: {
      modelType?: string
      apiModel?: string
      label?: string
      thinkingLevel?: string
    }
    vmConnectionDetails: {
      status: 'connected' | 'connecting' | 'disconnected' | 'error' | string
      reachable?: boolean
      apiUrl?: string
      platform?: string
      latencyMs?: number | null
      tursoSessionId?: string | null
      agentSession?: number | null
      agentEventId?: number | null
      connectionsConnected?: number
      connectionsFailed?: number
      error?: string | null
      syte?: Record<string, unknown>
      coolify?: Record<string, unknown>
      dokploy?: Record<string, unknown>
    }
    creditInfo: {
      remainingCredits: number
      maxCredits: number
      formatted: string
      isPremium: boolean
      resetTime: string
    }
    projectContext: {
      projectId: string
      chatId: string
      clientUrl: string
      userAgent: string
    }
  }
  secondLevel: {
    activityLog: Array<{
      id?: string
      type:
        | 'user_asked'
        | 'vm_accepted_request'
        | 'vm_responded'
        | 'backend_displayed'
        | 'agent_used'
        | 'agent_returned_tool'
        | 'rate_limit'
        | 'model_error'
        | 'failed_task'
        | string
      timestamp: string
      details?: unknown
      prompt?: string
      attachments?: unknown[]
      messageId?: string
      vmApiUsed?: string
      latencyMs?: number
      statusCode?: number
      exactResponseDisplayed?: string
      tool?: string
      toolCallId?: string
      arguments?: unknown
      status?: string
      result?: unknown
      durationMs?: number
      error?: string
      code?: string
      isRisk?: boolean
    }>
    rateLimit: {
      encountered: boolean
      retryAfter?: number | null
      details?: unknown
    }
    modelError: {
      encountered: boolean
      error?: string | null
      code?: string | null
    }
    failedTask: {
      failed: boolean
      failedTasks: Array<{
        name?: string
        reason?: string
        eventId?: number
        timestamp?: string
      }>
    }
    connectionsSummary: {
      connected: string[]
      failed: string[]
    }
    allMessages: Array<{
      messageId: string
      role: 'user' | 'assistant' | 'system' | string
      timestamp?: number | string
      whatBackendDisplayed: string
      exactResponseDisplayed?: string
      thinking?: string
      actionsCount?: number
      actions?: unknown[]
      segments?: unknown[]
      question?: unknown
    }>
    exactResponseDisplayed: string
  }
}

export interface DebugInfoModalProps {
  isOpen: boolean
  onClose: () => void
  data: DebugReportData | null
  loading?: boolean
  onRefresh?: () => void
  isDark?: boolean
}

export interface ShareDebugWarningModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirmDownload: () => void
  debugId?: string
  isDark?: boolean
}

export function ShareDebugWarningModal({
  isOpen,
  onClose,
  onConfirmDownload,
  debugId = '5836-384638-736439',
  isDark = true,
}: ShareDebugWarningModalProps) {
  const [accepted, setAccepted] = useState(false)

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className={cn(
          'sm:max-w-md p-6 overflow-hidden border shadow-2xl rounded-3xl text-center flex flex-col items-center gap-4',
          isDark
            ? 'bg-[#18181b] border-white/[0.1] text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900',
        )}
      >
        <DialogHeader className="p-0 border-none flex flex-col items-center space-y-0">
          <DialogTitle className="text-xl font-bold tracking-tight text-center leading-snug flex items-center justify-center gap-2">
            Your are about to share <span className="text-xl">📂</span>
            <br />
            your debug with sycord
          </DialogTitle>
          <p className={cn('text-xs mt-2 max-w-xs text-center leading-relaxed', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
            Support memeber will have acces your chat history , models , spending, connection details.
          </p>
        </DialogHeader>

        {/* Debug ID Input Box */}
        <div
          className={cn(
            'w-full py-3 px-4 rounded-2xl font-mono text-center text-sm font-semibold tracking-widest border',
            isDark ? 'bg-white/[0.04] border-white/[0.1] text-zinc-200' : 'bg-zinc-100 border-zinc-200 text-zinc-700',
          )}
        >
          {debugId}
        </div>

        {/* Accept Privacy Checkbox */}
        <label className="flex items-center justify-center gap-2.5 cursor-pointer text-xs select-none mt-1">
          <input
            type="checkbox"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="size-4 rounded border-zinc-700 bg-zinc-800 text-blue-500 focus:ring-0 cursor-pointer"
          />
          <span className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
            accept privacy and policy
          </span>
        </label>

        {/* Download Zip / JSON Button */}
        <Button
          type="button"
          disabled={!accepted}
          onClick={() => {
            if (accepted) {
              onConfirmDownload()
              onClose()
            }
          }}
          className={cn(
            'w-full py-3 h-11 rounded-2xl text-sm font-semibold transition-all duration-200 mt-2',
            accepted
              ? 'bg-zinc-200 hover:bg-white text-zinc-900 shadow-lg cursor-pointer'
              : 'bg-zinc-800/80 text-zinc-500 cursor-not-allowed border border-white/[0.05]',
          )}
        >
          dowland zip
        </Button>
      </DialogContent>
    </Dialog>
  )
}

export function DebugInfoModal({
  isOpen,
  onClose,
  data,
  loading = false,
  onRefresh,
  isDark = true,
}: DebugInfoModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'json'>('overview')
  const [copied, setCopied] = useState(false)
  const [showShareWarning, setShowShareWarning] = useState(false)
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({})

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const jsonString = data ? JSON.stringify(data, null, 2) : ''

  const handleCopy = async () => {
    if (!jsonString) return
    try {
      await navigator.clipboard.writeText(jsonString)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const handleDownload = () => {
    if (!data) return
    try {
      const blob = new Blob([jsonString], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ts = new Date().toISOString().replace(/[:.]/g, '-')
      a.download = `sycord-debug-report-${data.topLevel.projectContext.projectId || 'global'}-${ts}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('[DebugModal] Download error:', e)
    }
  }

  const debugCode = data?.topLevel.projectContext.chatId
    ? `${Math.abs(data.topLevel.projectContext.chatId.split('').reduce((acc: number, c: string) => (acc << 5) - acc + c.charCodeAt(0), 0) % 9000) + 1000}-${Math.abs(data.topLevel.projectContext.chatId.split('').reduce((acc: number, c: string) => (acc << 5) - acc + c.charCodeAt(0), 0) * 31 % 900000) + 100000}-${Math.abs(data.topLevel.projectContext.chatId.split('').reduce((acc: number, c: string) => (acc << 5) - acc + c.charCodeAt(0), 0) * 17 % 900000) + 100000}`
    : '5836-384638-736439'

  return (
    <>
      <ShareDebugWarningModal
        isOpen={showShareWarning}
        onClose={() => setShowShareWarning(false)}
        onConfirmDownload={handleDownload}
        debugId={debugCode}
        isDark={isDark}
      />
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent
          className={cn(
            'sm:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden border shadow-2xl rounded-2xl',
            isDark
              ? 'bg-[#141416] border-white/[0.08] text-zinc-100'
              : 'bg-white border-zinc-200 text-zinc-900',
          )}
        >
          {/* Header */}
          <DialogHeader
            className={cn(
              'px-6 py-4 border-b flex flex-row items-center justify-between space-y-0 shrink-0',
              isDark ? 'border-white/[0.08] bg-[#18181b]' : 'border-zinc-200 bg-zinc-50/80',
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'size-9 rounded-xl flex items-center justify-center border shadow-inner',
                  isDark
                    ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                    : 'bg-blue-50 border-blue-200 text-blue-600',
                )}
              >
                <Bug className="size-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold tracking-tight flex items-center gap-2">
                  Debug Information
                  {data?.topLevel.vmConnectionDetails.status === 'connected' ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                      Live
                    </span>
                  ) : data?.secondLevel.modelError.encountered ? (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/20">
                      Error
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                      Ready
                    </span>
                  )}
                </DialogTitle>
                <p className={cn('text-xs', isDark ? 'text-zinc-400' : 'text-zinc-500')}>
                  VM connection metrics, agent activity log, model diagnostics & exact responses
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mr-6">
              {onRefresh && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={loading}
                  className={cn(
                    'h-8 px-2.5 rounded-lg text-xs gap-1.5 border',
                    isDark
                      ? 'border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                      : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
                  Refresh
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className={cn(
                  'h-8 px-2.5 rounded-lg text-xs gap-1.5 border',
                  isDark
                    ? 'border-white/[0.08] bg-white/[0.04] text-zinc-300 hover:bg-white/[0.08]'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50',
                )}
              >
                {copied ? (
                  <>
                    <Check className="size-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Copy JSON
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                onClick={() => setShowShareWarning(true)}
                className="h-8 px-2.5 rounded-lg text-xs gap-1.5 bg-blue-600 hover:bg-blue-500 text-white"
              >
                <Download className="size-3.5" />
                Download (.json)
              </Button>
            </div>
          </DialogHeader>

        {/* Tab Navigation */}
        <div
          className={cn(
            'flex items-center gap-1 px-6 pt-3 pb-2 border-b text-xs font-medium shrink-0',
            isDark ? 'border-white/[0.06] bg-[#141416]' : 'border-zinc-200 bg-white',
          )}
        >
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5',
              activeTab === 'overview'
                ? isDark
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'bg-zinc-100 text-zinc-900 font-semibold'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50',
            )}
          >
            <Server className="size-3.5" />
            Top-Level Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5',
              activeTab === 'timeline'
                ? isDark
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'bg-zinc-100 text-zinc-900 font-semibold'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50',
            )}
          >
            <Layers className="size-3.5" />
            Activity Log & Timeline
            {data?.secondLevel.activityLog && data.secondLevel.activityLog.length > 0 && (
              <span className="size-4 rounded-full bg-blue-500/20 text-blue-400 text-[10px] flex items-center justify-center font-mono">
                {data.secondLevel.activityLog.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('json')}
            className={cn(
              'px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5',
              activeTab === 'json'
                ? isDark
                  ? 'bg-white/[0.08] text-white font-semibold'
                  : 'bg-zinc-100 text-zinc-900 font-semibold'
                : isDark
                ? 'text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04]'
                : 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-50',
            )}
          >
            <Terminal className="size-3.5" />
            Full Raw JSON
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!data ? (
            <div className="py-12 text-center text-zinc-400 text-sm">
              Loading debug telemetry...
            </div>
          ) : activeTab === 'overview' ? (
            <div className="space-y-4">
              {/* Stat Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Model */}
                <div
                  className={cn(
                    'p-3.5 rounded-xl border flex flex-col justify-between space-y-2',
                    isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200',
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Chosen Model</span>
                    <Cpu className="size-3.5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold truncate">
                      {data.topLevel.chosenModel.label || data.topLevel.chosenModel.apiModel || 'Default'}
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">
                      Profile: {data.topLevel.chosenModel.modelType || 'syra-base'}
                    </div>
                  </div>
                </div>

                {/* VM Connection */}
                <div
                  className={cn(
                    'p-3.5 rounded-xl border flex flex-col justify-between space-y-2',
                    isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200',
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>VM Connection</span>
                    <Network
                      className={cn(
                        'size-3.5',
                        data.topLevel.vmConnectionDetails.reachable
                          ? 'text-emerald-400'
                          : 'text-amber-400',
                      )}
                    />
                  </div>
                  <div>
                    <div className="text-sm font-semibold flex items-center gap-1.5">
                      <span
                        className={cn(
                          'size-2 rounded-full',
                          data.topLevel.vmConnectionDetails.reachable
                            ? 'bg-emerald-400'
                            : 'bg-amber-400',
                        )}
                      />
                      {data.topLevel.vmConnectionDetails.platform?.toUpperCase() || 'SYTE'} (
                      {data.topLevel.vmConnectionDetails.status})
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Latency:{' '}
                      {typeof data.topLevel.vmConnectionDetails.latencyMs === 'number'
                        ? `${data.topLevel.vmConnectionDetails.latencyMs}ms`
                        : 'Live'}
                    </div>
                  </div>
                </div>

                {/* Credits */}
                <div
                  className={cn(
                    'p-3.5 rounded-xl border flex flex-col justify-between space-y-2',
                    isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200',
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Credit Balance</span>
                    <Zap className="size-3.5 text-blue-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-400">
                      {data.topLevel.creditInfo.formatted}
                    </div>
                    {/* Blue status bar */}
                    <div className="w-full bg-blue-500/20 rounded-full h-1.5 overflow-hidden my-1">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            Math.max(
                              0,
                              (data.topLevel.creditInfo.remainingCredits /
                                Math.max(1, data.topLevel.creditInfo.maxCredits)) *
                                100,
                            ),
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="text-[10px] text-zinc-500">
                      {data.topLevel.creditInfo.resetTime}
                    </div>
                  </div>
                </div>

                {/* Session */}
                <div
                  className={cn(
                    'p-3.5 rounded-xl border flex flex-col justify-between space-y-2',
                    isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200',
                  )}
                >
                  <div className="flex items-center justify-between text-xs text-zinc-400">
                    <span>Durable Session</span>
                    <Clock className="size-3.5 text-zinc-400" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold font-mono truncate">
                      {data.topLevel.vmConnectionDetails.tursoSessionId
                        ? data.topLevel.vmConnectionDetails.tursoSessionId.slice(0, 10) + '…'
                        : 'Local'}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      Events: {data.topLevel.vmConnectionDetails.agentEventId ?? 0}
                    </div>
                  </div>
                </div>
              </div>

              {/* Exact Response Displayed */}
              <div
                className={cn(
                  'p-4 rounded-xl border space-y-2',
                  isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200',
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                    <Terminal className="size-3.5 text-blue-400" />
                    Exact Response Displayed on Frontend
                  </span>
                  <span className="text-[11px] text-zinc-500 font-mono">
                    {data.secondLevel.exactResponseDisplayed
                      ? `${data.secondLevel.exactResponseDisplayed.length} chars`
                      : 'Empty'}
                  </span>
                </div>
                <div
                  className={cn(
                    'p-3 rounded-lg font-mono text-xs max-h-48 overflow-y-auto whitespace-pre-wrap break-words border',
                    isDark
                      ? 'bg-[#0e0e10] border-white/[0.04] text-zinc-200'
                      : 'bg-white border-zinc-200 text-zinc-800',
                  )}
                >
                  {data.secondLevel.exactResponseDisplayed || 'No assistant response rendered yet.'}
                </div>
              </div>

              {/* VM Connection & Endpoints Detail */}
              <div
                className={cn(
                  'p-4 rounded-xl border space-y-3',
                  isDark ? 'bg-white/[0.02] border-white/[0.06]' : 'bg-zinc-50 border-zinc-200',
                )}
              >
                <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  VM Connection & Network Telemetry
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-zinc-500">API Endpoint: </span>
                    <span className="font-mono text-zinc-300">
                      {data.topLevel.vmConnectionDetails.apiUrl || '/api/projects/[id]/agent'}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Connections Connected: </span>
                    <span className="font-semibold text-emerald-400">
                      {data.topLevel.vmConnectionDetails.connectionsConnected ?? 1} active
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Connections Failed: </span>
                    <span
                      className={cn(
                        'font-semibold',
                        (data.topLevel.vmConnectionDetails.connectionsFailed ?? 0) > 0
                          ? 'text-rose-400'
                          : 'text-zinc-400',
                      )}
                    >
                      {data.topLevel.vmConnectionDetails.connectionsFailed ?? 0} failed
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Project ID: </span>
                    <span className="font-mono text-zinc-300">
                      {data.topLevel.projectContext.projectId || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'timeline' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-zinc-400 mb-2">
                <span>Chronological Execution Flow</span>
                <span>{data.secondLevel.activityLog.length} events recorded</span>
              </div>

              {data.secondLevel.activityLog.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">
                  No activity recorded in the current session yet. Ask a question to start.
                </div>
              ) : (
                <div className="relative pl-6 space-y-3 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-white/[0.08]">
                  {data.secondLevel.activityLog.map((act: any, idx: number) => {
                    const id = act.id || `act-${idx}`
                    const isExpanded = expandedItems[id]

                    let badgeColor = 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    let label = act.type

                    if (act.type === 'user_asked') {
                      badgeColor = 'bg-blue-500/15 text-blue-400 border-blue-500/30'
                      label = 'User Asked'
                    } else if (act.type === 'vm_accepted_request') {
                      badgeColor = 'bg-purple-500/15 text-purple-400 border-purple-500/30'
                      label = 'VM Accepted Request'
                    } else if (act.type === 'agent_used') {
                      badgeColor = 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      label = `Agent Used Tool: ${act.tool || ''}`
                    } else if (act.type === 'agent_returned_tool') {
                      badgeColor = act.status === 'error'
                        ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      label = `Tool Returned: ${act.tool || ''} (${act.status || 'done'})`
                    } else if (act.type === 'vm_responded') {
                      badgeColor = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30'
                      label = 'VM Responded'
                    } else if (act.type === 'backend_displayed') {
                      badgeColor = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                      label = 'Backend Displayed'
                    } else if (act.type === 'model_error' || act.type === 'failed_task') {
                      badgeColor = 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      label = 'Error / Failed Task'
                    }

                    return (
                      <div key={id} className="relative group">
                        {/* Dot indicator */}
                        <div className="absolute -left-6 top-1.5 size-2 rounded-full bg-blue-400 ring-4 ring-[#141416]" />

                        <div
                          className={cn(
                            'p-3 rounded-xl border transition-all text-xs',
                            isDark
                              ? 'bg-white/[0.02] border-white/[0.06] hover:border-white/[0.12]'
                              : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300',
                          )}
                        >
                          <div
                            className="flex items-center justify-between cursor-pointer"
                            onClick={() => toggleExpand(id)}
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  'px-2 py-0.5 rounded-md font-medium border text-[11px]',
                                  badgeColor,
                                )}
                              >
                                {label}
                              </span>
                              {act.latencyMs !== undefined && (
                                <span className="text-zinc-500 text-[11px] font-mono">
                                  {act.latencyMs}ms latency
                                </span>
                              )}
                              {act.durationMs !== undefined && (
                                <span className="text-zinc-500 text-[11px] font-mono">
                                  took {act.durationMs}ms
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-zinc-500 text-[10px] font-mono">
                                {new Date(act.timestamp).toLocaleTimeString()}
                              </span>
                              {isExpanded ? (
                                <ChevronDown className="size-3.5 text-zinc-400" />
                              ) : (
                                <ChevronRight className="size-3.5 text-zinc-400" />
                              )}
                            </div>
                          </div>

                          {/* Preview snippet when collapsed */}
                          {!isExpanded && (
                            <div className="mt-1.5 text-zinc-400 truncate text-[11px] font-mono">
                              {act.prompt ||
                                act.exactResponseDisplayed ||
                                (typeof act.result === 'string' ? act.result : '') ||
                                act.vmApiUsed ||
                                act.error ||
                                ''}
                            </div>
                          )}

                          {/* Full details when expanded */}
                          {isExpanded && (
                            <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-2">
                              {act.prompt && (
                                <div>
                                  <span className="text-zinc-500 font-semibold block mb-0.5">
                                    User Prompt:
                                  </span>
                                  <div className="p-2 rounded bg-black/30 font-mono text-[11px] whitespace-pre-wrap">
                                    {act.prompt}
                                  </div>
                                </div>
                              )}
                              {act.exactResponseDisplayed && (
                                <div>
                                  <span className="text-zinc-500 font-semibold block mb-0.5">
                                    Exact Response Displayed:
                                  </span>
                                  <div className="p-2 rounded bg-black/30 font-mono text-[11px] whitespace-pre-wrap">
                                    {act.exactResponseDisplayed}
                                  </div>
                                </div>
                              )}
                              {act.arguments !== undefined && (
                                <div>
                                  <span className="text-zinc-500 font-semibold block mb-0.5">
                                    Tool Arguments:
                                  </span>
                                  <pre className="p-2 rounded bg-black/30 font-mono text-[11px] overflow-x-auto">
                                    {typeof act.arguments === 'string'
                                      ? act.arguments
                                      : JSON.stringify(act.arguments, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {act.result !== undefined && (
                                <div>
                                  <span className="text-zinc-500 font-semibold block mb-0.5">
                                    Tool Result:
                                  </span>
                                  <pre className="p-2 rounded bg-black/30 font-mono text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap">
                                    {typeof act.result === 'string'
                                      ? act.result
                                      : JSON.stringify(act.result, null, 2)}
                                  </pre>
                                </div>
                              )}
                              {act.error && (
                                <div className="text-rose-400 font-mono text-[11px]">
                                  Error: {act.error}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="relative">
              <pre
                className={cn(
                  'p-4 rounded-xl font-mono text-xs leading-relaxed max-h-[50vh] overflow-y-auto border whitespace-pre-wrap break-all',
                  isDark
                    ? 'bg-[#0c0c0e] border-white/[0.06] text-blue-300/90'
                    : 'bg-zinc-900 border-zinc-800 text-blue-300',
                )}
              >
                {jsonString}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
