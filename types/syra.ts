/** Syra chat message roles — maps to store messages + Syte agent activity. */
export type SyraMessageRole = 'user' | 'assistant' | 'tool_result'

export type SyraMessageStatus = 'idle' | 'streaming' | 'done' | 'error'

/** UI representation of a Syte agent tool/activity step (from agent_activity feed). */
export interface SyraToolCallUI {
  id: string
  name: string
  detail: string
  result?: string
  status: 'pending' | 'running' | 'done' | 'error'
  payload?: Record<string, unknown>
}

export interface SyraMessage {
  id: string
  role: SyraMessageRole
  content: string
  toolCalls?: SyraToolCallUI[]
  thinking?: string
  thinkingDuration?: number
  status: SyraMessageStatus
  createdAt: number
}

export interface SyraAskUserPrompt {
  id: string
  question: string
  messageId: string
}

export type SyraAgentSessionMeta = {
  projectId: string
  requestId?: string
  sinceId: number
  pending: boolean
  startedAt: number
}
