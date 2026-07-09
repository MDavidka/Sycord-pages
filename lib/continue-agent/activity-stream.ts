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

function activityStatusLine(event: SyteAgentActivityEvent): string | null {
  const detail = typeof event.detail === 'string' ? event.detail.trim() : ''
  const title = typeof event.title === 'string' ? event.title.trim() : ''

  switch (event.event_type) {
    case 'thinking':
      return detail || title || 'Thinking…'
    case 'tool_call':
      return detail ? `Tool: ${detail}` : title || 'Running tool…'
    case 'command_run':
      return detail ? `Ran \`${detail}\`` : title || 'Running command…'
    case 'file_created':
      return detail ? `Created \`${detail}\`` : title || 'Created file'
    case 'file_modified':
      return detail ? `Modified \`${detail}\`` : title || 'Modified file'
    case 'file_deleted':
      return detail ? `Deleted \`${detail}\`` : title || 'Deleted file'
    case 'request_started':
      return detail || title || 'Working…'
    default:
      return null
  }
}

function mapActivityToStreamEvents(
  event: SyteAgentActivityEvent,
  assistantText: string,
): { events: AgentStreamEvent[]; assistantText: string; terminal: 'none' | 'completed' | 'failed' } {
  const out: AgentStreamEvent[] = []
  let nextAssistantText = assistantText
  let terminal: 'none' | 'completed' | 'failed' = 'none'

  out.push({
    type: 'activity',
    eventType: String(event.event_type || 'activity'),
    title: String(event.title || ''),
    detail: String(event.detail || ''),
    id: typeof event.id === 'number' ? event.id : undefined,
  })

  const status = activityStatusLine(event)
  if (status) {
    out.push({ type: 'status', status })
  }

  if (event.event_type === 'assistant_message') {
    const detail = typeof event.detail === 'string' ? event.detail : ''
    if (detail.length > nextAssistantText.length) {
      out.push({ type: 'delta', text: detail.slice(nextAssistantText.length) })
      nextAssistantText = detail
    } else if (detail && detail !== nextAssistantText) {
      out.push({ type: 'delta', text: detail })
      nextAssistantText = detail
    }
  }

  if (event.event_type === 'request_completed') {
    const detail = typeof event.detail === 'string' ? event.detail.trim() : ''
    if (detail && !nextAssistantText.includes(detail)) {
      const prefix = nextAssistantText ? '\n\n' : ''
      out.push({ type: 'delta', text: `${prefix}${detail}` })
      nextAssistantText = nextAssistantText ? `${nextAssistantText}\n\n${detail}` : detail
    }
    terminal = 'completed'
  }

  if (event.event_type === 'request_failed') {
    terminal = 'failed'
    out.push({
      type: 'error',
      message: typeof event.detail === 'string' && event.detail.trim()
        ? event.detail.trim()
        : 'Agent request failed',
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
      yield { type: 'status', status: 'running' }
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
