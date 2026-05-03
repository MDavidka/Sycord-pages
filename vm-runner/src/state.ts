import { promises as fs } from "node:fs"
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
}

async function ensureStateFile() {
  await fs.mkdir(path.dirname(config.stateFile), { recursive: true })
  try {
    await fs.access(config.stateFile)
  } catch {
    await fs.writeFile(config.stateFile, JSON.stringify({ websites: {} }, null, 2))
  }
}

export async function readState(): Promise<RunnerState> {
  await ensureStateFile()
  const content = await fs.readFile(config.stateFile, "utf8")
  return JSON.parse(content) as RunnerState
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
  await writeState(state)
  return website
}

export async function removeWebsiteState(projectId: string) {
  const state = await readState()
  delete state.websites[projectId]
  await writeState(state)
}

export async function allocatePort(projectId: string) {
  const state = await readState()
  const existing = state.websites[projectId]
  if (existing?.port) return existing.port

  const used = new Set(Object.values(state.websites).map((item) => item.port))
  for (let port = config.portStart; port <= config.portEnd; port += 1) {
    if (!used.has(port)) return port
  }
  throw new Error("No free runner ports available")
}
