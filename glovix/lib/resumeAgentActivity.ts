import type { ModelType } from './ai'
import type { AgentStreamEvent } from './continueAgent'
import { getHostProjectId } from './api'
import {
  completeAgentSession,
  loadAgentSession,
  markAgentSessionPending,
  updateAgentSessionSinceId,
} from './agentSession'
import {
  applyAgentStreamEvent,
  createAgentMessageState,
  finalizeAgentMessageState,
  type AgentMessageState,
} from './applyAgentEvents'

const POLL_MS = 2000

type PollResponse = {
  ok: boolean
  sinceId?: number
  processing?: boolean
  terminal?: string
  assistantText?: string
  events?: AgentStreamEvent[]
  error?: string
}

async function fetchAgentActivity(
  projectId: string,
  sinceId: number,
  assistantText: string,
): Promise<PollResponse> {
  const params = new URLSearchParams({
    projectId,
    since_id: String(sinceId),
    assistantText,
  })
  const res = await fetch(`/api/ai/agent/activity?${params.toString()}`, {
    headers: { Accept: 'application/json' },
  })
  return res.json().catch(() => ({ ok: false, error: `HTTP ${res.status}` }))
}

export async function pollAgentActivityOnce(options: {
  projectId: string
  sinceId: number
  state: AgentMessageState
  thinkingStart?: number
}): Promise<{
  state: AgentMessageState
  sinceId: number
  processing: boolean
  terminal: string | null
}> {
  const data = await fetchAgentActivity(options.projectId, options.sinceId, options.state.assistantText)
  if (!data.ok) {
    throw new Error(data.error || 'Activity poll failed')
  }

  let state = { ...options.state }
  const thinkingStart = options.thinkingStart ?? Date.now()
  const events = Array.isArray(data.events) ? data.events : []

  for (const event of events) {
    state = applyAgentStreamEvent(state, event, thinkingStart)
  }

  if (typeof data.assistantText === 'string' && data.assistantText.length > state.assistantText.length) {
    state.assistantText = data.assistantText
  }

  const sinceId = Math.max(options.sinceId, data.sinceId ?? options.sinceId, state.sinceId)
  updateAgentSessionSinceId(options.projectId, sinceId, state.requestId)

  return {
    state,
    sinceId,
    processing: Boolean(data.processing),
    terminal: data.terminal || null,
  }
}

export async function resumeAgentActivity(options: {
  projectId?: string
  onUpdate: (state: AgentMessageState) => void
  onComplete?: () => void
  signal?: AbortSignal
}): Promise<boolean> {
  const projectId = options.projectId || getHostProjectId()
  if (!projectId) return false

  const session = loadAgentSession(projectId)
  let sinceId = session?.sinceId ?? 0
  let state = createAgentMessageState()
  const thinkingStart = session?.startedAt ?? Date.now()

  const initial = await fetchAgentActivity(projectId, sinceId, '')
  if (!initial.ok) return false

  const shouldResume = Boolean(session?.pending) || Boolean(initial.processing)
  if (!shouldResume) return false

  markAgentSessionPending(projectId, sinceId, session?.requestId)

  while (!options.signal?.aborted) {
    const tick = await pollAgentActivityOnce({
      projectId,
      sinceId,
      state,
      thinkingStart,
    })

    state = tick.state
    sinceId = tick.sinceId
    options.onUpdate(state)

    if (tick.terminal === 'completed' || tick.terminal === 'failed' || !tick.processing) {
      if (tick.terminal === 'completed' || state.assistantText.trim()) {
        options.onUpdate(finalizeAgentMessageState(state))
      }
      completeAgentSession(projectId)
      options.onComplete?.()
      return true
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }

  return false
}

export async function probeBackgroundAgent(projectId?: string): Promise<{
  processing: boolean
  sinceId: number
}> {
  const id = projectId || getHostProjectId()
  if (!id) return { processing: false, sinceId: 0 }

  const session = loadAgentSession(id)
  const data = await fetchAgentActivity(id, session?.sinceId ?? 0, '')
  if (!data.ok) return { processing: false, sinceId: session?.sinceId ?? 0 }

  return {
    processing: Boolean(data.processing || session?.pending),
    sinceId: data.sinceId ?? session?.sinceId ?? 0,
  }
}
