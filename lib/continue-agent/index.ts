import type { ModelType } from '@/glovix/lib/ai'
import {
  buildSyteAgentProxyHeaders,
  getSyteInternalSecret,
  syteAgentChange,
  syteAgentLogs,
  syteAgentSettings,
  syteAgentStart,
  syteAgentStatus,
  syteInternalAgentChange,
  type SyteAgentChangeResponse,
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

function extractChangeReply(data: SyteAgentChangeResponse | null | undefined): string {
  if (!data) return ''
  const reply = typeof data.reply === 'string' ? data.reply.trim() : ''
  return reply
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

async function* streamSyteAgentChange(
  uuid: string,
  model: ModelType,
  message: string,
): AsyncGenerator<AgentStreamEvent> {
  const modelName = toSyteModelProfile(model)
  yield { type: 'status', status: `agent:${modelName}` }
  yield { type: 'status', status: 'running' }

  const useInternal = Boolean(getSyteInternalSecret())
  const result = useInternal
    ? await syteInternalAgentChange(uuid, message, modelName)
    : await syteAgentChange(uuid, message, modelName)

  if (!result.ok) {
    throw new Error(result.error || 'Syte agent_change failed')
  }

  const data = (result.data || {}) as SyteAgentChangeResponse
  const reply = extractChangeReply(data)
  if (!reply) {
    throw new Error(
      data.change_applied === false
        ? 'The agent did not apply a change. Check Syte agent logs and model API keys.'
        : 'Syte agent returned an empty reply.',
    )
  }

  yield { type: 'delta', text: reply }
  yield { type: 'done' }
}

export async function* streamContinueAgentMessage(
  userId: string,
  projectId: string,
  model: ModelType,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  if (signal?.aborted) {
    throw new DOMException('Aborted', 'AbortError')
  }

  const project = await loadProject(userId, projectId)
  if (!project) throw new Error('Project not found')

  const resolved = await requireSyteWorkspaceUuid(project, projectId)
  if ('error' in resolved) throw new Error(resolved.error)

  const uuid = resolved.uuid
  const modelName = toSyteModelProfile(model)

  try {
    yield* streamSyteAgentChange(uuid, model, message)
    return
  } catch (changeErr) {
    const changeMsg = changeErr instanceof Error ? changeErr.message : String(changeErr)
    yield { type: 'status', status: `retry:proxy (${changeMsg.slice(0, 100)})` }
  }

  const connection = await ensureRunningAgent(uuid, model)
  yield { type: 'status', status: `agent:${connection.status.agent_model_profile || modelName}` }
  yield* runContinueAgentTurn(connection.baseUrl, message, connection.headers, signal)
}
