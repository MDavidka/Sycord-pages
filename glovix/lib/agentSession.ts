import { getHostProjectId } from './api'

export type AgentSessionState = {
  projectId: string
  requestId?: string
  sinceId: number
  startedAt: number
  pending: boolean
}

const STORAGE_PREFIX = 'syra_agent_session:'

function storageKey(projectId: string): string {
  return `${STORAGE_PREFIX}${projectId}`
}

export function loadAgentSession(projectId?: string | null): AgentSessionState | null {
  const id = projectId || getHostProjectId()
  if (!id || typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(id))
    if (!raw) return null
    const parsed = JSON.parse(raw) as AgentSessionState
    if (!parsed || parsed.projectId !== id) return null
    return parsed
  } catch {
    return null
  }
}

export function saveAgentSession(state: AgentSessionState): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(storageKey(state.projectId), JSON.stringify(state))
  } catch {
    // ignore quota errors
  }
}

export function clearAgentSession(projectId?: string | null): void {
  const id = projectId || getHostProjectId()
  if (!id || typeof window === 'undefined') return
  try {
    localStorage.removeItem(storageKey(id))
  } catch {
    // ignore
  }
}

export function markAgentSessionPending(projectId: string, sinceId: number, requestId?: string): void {
  saveAgentSession({
    projectId,
    requestId,
    sinceId,
    startedAt: Date.now(),
    pending: true,
  })
}

export function updateAgentSessionSinceId(projectId: string, sinceId: number, requestId?: string): void {
  const existing = loadAgentSession(projectId)
  saveAgentSession({
    projectId,
    requestId: requestId || existing?.requestId,
    sinceId: Math.max(sinceId, existing?.sinceId ?? 0),
    startedAt: existing?.startedAt ?? Date.now(),
    pending: true,
  })
}

export function completeAgentSession(projectId: string): void {
  clearAgentSession(projectId)
}
