export type AgentActivityStatus = 'running' | 'done' | 'error'

export interface AgentActivityItem {
  key: string
  id?: number
  eventType: string
  title: string
  detail: string
  status: AgentActivityStatus
  payload?: Record<string, unknown>
}

export function shortActivityPath(path: string): string {
  if (!path) return ''
  const normalized = path.replace(/\\/g, '/').replace(/^app\//, '')
  const parts = normalized.split('/')
  const base = parts[parts.length - 1] || normalized
  if (parts.length > 1 && /^(page|layout|route)\.(tsx?|jsx?)$/.test(base)) {
    return `${parts[parts.length - 2]}/${base}`
  }
  return parts.length > 2 ? `…/${parts.slice(-2).join('/')}` : normalized
}

const TERMINAL_DONE = new Set([
  'file_created',
  'file_modified',
  'file_deleted',
  'file_read',
  'command_run',
  'tool_result',
  'request_completed',
  'session_finished',
  'agent_stopped',
])

const RUNNING_TYPES = new Set([
  'thinking',
  'plan',
  'processing',
  'request_started',
  'tool_call',
  'mcp_tool_call',
  'skill_invoked',
  'asking_user',
])

export function defaultActivityStatus(eventType: string): AgentActivityStatus {
  if (eventType === 'request_failed') return 'error'
  if (TERMINAL_DONE.has(eventType)) return 'done'
  if (RUNNING_TYPES.has(eventType)) return 'running'
  return 'done'
}

export function activityDisplayText(item: AgentActivityItem): string {
  const detail = item.detail?.trim()
  const title = item.title?.trim()

  switch (item.eventType) {
    case 'thinking':
      return detail || title || 'Thinking…'
    case 'plan':
      return detail || title || 'Planning…'
    case 'processing':
    case 'request_started':
      return detail || title || 'Working…'
    case 'tool_call':
    case 'mcp_tool_call':
      return detail ? `Tool: ${detail}` : title || 'Running tool…'
    case 'tool_result':
      return detail ? `Result: ${detail}` : title || 'Tool finished'
    case 'skill_invoked':
      return detail ? `Skill: ${detail}` : title || 'Using skill…'
    case 'command_run':
      return detail ? `Ran \`${detail}\`` : title || 'Ran command'
    case 'file_created':
      return detail ? `Created ${shortActivityPath(detail)}` : title || 'Created file'
    case 'file_modified':
      return detail ? `Edited ${shortActivityPath(detail)}` : title || 'Edited file'
    case 'file_deleted':
      return detail ? `Deleted ${shortActivityPath(detail)}` : title || 'Deleted file'
    case 'file_read':
      return detail ? `Read ${shortActivityPath(detail)}` : title || 'Read file'
    case 'assistant_message':
      return detail || title || 'Reply'
    case 'request_completed':
      return detail || title || 'Completed'
    case 'request_failed':
      return detail || title || 'Request failed'
    case 'asking_user':
      return detail || title || 'Waiting for input…'
    case 'user_message':
      return detail || title || 'You'
    default:
      return detail || title || item.eventType.replace(/_/g, ' ')
  }
}

export function shouldRenderInFeed(eventType: string): boolean {
  return ![
    'ping',
    'token_delta',
    'message_snapshot',
    'user_message',
    'session_started',
    'session_finished',
    'agent_started',
    'agent_stopped',
    'agent_restarted',
  ].includes(eventType)
}

export function mergeAgentActivity(
  activities: AgentActivityItem[],
  input: {
    id?: number
    eventType: string
    title: string
    detail: string
    payload?: Record<string, unknown>
  },
): AgentActivityItem[] {
  if (!shouldRenderInFeed(input.eventType)) return activities

  const next = [...activities]
  const status = defaultActivityStatus(input.eventType)
  const key = `${input.id ?? 'live'}-${input.eventType}-${next.length}`

  if (input.eventType === 'thinking' || input.eventType === 'plan' || input.eventType === 'processing') {
    const idx = next.findIndex((a) => a.eventType === input.eventType && a.status === 'running')
    if (idx >= 0) {
      next[idx] = {
        ...next[idx],
        detail: input.detail || next[idx].detail,
        title: input.title || next[idx].title,
        id: input.id ?? next[idx].id,
      }
      return next
    }
  }

  if (input.eventType === 'tool_result') {
    for (let i = next.length - 1; i >= 0; i--) {
      if (next[i].eventType === 'tool_call' || next[i].eventType === 'mcp_tool_call') {
        if (next[i].status === 'running') {
          next[i] = { ...next[i], status: 'done' }
          break
        }
      }
    }
  }

  if (input.eventType === 'request_completed') {
    return next.map((a) => (a.status === 'running' ? { ...a, status: 'done' as const } : a))
  }

  if (input.eventType === 'request_failed') {
    return next.map((a) =>
      a.status === 'running' ? { ...a, status: 'error' as const } : a,
    )
  }

  next.push({
    key,
    id: input.id,
    eventType: input.eventType,
    title: input.title,
    detail: input.detail,
    status,
    payload: input.payload,
  })

  return next
}
