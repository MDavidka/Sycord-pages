import path from 'node:path'
import { promises as fs } from 'node:fs'
import os from 'node:os'
import type { ModelType } from '@/glovix/lib/ai'
import {
  syteExecuteCommand,
  syteSyncProjectFiles,
  useSyteWorkspace,
} from '@/lib/deploy/syte-client'
import { requireSyteWorkspaceUuid } from '@/lib/deploy/syte-workspace'
import { loadProject, projectFiles } from '@/lib/workspace/sandbox'
import { buildContinueConfig } from './config'
import { ensureLocalContinueAgent, getConfiguredAgentUrl } from './manager'
import { runContinueAgentTurn } from './run-turn'
import type { AgentStreamEvent } from './types'

export type { AgentStreamEvent, ContinueStateSnapshot } from './types'
export { ContinueAgentClient } from './client'

const SYTE_AGENT_PORT = Number(process.env.CONTINUE_SYTE_PORT || '8791')

async function writeProjectToTempDir(userId: string, projectId: string): Promise<string> {
  const project = await loadProject(userId, projectId)
  if (!project) throw new Error('Project not found')

  const dir = await fs.mkdtemp(path.join(os.tmpdir(), `syra-continue-${projectId}-`))
  const files = projectFiles(project)
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relPath)
    await fs.mkdir(path.dirname(fullPath), { recursive: true })
    await fs.writeFile(fullPath, content, 'utf8')
  }
  return dir
}

function shellEscapeSingleQuoted(value: string): string {
  return value.replace(/'/g, `'\\''`)
}

async function ensureSyteContinueAgent(projectId: string, project: any, model: ModelType): Promise<string> {
  const resolved = await requireSyteWorkspaceUuid(project, projectId)
  if ('error' in resolved) throw new Error(resolved.error)

  const uuid = resolved.uuid
  await syteSyncProjectFiles(uuid, projectFiles(project))

  const configText = buildContinueConfig({ model })
  const startScript = [
    'cd app',
    `cat <<'EOF' > .syra-continue.generated.yaml\n${configText}\nEOF`,
    `if ! curl -sf http://127.0.0.1:${SYTE_AGENT_PORT}/state >/dev/null; then`,
    `  nohup npx -y @continuedev/cli@latest serve --port ${SYTE_AGENT_PORT} --timeout 3600 --id ${projectId}-${model} --config .syra-continue.generated.yaml --allow Write --allow Edit --allow Bash --allow Read >/tmp/cn-serve.log 2>&1 &`,
    '  sleep 2',
    'fi',
  ].join(' && ')

  await syteExecuteCommand(uuid, startScript, { timeout: 90, cwd: '.' })

  const configured = process.env.CONTINUE_SYTE_AGENT_URL?.trim()
  if (configured) {
    return configured.replace('{{uuid}}', uuid).replace('{{projectId}}', projectId)
  }

  throw new Error('Continue agent is not reachable on Syte. Set CONTINUE_SYTE_AGENT_URL to the cn serve endpoint for the workspace VM.')
}

export async function resolveContinueAgentBaseUrl(userId: string, projectId: string, model: ModelType): Promise<string> {
  const configured = getConfiguredAgentUrl()
  if (configured) return configured

  if (useSyteWorkspace()) {
    const project = await loadProject(userId, projectId)
    if (!project) throw new Error('Project not found')
    return ensureSyteContinueAgent(projectId, project, model)
  }

  const workDir = await writeProjectToTempDir(userId, projectId)
  return ensureLocalContinueAgent(projectId, model, workDir)
}

export async function* streamContinueAgentMessage(
  userId: string,
  projectId: string,
  model: ModelType,
  message: string,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const baseUrl = await resolveContinueAgentBaseUrl(userId, projectId, model)
  yield* runContinueAgentTurn(baseUrl, message, signal)
}
