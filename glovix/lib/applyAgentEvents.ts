import type { AgentActivityItem } from './agentActivity'
import { mergeAgentActivity } from './agentActivity'
import type { AgentStreamEvent } from './continueAgent'

export type AgentMessageState = {
  assistantText: string
  activities: AgentActivityItem[]
  thinkingText: string
  thinkingDuration?: number
  sinceId: number
  requestId?: string
}

export function createAgentMessageState(): AgentMessageState {
  return {
    assistantText: '',
    activities: [],
    thinkingText: '',
    sinceId: 0,
  }
}

export function applyAgentStreamEvent(
  state: AgentMessageState,
  event: AgentStreamEvent,
  thinkingStart = Date.now(),
): AgentMessageState {
  const next = { ...state, activities: [...state.activities] }

  if (event.type === 'meta') {
    next.sinceId = Math.max(next.sinceId, event.sinceId)
    if (event.requestId) next.requestId = event.requestId
    return next
  }

  if (event.type === 'delta') {
    next.assistantText += event.text
    return next
  }

  if (event.type === 'snapshot') {
    next.assistantText = event.text
    return next
  }

  if (event.type === 'activity') {
    next.activities = mergeAgentActivity(next.activities, {
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      detail: event.detail,
      payload: event.payload,
    })

    if (event.eventType === 'thinking' || event.eventType === 'plan') {
      next.thinkingText = event.detail || event.title || next.thinkingText
    }

    if (event.eventType === 'request_completed' && next.thinkingText) {
      next.thinkingDuration = Math.max(1, Math.round((Date.now() - thinkingStart) / 1000))
    }
    return next
  }

  if (event.type === 'status' && event.status === 'running') {
    next.activities = mergeAgentActivity(next.activities, {
      eventType: 'processing',
      title: 'Working',
      detail: 'Agent is processing…',
    })
    return next
  }

  if (event.type === 'permission') {
    next.activities = mergeAgentActivity(next.activities, {
      eventType: 'tool_call',
      title: 'Tool',
      detail: event.toolName,
    })
    return next
  }

  return next
}

export function finalizeAgentMessageState(state: AgentMessageState): AgentMessageState {
  const next = { ...state, activities: [...state.activities] }

  if (!next.assistantText.trim()) {
    const completed = [...next.activities].reverse().find((a) => a.eventType === 'request_completed')
    if (completed?.detail) {
      next.assistantText = completed.detail
    }
  }

  next.activities = next.activities.map((a) =>
    a.status === 'running' ? { ...a, status: 'done' as const } : a,
  )

  return next
}
