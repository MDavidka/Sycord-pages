import {
  getSyteAgentActivityStreamUrl,
  getSyteInternalSecret,
  syteAgentActivity,
  syteInternalAgentActivity,
  type SyteAgentActivityEvent,
  type SyteAgentActivitySseMessage,
} from '@/lib/deploy/syte-client'
import type { AgentStreamEvent } from './types'

function maxActivityId(events: SyteAgentActivityEvent[] | undefined): number {
  if (!events?.length) return 0
  return events.reduce((max, event) => Math.max(max, typeof event.id === 'number' ? event.id : 0), 0)
}

export async function resolveActivitySinceId(uuid: string): Promise<number> {
  const useInternal = Boolean(getSyteInternalSecret())
  const snapshot = useInternal
    ? await syteInternalAgentActivity(uuid, 0)
    : await syteAgentActivity(uuid, 0)

  if (!snapshot.ok) return 0
  const data = snapshot.data
  if (typeof data?.since_id === 'number') return data.since_id
  return maxActivityId(data?.events)
}

async function* readSyteActivitySse(
  uuid: string,
  sinceId: number,
  headers: Record<string, string>,
  signal?: AbortSignal,
): AsyncGenerator<SyteAgentActivitySseMessage> {
  const url = getSyteAgentActivityStreamUrl(uuid, sinceId)
  const res = await fetch(url, { headers, signal })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`Syte activity stream failed (${res.status}): ${body.slice(0, 200)}`)
  }
  if (!res.body) {
    throw new Error('Syte activity stream missing body')
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }

    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const part of parts) {
      const line = part
        .split('\n')
        .map((row) => row.trim())
        .find((row) => row.startsWith('data:'))
      if (!line) continue

      try {
        yield JSON.parse(line.slice(5).trim()) as SyteAgentActivitySseMessage
      } catch {
        // ignore malformed frames
      }
    }
  }
}

function eventDetail(event: SyteAgentActivityEvent): string {
  const detail = typeof event.detail === 'string' ? event.detail.trim() : ''
  if (detail) return detail
  const path =
    event.payload && typeof event.payload.path === 'string' ? event.payload.path.trim() : ''
  return path
}

function mapActivityToStreamEvents(
  event: SyteAgentActivityEvent,
  assistantText: string,
): { events: AgentStreamEvent[]; assistantText: string; terminal: 'none' | 'completed' | 'failed' } {
  const out: AgentStreamEvent[] = []
  let nextAssistantText = assistantText
  let terminal: 'none' | 'completed' | 'failed' = 'none'
  const eventType = String(event.event_type || 'activity')
  const detail = eventDetail(event)
  const title = String(event.title || '')

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

  return { events: out, assistantText: nextAssistantText, terminal }
}

export async function* streamSyteAgentActivity(
  uuid: string,
  sinceId: number,
  headers: Record<string, string>,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  let assistantText = ''
  let completed = false

  for await (const frame of readSyteActivitySse(uuid, sinceId, headers, signal)) {
    if (frame.type === 'ping') continue

    if (frame.type === 'processing') {
      const ev = frame.event
      yield {
        type: 'activity',
        eventType: 'processing',
        title: ev?.title || 'Working',
        detail: ev?.detail || 'Agent is processing…',
      }
      continue
    }

    if (frame.type !== 'activity' || !frame.event) continue

    const mapped = mapActivityToStreamEvents(frame.event, assistantText)
    assistantText = mapped.assistantText

    for (const event of mapped.events) {
      yield event
      if (event.type === 'error') {
        return
      }
    }

    if (mapped.terminal === 'completed') {
      completed = true
      break
    }
    if (mapped.terminal === 'failed') {
      return
    }
  }

  if (!completed && assistantText.trim()) {
    yield { type: 'done' }
    return
  }

  if (!completed) {
    throw new Error('Syte activity stream ended before the agent completed')
  }

  yield { type: 'done' }
}
