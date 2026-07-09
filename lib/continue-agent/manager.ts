import { spawn, type ChildProcess } from 'node:child_process'
import { promises as fs } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import type { ModelType } from '@/glovix/lib/ai'
import { buildContinueConfig } from './config'

type ManagedAgent = {
  key: string
  port: number
  baseUrl: string
  process: ChildProcess
  startedAt: number
}

const agents = new Map<string, ManagedAgent>()

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.on('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        server.close()
        reject(new Error('Failed to allocate port'))
        return
      }
      const port = address.port
      server.close(() => resolve(port))
    })
  })
}

async function writeGeneratedConfig(cwd: string, model: ModelType): Promise<string> {
  const configPath = path.join(cwd, '.syra-continue.generated.yaml')
  await fs.writeFile(configPath, buildContinueConfig({ model }), 'utf8')
  return configPath
}

function buildServeArgs(port: number, sessionId: string, configPath: string): string[] {
  return [
    'serve',
    '--port', String(port),
    '--timeout', process.env.CONTINUE_AGENT_TIMEOUT || '3600',
    '--id', sessionId,
    '--config', configPath,
    '--allow', 'Write',
    '--allow', 'Edit',
    '--allow', 'Bash',
    '--allow', 'Read',
  ]
}

async function waitForHealthy(baseUrl: string, attempts = 40): Promise<void> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(`${baseUrl}/state`, { cache: 'no-store' })
      if (res.ok) return
    } catch {}
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('Continue agent failed to become healthy')
}

export async function ensureLocalContinueAgent(projectId: string, model: ModelType, cwd: string): Promise<string> {
  const key = `${projectId}:${model}`
  const existing = agents.get(key)
  if (existing?.process.exitCode == null) return existing.baseUrl

  const port = await getFreePort()
  const baseUrl = `http://127.0.0.1:${port}`
  const configPath = await writeGeneratedConfig(cwd, model)

  const child = spawn('npx', ['-y', '@continuedev/cli@latest', ...buildServeArgs(port, key, configPath)], {
    cwd,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  child.stdout?.on('data', (chunk) => {
    console.log(`[ContinueAgent:${key}]`, String(chunk).trim())
  })
  child.stderr?.on('data', (chunk) => {
    console.warn(`[ContinueAgent:${key}]`, String(chunk).trim())
  })
  child.on('exit', (code) => {
    console.log(`[ContinueAgent:${key}] exited with code ${code}`)
    agents.delete(key)
  })

  agents.set(key, { key, port, baseUrl, process: child, startedAt: Date.now() })
  await waitForHealthy(baseUrl)
  return baseUrl
}

export function getConfiguredAgentUrl(): string | null {
  const url = process.env.CONTINUE_AGENT_URL?.trim()
  return url || null
}
