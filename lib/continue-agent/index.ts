import type { ModelType } from '@/glovix/lib/ai'
import {
  buildSyteAgentProxyHeaders,
  buildSyteAgentStreamHeaders,
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
import { mapSyteActivityBatch } from './activity-map'
import { fetchAgentActivitySnapshot, resolveActivitySinceId, streamSyteAgentActivity } from './activity-stream'
import { runContinueAgentTurn } from './run-turn'
import type { AgentStreamEvent } from './types'

export type { AgentStreamEvent, ContinueStateSnapshot } from './types'
export { ContinueAgentClient } from './client'
export { mapSyteActivityBatch, isAgentRequestInFlight } from './activity-map'

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

function isAsyncAccepted(data: SyteAgentChangeResponse | null | undefined): boolean {
  if (!data) return false
  if (data.status === 'accepted') return true
  if (typeof data.request_id === 'string' && data.request_id.trim()) return true
  return data.change_applied === null
}

function extractChangeReply(data: SyteAgentChangeResponse | null | undefined): string {
  if (!data) return ''
  return typeof data.reply === 'string' ? data.reply.trim() : ''
}

async function triggerAgentChangeAsync(
  uuid: string,
  message: string,
  modelName: 'syra-nano' | 'syra-base' | 'syra-havy',
) {
  return getSyteInternalSecret()
    ? syteInternalAgentChange(uuid, message, modelName)
    : syteAgentChange(uuid, message, modelName)
}

async function ensureAgentSession(uuid: string, model: ModelType): Promise<SyteAgentStatusFields> {
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

  return info
}

async function ensureRunningAgent(uuid: string, model: ModelType): Promise<ContinueAgentConnection> {
  const headers = buildSyteAgentProxyHeaders()
  const info = await ensureAgentSession(uuid, model)
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

export async function getAgentActivityForProject(
  userId: string,
  projectId: string,
  sinceId = 0,
  assistantText = '',
) {
  const project = await loadProject(userId, projectId)
  if (!project) throw new Error('Project not found')

  const resolved = await requireSyteWorkspaceUuid(project, projectId)
  if ('error' in resolved) throw new Error(resolved.error)

  const snapshot = await fetchAgentActivitySnapshot(resolved.uuid, sinceId)
  if (!snapshot.ok) {
    throw new Error(snapshot.error || 'Failed to fetch agent activity')
  }

  const mapped = mapSyteActivityBatch(snapshot.events, assistantText)
  const status = await syteAgentStatus(resolved.uuid)

  return {
    uuid: resolved.uuid,
    sinceId: Math.max(snapshot.sinceId, mapped.sinceId),
    processing: mapped.processing || (status.data as SyteAgentStatusFields | undefined)?.agent_status === 'running',
    terminal: mapped.terminal,
    assistantText: mapped.assistantText,
    events: mapped.streamEvents,
    agent: status.data,
  }
}

async function* streamSyteAgentChange(
  uuid: string,
  model: ModelType,
  message: string,
): AsyncGenerator<AgentStreamEvent> {
  const modelName = toSyteModelProfile(model)
  yield { type: 'status', status: `agent:${modelName}` }
  yield { type: 'status', status: 'running' }

  const result = await triggerAgentChangeAsync(uuid, message, modelName)
  if (!result.ok) {
    throw new Error(result.error || 'Syte agent_change failed')
  }

  const data = (result.data || {}) as SyteAgentChangeResponse
  if (isAsyncAccepted(data)) {
    throw new Error('Syte agent_change accepted async — use activity stream to follow progress')
  }

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

async function* streamSyteAgentRealtime(
  uuid: string,
  model: ModelType,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const modelName = toSyteModelProfile(model)
  const session = await ensureAgentSession(uuid, model)
  const sinceId = await resolveActivitySinceId(uuid)
  const streamHeaders = buildSyteAgentStreamHeaders()

  yield { type: 'status', status: `agent:${session.agent_model_profile || modelName}` }
  yield { type: 'meta', sinceId }

  const changeResult = await triggerAgentChangeAsync(uuid, message, modelName)
  if (!changeResult.ok) {
    throw new Error(changeResult.error || 'Syte agent_change failed')
  }

  const changeData = (changeResult.data || {}) as SyteAgentChangeResponse
  const requestId = typeof changeData.request_id === 'string' ? changeData.request_id : undefined

  if (requestId || isAsyncAccepted(changeData)) {
    yield { type: 'meta', requestId, sinceId }
    yield { type: 'status', status: 'running' }
  } else {
    const reply = extractChangeReply(changeData)
    if (reply) {
      yield { type: 'delta', text: reply }
      yield { type: 'done' }
      return
    }
  }

  let sawDone = false

  try {
    for await (const event of streamSyteAgentActivity(uuid, sinceId, streamHeaders, signal)) {
      yield event
      if (event.type === 'done') {
        sawDone = true
        break
      }
      if (event.type === 'detached') {
        return
      }
      if (event.type === 'error') {
        return
      }
    }
  } catch (streamErr) {
    if ((streamErr as { name?: string })?.name === 'AbortError') {
      const snapshot = await fetchAgentActivitySnapshot(uuid, sinceId).catch(() => null)
      yield {
        type: 'detached',
        sinceId: snapshot?.sinceId ?? sinceId,
      }
      return
    }
    const streamMsg = streamErr instanceof Error ? streamErr.message : String(streamErr)
    yield { type: 'status', status: `activity-stream:${streamMsg.slice(0, 80)}` }
  }

  if (!sawDone) {
    const snapshot = await fetchAgentActivitySnapshot(uuid, sinceId)
    const mapped = mapSyteActivityBatch(snapshot.events)
    for (const event of mapped.streamEvents) {
      yield event
    }
    if (mapped.terminal === 'failed') return
    if (mapped.terminal === 'completed' || mapped.assistantText.trim()) {
      yield { type: 'done' }
      return
    }
    yield { type: 'detached', sinceId: snapshot.sinceId }
  }
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
    yield* streamSyteAgentRealtime(uuid, model, message, signal)
    return
  } catch (realtimeErr) {
    const realtimeMsg = realtimeErr instanceof Error ? realtimeErr.message : String(realtimeErr)
    if ((realtimeErr as { name?: string })?.name === 'AbortError') {
      throw realtimeErr
    }
    yield { type: 'status', status: `retry:change (${realtimeMsg.slice(0, 100)})` }
  }

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
