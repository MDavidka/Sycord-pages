import { promises as fs } from "node:fs"
import path from "node:path"
import { config } from "./config.js"
import { getProjectLogsDir } from "./paths.js"

export type LogType = "deploy" | "build" | "runtime" | "error" | "health"

export async function ensureBaseDirectories() {
  await fs.mkdir(config.sitesDir, { recursive: true })
  await fs.mkdir(config.logsDir, { recursive: true })
  await fs.mkdir(config.envDir, { recursive: true, mode: 0o700 })
  await fs.mkdir(path.dirname(config.stateFile), { recursive: true })
}

export async function ensureProjectLogDir(projectId: string) {
  await fs.mkdir(getProjectLogsDir(projectId), { recursive: true })
}

function logPath(projectId: string, type: LogType) {
  return path.join(getProjectLogsDir(projectId), `${type}.log`)
}

export async function resetProjectLogs(projectId: string) {
  await ensureProjectLogDir(projectId)
  await Promise.all(
    (["deploy", "build", "runtime", "error", "health"] as LogType[]).map((type) =>
      fs.writeFile(logPath(projectId, type), ""),
    ),
  )
}

export async function appendLog(projectId: string, type: LogType, line: string) {
  await ensureProjectLogDir(projectId)
  await fs.appendFile(logPath(projectId, type), `${line}\n`)
}

export async function readLog(projectId: string, type: LogType, limit = 300) {
  try {
    const content = await fs.readFile(logPath(projectId, type), "utf8")
    return content.split("\n").filter(Boolean).slice(-limit)
  } catch {
    return []
  }
}
