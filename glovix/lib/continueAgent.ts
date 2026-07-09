import type { ModelType } from './ai'
import { getHostProjectId } from './api'
import { buildSkillsPrompt } from './syraSkills'

export type AgentStreamEvent =
  | { type: 'status'; status: string }
  | { type: 'delta'; text: string }
  | {
      type: 'activity'
      eventType: string
      title: string
      detail: string
      id?: number
      payload?: Record<string, unknown>
    }
  | { type: 'permission'; requestId: string; toolName: string }
  | { type: 'error'; message: string }
  | { type: 'done' }

export async function streamContinueAgent(options: {
  message: string
  projectId?: string
  model: ModelType
  activeSkillIds?: string[]
  signal?: AbortSignal
  onEvent: (event: AgentStreamEvent) => void
}): Promise<void> {
  const projectId = options.projectId || getHostProjectId()
  if (!projectId) throw new Error('No project context for Continue agent')

  let message = options.message
  const skills = options.activeSkillIds?.length ? buildSkillsPrompt(options.activeSkillIds) : ''
  if (skills) {
    message = `${skills}\n\n---\n\n${message}`
  }

  const res = await fetch('/api/ai/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, message, model: options.model }),
    signal: options.signal,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error || `Agent request failed (${res.status})`)
  }
  if (!res.body) throw new Error('Agent stream missing body')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const parts = buffer.split('\n\n')
    buffer = parts.pop() || ''

    for (const part of parts) {
      const line = part.trim()
      if (!line.startsWith('data:')) continue
      try {
        options.onEvent(JSON.parse(line.slice(5).trim()) as AgentStreamEvent)
      } catch {}
    }
  }
}
