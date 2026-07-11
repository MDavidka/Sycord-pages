import {
  getSyteInternalSecret,
  syteAgentActivity,
  syteInternalAgentActivity,
  type SyteAgentActivityEvent,
  type SyteAgentActivitySseMessage,
} from '@/lib/deploy/syte-client'
import { mapSyteActivityEvent, maxEventId } from './activity-map'
import type { AgentStreamEvent } from './types'

export async function fetchAgentActivitySnapshot(
  uuid: string,
  sinceId = 0,
): Promise<{
  ok: boolean
  events: SyteAgentActivityEvent[]
  sinceId: number
  error?: string
}> {
  const useInternal = Boolean(getSyteInternalSecret())
  const result = useInternal
    ? await syteInternalAgentActivity(uuid, sinceId)
    : await syteAgentActivity(uuid, sinceId)

  if (!result.ok) {
    return { ok: false, events: [], sinceId, error: result.error || 'Activity fetch failed' }
  }

  const data = result.data
  const events = Array.isArray(data?.events) ? data.events : []
  const nextSince =
    typeof data?.since_id === 'number'
      ? data.since_id
      : Math.max(sinceId, maxEventId(events))

  return { ok: true, events, sinceId: nextSince }
}

export async function resolveActivitySinceId(uuid: string): Promise<number> {
  const snapshot = await fetchAgentActivitySnapshot(uuid, 0)
  return snapshot.sinceId
}

async function* readSyteActivitySse(
  uuid: string,
  sinceId: number,
  headers: Record<string, string>,
  signal?: AbortSignal,
): AsyncGenerator<SyteAgentActivitySseMessage> {
  const { getSyteAgentActivityStreamUrl } = await import('@/lib/deploy/syte-client')
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

export async function* streamSyteAgentActivity(
  uuid: string,
  sinceId: number,
  headers: Record<string, string>,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  let assistantText = ''
  let completed = false
  let lastSinceId = sinceId

  for await (const frame of readSyteActivitySse(uuid, sinceId, headers, signal)) {
    if (frame.type === 'ping') {
      if (typeof frame.since_id === 'number') {
        lastSinceId = Math.max(lastSinceId, frame.since_id)
        yield { type: 'meta', sinceId: lastSinceId }
      }
      continue
    }

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

    const mapped = mapSyteActivityEvent(frame.event, assistantText)
    assistantText = mapped.assistantText
    if (mapped.lastEventId) {
      lastSinceId = Math.max(lastSinceId, mapped.lastEventId)
      yield { type: 'meta', sinceId: lastSinceId }
    }

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
    yield { type: 'detached', sinceId: lastSinceId }
    return
  }

  yield { type: 'done' }
}
