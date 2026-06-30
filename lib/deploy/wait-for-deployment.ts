import { deployment, unwrap, extractDeploymentId } from "@/lib/deploy/dokploy-client"

export type DeploymentWaitStatus = "building" | "success" | "failed" | "timeout"

export type DeploymentWaitResult = {
  status: DeploymentWaitStatus
  deploymentId: string | null
  logs: string
  matchedLine: string | null
  error: string | null
  progressMessage: string
}

const SUCCESS_PATTERNS: RegExp[] = [
  /✅\s*nixpacks build completed/i,
  /nixpacks build completed/i,
  /build completed successfully/i,
  /successfully built/i,
  /deployment complete/i,
  /deployed successfully/i,
  /application deployed/i,
  /docker build.*success/i,
  /npm run build.*success/i,
]

const FAILURE_PATTERNS: RegExp[] = [
  /build failed/i,
  /deployment failed/i,
  /failed to compile/i,
  /npm err!/i,
  /error during build/i,
  /exit code: [1-9]/i,
  /process exited with code [1-9]/i,
  /cannot find module/i,
  /module not found/i,
]

function extractLogsText(data: unknown): string {
  const core = unwrap(data)
  if (!core) return ""
  if (typeof core === "string") return core
  if (Array.isArray(core)) return core.map(String).join("\n")
  if (typeof core === "object") {
    const obj = core as Record<string, unknown>
    if (typeof obj.logs === "string") return obj.logs
    if (Array.isArray(obj.logs)) return obj.logs.map(String).join("\n")
    if (typeof obj.data === "string") return obj.data
    if (Array.isArray(obj.data)) return obj.data.map(String).join("\n")
    try {
      return JSON.stringify(core)
    } catch {
      return String(core)
    }
  }
  return String(core)
}

function latestDeploymentFromAll(data: unknown): { deploymentId: string | null; status: string | null } {
  const core = unwrap(data)
  const list = Array.isArray(core) ? core : Array.isArray((core as any)?.deployments) ? (core as any).deployments : []
  if (!Array.isArray(list) || list.length === 0) {
    return { deploymentId: extractDeploymentId(core), status: null }
  }
  const sorted = [...list].sort((a, b) => {
    const ta = new Date(a?.createdAt || a?.updatedAt || 0).getTime()
    const tb = new Date(b?.createdAt || b?.updatedAt || 0).getTime()
    return tb - ta
  })
  const latest = sorted[0]
  return {
    deploymentId: extractDeploymentId(latest),
    status: typeof latest?.status === "string" ? latest.status : null,
  }
}

function analyzeLogs(logs: string): { success: boolean; failed: boolean; matchedLine: string | null } {
  const lines = logs.split("\n")
  for (const line of lines) {
    for (const pattern of SUCCESS_PATTERNS) {
      if (pattern.test(line)) {
        return { success: true, failed: false, matchedLine: line.trim() }
      }
    }
  }
  for (const line of lines) {
    for (const pattern of FAILURE_PATTERNS) {
      if (pattern.test(line)) {
        return { success: false, failed: true, matchedLine: line.trim() }
      }
    }
  }
  return { success: false, failed: false, matchedLine: null }
}

export async function resolveLatestDeploymentId(applicationId: string): Promise<string | null> {
  const res = await deployment.all(applicationId)
  if (!res.ok) return null
  return latestDeploymentFromAll(res.data).deploymentId
}

export async function fetchDeploymentLogs(deploymentId: string, tail = 300): Promise<string> {
  const res = await deployment.readLogs(deploymentId, tail)
  if (!res.ok) return res.error || ""
  return extractLogsText(res.data)
}

