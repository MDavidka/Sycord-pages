import { promises as fs } from "node:fs"
import { createServer } from "node:net"
import path from "node:path"
import { config } from "./config.js"

export type WebsiteState = {
  projectId: string
  subdomain: string
  domain: string
  port: number
  processName: string
  status: "running" | "failed" | "stopped"
  health: "healthy" | "unhealthy" | "unknown"
  lastDeployAt?: string
  lastHealthCheckAt?: string
  lastDeployError?: string | null
}

type RunnerState = {
  websites: Record<string, WebsiteState>
  ports: Record<string, string>
}

const DEFAULT_STATE: RunnerState = { websites: {}, ports: {} }

async function ensureStateFile() {
  await fs.mkdir(path.dirname(config.stateFile), { recursive: true })
  try {
    await fs.access(config.stateFile)
  } catch {
    await fs.writeFile(config.stateFile, JSON.stringify(DEFAULT_STATE, null, 2))
  }
}

export async function readState(): Promise<RunnerState> {
  await ensureStateFile()
  const content = await fs.readFile(config.stateFile, "utf8")
  try {
    const parsed = JSON.parse(content)
    return { websites: parsed.websites || {}, ports: parsed.ports || {} }
  } catch {
    return { ...DEFAULT_STATE }
  }
}

export async function writeState(state: RunnerState) {
  await ensureStateFile()
  await fs.writeFile(config.stateFile, JSON.stringify(state, null, 2))
}

export async function getWebsiteState(projectId: string) {
  const state = await readState()
  return state.websites[projectId] || null
}

export async function upsertWebsiteState(website: WebsiteState) {
  const state = await readState()
  state.websites[website.projectId] = website
  state.ports[String(website.port)] = website.projectId
  await writeState(state)
  return website
}

export async function removeWebsiteState(projectId: string) {
  const state = await readState()
  const site = state.websites[projectId]
  if (site) {
    delete state.ports[String(site.port)]
  }
  delete state.websites[projectId]
  await writeState(state)
}

function isPortFreeOS(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
    server.once("error", () => {
      server.removeAllListeners()
      resolve(false)
    })
    server.once("listening", () => {
      server.removeAllListeners()
      server.close(() => resolve(true))
    })
    server.listen(port, "127.0.0.1")
  })
}

export async function allocatePort(projectId: string): Promise<number> {
  const state = await readState()
  const existing = state.websites[projectId]
  if (existing?.port) {
    const free = await isPortFreeOS(existing.port)
    if (free) return existing.port
  }

  const used = new Set(Object.values(state.websites).map((item) => item.port))
  for (let port = config.portStart; port <= config.portEnd; port += 1) {
    if (used.has(port)) continue
    const free = await isPortFreeOS(port)
    if (free) return port
  }
  throw new Error(`No free ports available in range ${config.portStart}-${config.portEnd}`)
}

export async function retryAllocatePort(projectId: string, blockedPort: number): Promise<number> {
  const state = await readState()
  const used = new Set(Object.values(state.websites).map((item) => item.port))
  for (let port = config.portStart; port <= config.portEnd; port += 1) {
    if (port === blockedPort || used.has(port)) continue
    const free = await isPortFreeOS(port)
    if (free) return port
  }
  throw new Error(`No free ports available after EADDRINUSE on ${blockedPort}`)
}
