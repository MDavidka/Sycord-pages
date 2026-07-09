import type { ModelType } from '@/glovix/lib/ai'
import {
  buildSyteAgentProxyHeaders,
  syteAgentLogs,
  syteAgentSettings,
  syteAgentStart,
  syteAgentStatus,
  type SyteAgentStatusFields,
} from '@/lib/deploy/syte-client'
import { requireSyteWorkspaceUuid } from '@/lib/deploy/syte-workspace'
import { loadProject } from '@/lib/workspace/sandbox'
import { runContinueAgentTurn } from './run-turn'
import type { AgentStreamEvent } from './types'

export type { AgentStreamEvent, ContinueStateSnapshot } from './types'
export { ContinueAgentClient } from './client'

export type ContinueAgentConnection = {
  baseUrl: string
  headers: Record<string, string>
  uuid: string
  status: SyteAgentStatusFields
}

function toSyteModelProfile(model: ModelType): 'syra-nano' | 'syra-base' | 'syra-havy' {
  switch (model) {
    case 'deepseek-v4-flash':
      return 'syra-base'
    case 'deepseek-v4-pro':
    case 'gemini-3.1-pro':
      return 'syra-havy'
    case 'mimo-v2-flash':
    default:
      return 'syra-nano'
  }
}

async function ensureRunningAgent(uuid: string, model: ModelType): Promise<ContinueAgentConnection> {
  const headers = buildSyteAgentProxyHeaders()
  let status = await syteAgentStatus(uuid)
  if (!status.ok) {
    throw new Error(status.error || `Syte agent status failed for ${uuid}`)
  }

  let info = (status.data || {}) as SyteAgentStatusFields
  if (!info.agent_running) {
    const started = await syteAgentStart(uuid)
    if (!started.ok) {
      throw new Error(started.error || `Failed to start Syte agent for ${uuid}`)
    }
    status = await syteAgentStatus(uuid)
    if (!status.ok) {
      throw new Error(status.error || `Syte agent status failed after start for ${uuid}`)
    }
    info = (status.data || {}) as SyteAgentStatusFields
  }

  const desiredProfile = toSyteModelProfile(model)
  if (info.agent_model_profile !== desiredProfile) {
    const updated = await syteAgentSettings(uuid, desiredProfile)
    if (!updated.ok) {
      throw new Error(updated.error || `Failed to switch Syte agent profile to ${desiredProfile}`)
    }
    info = { ...info, ...((updated.data || {}) as SyteAgentStatusFields), agent_model_profile: desiredProfile }
  }

  const baseUrl = typeof info.agent_proxy_url === 'string' ? info.agent_proxy_url.trim() : ''
  if (!baseUrl) {
    throw new Error('Syte agent is running but agent_proxy_url is missing')
  }

  return { baseUrl, headers, uuid, status: info }
}

export async function resolveContinueAgentConnection(
  userId: string,
  projectId: string,
  model: ModelType,
): Promise<ContinueAgentConnection> {
  const project = await loadProject(userId, projectId)
  if (!project) throw new Error('Project not found')

  const resolved = await requireSyteWorkspaceUuid(project, projectId)
  if ('error' in resolved) throw new Error(resolved.error)

  return ensureRunningAgent(resolved.uuid, model)
}

export async function getContinueAgentDebugLogs(userId: string, projectId: string, lines = 200): Promise<string> {
  const project = await loadProject(userId, projectId)
  if (!project) throw new Error('Project not found')

  const resolved = await requireSyteWorkspaceUuid(project, projectId)
  if ('error' in resolved) throw new Error(resolved.error)

  const logs = await syteAgentLogs(resolved.uuid, lines)
  if (!logs.ok) return logs.error || 'Unable to fetch Syte agent logs'
  const data = (logs.data || {}) as { logs?: string; output?: string }
  return data.logs || data.output || JSON.stringify(data)
}

export async function* streamContinueAgentMessage(
  userId: string,
  projectId: string,
  model: ModelType,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const connection = await resolveContinueAgentConnection(userId, projectId, model)
  yield { type: 'status', status: `agent:${connection.status.agent_model_profile || 'running'}` }
  yield* runContinueAgentTurn(connection.baseUrl, message, connection.headers, signal)
}
