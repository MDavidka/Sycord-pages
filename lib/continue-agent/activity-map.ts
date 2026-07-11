import type { SyteAgentActivityEvent } from '@/lib/deploy/syte-client'
import type { AgentStreamEvent } from './types'

export function eventDetail(event: SyteAgentActivityEvent): string {
  const detail = typeof event.detail === 'string' ? event.detail.trim() : ''
  if (detail) return detail
  const path =
    event.payload && typeof event.payload.path === 'string' ? event.payload.path.trim() : ''
  if (path) return path
  const text =
    event.payload && typeof event.payload.text === 'string' ? event.payload.text.trim() : ''
  return text
}

export function maxEventId(events: SyteAgentActivityEvent[] | undefined): number {
  if (!events?.length) return 0
  return events.reduce((max, event) => Math.max(max, typeof event.id === 'number' ? event.id : 0), 0)
}

export function isAgentRequestInFlight(events: SyteAgentActivityEvent[]): boolean {
  let inFlight = false
  for (const event of events) {
    const type = String(event.event_type || '')
    if (type === 'request_started' || type === 'processing') {
      inFlight = true
    }
    if (type === 'request_completed' || type === 'request_failed') {
      inFlight = false
    }
  }
  return inFlight
}

export function mapSyteActivityEvent(
  event: SyteAgentActivityEvent,
  assistantText: string,
): {
  events: AgentStreamEvent[]
  assistantText: string
  terminal: 'none' | 'completed' | 'failed'
  lastEventId: number
} {
  const out: AgentStreamEvent[] = []
  let nextAssistantText = assistantText
  let terminal: 'none' | 'completed' | 'failed' = 'none'
  const eventType = String(event.event_type || 'activity')
  const detail = eventDetail(event)
  const title = String(event.title || '')
  const lastEventId = typeof event.id === 'number' ? event.id : 0

  if (eventType === 'token_delta') {
    const delta =
      event.payload && typeof event.payload.delta === 'string' ? event.payload.delta : ''
    if (delta) {
      out.push({ type: 'delta', text: delta })
      nextAssistantText += delta
    }
    return { events: out, assistantText: nextAssistantText, terminal, lastEventId }
  }

  if (eventType === 'message_snapshot') {
    const snapshot = detail || (event.payload?.text as string) || ''
    if (snapshot) {
      out.push({ type: 'snapshot', text: snapshot })
      nextAssistantText = snapshot
    }
    return { events: out, assistantText: nextAssistantText, terminal, lastEventId }
  }

  out.push({
    type: 'activity',
    eventType,
    title,
    detail,
    id: typeof event.id === 'number' ? event.id : undefined,
    payload: event.payload && typeof event.payload === 'object' ? event.payload : undefined,
  })

  if (eventType === 'assistant_message') {
    if (detail.length > nextAssistantText.length) {
      out.push({ type: 'delta', text: detail.slice(nextAssistantText.length) })
      nextAssistantText = detail
    } else if (detail && detail !== nextAssistantText) {
      out.push({ type: 'delta', text: detail })
      nextAssistantText = detail
    }
  }

  if (eventType === 'request_completed') {
    if (detail && !nextAssistantText.includes(detail)) {
      const prefix = nextAssistantText ? '\n\n' : ''
      out.push({ type: 'delta', text: `${prefix}${detail}` })
      nextAssistantText = nextAssistantText ? `${nextAssistantText}\n\n${detail}` : detail
    }
    terminal = 'completed'
  }

  if (eventType === 'request_failed') {
    terminal = 'failed'
    out.push({
      type: 'error',
      message: detail || 'Agent request failed',
    })
  }

  return { events: out, assistantText: nextAssistantText, terminal, lastEventId }
}

export function mapSyteActivityBatch(
  events: SyteAgentActivityEvent[],
  assistantText = '',
): {
  streamEvents: AgentStreamEvent[]
  assistantText: string
  sinceId: number
  processing: boolean
  terminal: 'none' | 'completed' | 'failed'
} {
  let text = assistantText
  let sinceId = 0
  let terminal: 'none' | 'completed' | 'failed' = 'none'
  const streamEvents: AgentStreamEvent[] = []

  for (const event of events) {
    const mapped = mapSyteActivityEvent(event, text)
    text = mapped.assistantText
    sinceId = Math.max(sinceId, mapped.lastEventId)
    streamEvents.push(...mapped.events)
    if (mapped.terminal === 'completed') terminal = 'completed'
    if (mapped.terminal === 'failed') terminal = 'failed'
  }

  return {
    streamEvents,
    assistantText: text,
    sinceId,
    processing: isAgentRequestInFlight(events),
    terminal,
  }
}