/** Poll Dokploy deployment logs until build success/failure or timeout. */
export async function waitForDeploymentCompletion(opts: {
  applicationId: string
  deploymentId?: string | null
  timeoutMs?: number
  pollIntervalMs?: number
  onProgress?: (message: string) => void
}): Promise<DeploymentWaitResult> {
  const timeoutMs = opts.timeoutMs ?? 8 * 60_000
  const pollIntervalMs = opts.pollIntervalMs ?? 4_000
  const started = Date.now()
  let deploymentId = opts.deploymentId ?? null
  let lastLogs = ""

  while (Date.now() - started < timeoutMs) {
    if (!deploymentId) {
      deploymentId = await resolveLatestDeploymentId(opts.applicationId)
    }

    if (!deploymentId) {
      opts.onProgress?.("Waiting for Dokploy to start the deployment…")
      await sleep(pollIntervalMs)
      continue
    }

    lastLogs = await fetchDeploymentLogs(deploymentId, 400)
    const analysis = analyzeLogs(lastLogs)

    if (analysis.success) {
      return {
        status: "success",
        deploymentId,
        logs: lastLogs,
        matchedLine: analysis.matchedLine,
        error: null,
        progressMessage: analysis.matchedLine || "Build completed",
      }
    }

    if (analysis.failed) {
      return {
        status: "failed",
        deploymentId,
        logs: lastLogs,
        matchedLine: analysis.matchedLine,
        error: analysis.matchedLine || "Deployment build failed",
        progressMessage: "Build failed",
      }
    }

    const elapsed = Math.round((Date.now() - started) / 1000)
    const progressMessage = `Building on Dokploy… (${elapsed}s) — waiting for "Nixpacks build completed" or Docker build success in logs`
    opts.onProgress?.(progressMessage)
    await sleep(pollIntervalMs)
  }

  return {
    status: "timeout",
    deploymentId,
    logs: lastLogs,
    matchedLine: null,
    error: "Deployment did not finish within the timeout window",
    progressMessage: "Deployment timed out",
  }
}

/** One-shot status check (for client polling). */
export async function checkDeploymentStatus(opts: {
  applicationId: string
  deploymentId?: string | null
}): Promise<DeploymentWaitResult> {
  let deploymentId = opts.deploymentId ?? (await resolveLatestDeploymentId(opts.applicationId))
  if (!deploymentId) {
    return {
      status: "building",
      deploymentId: null,
      logs: "",
      matchedLine: null,
      error: null,
      progressMessage: "Waiting for deployment to start…",
    }
  }

  const logs = await fetchDeploymentLogs(deploymentId, 400)
  const analysis = analyzeLogs(logs)

  if (analysis.success) {
    return {
      status: "success",
      deploymentId,
      logs,
      matchedLine: analysis.matchedLine,
      error: null,
      progressMessage: analysis.matchedLine || "Build completed",
    }
  }

  if (analysis.failed) {
    return {
      status: "failed",
      deploymentId,
      logs,
      matchedLine: analysis.matchedLine,
      error: analysis.matchedLine || "Build failed",
      progressMessage: "Build failed",
    }
  }

  return {
    status: "building",
    deploymentId,
    logs,
    matchedLine: null,
    error: null,
    progressMessage: 'Building… waiting for "✅ Nixpacks build completed." in logs',
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function buildDeployAutofixMessage(logs: string, error: string): string {
  const snippet = logs.split("\n").slice(-30).join("\n").slice(0, 2500)
  return (
    `[SYSTEM] ❌ Deployment build FAILED on Dokploy.\n\n` +
    `Error signal: ${error}\n\n` +
    `Recent build logs:\n${snippet}\n\n` +
    `AUTO-FIX REQUIRED — do NOT tell the user deployment succeeded:\n` +
    `1. Read the log lines above and identify the root cause (missing file, bad import, package.json, Dockerfile, env var).\n` +
    `2. Fix source files with readFile → editFile/createFile.\n` +
    `3. Run typeCheck() to verify.\n` +
    `4. Call save() then deploy() again.\n` +
    `5. If env/integration keys are missing, call integration() and wait for the user.`
  )
}
