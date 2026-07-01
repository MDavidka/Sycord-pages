import { coolify, extractDeploymentUuid } from "@/lib/deploy/coolify-client"

export type DeploymentWaitStatus = "building" | "success" | "failed" | "timeout"

export type DeploymentWaitResult = {
  status: DeploymentWaitStatus
  deploymentUuid: string | null
  applicationUuid: string | null
  logs: string
  matchedLine: string | null
  error: string | null
  progressMessage: string
}

const SUCCESS_PATTERNS: RegExp[] = [
  /✅\s*nixpacks build completed/i,
  /nixpacks build completed/i,
  /deployment finished successfully/i,
  /deployment is finished/i,
  /successfully deployed/i,
  /build completed successfully/i,
  /application deployed/i,
]

const FAILURE_PATTERNS: RegExp[] = [
  /deployment failed/i,
  /build failed/i,
  /failed to compile/i,
  /npm err!/i,
  /error during build/i,
  /exit code: [1-9]/i,
  /process exited with code [1-9]/i,
]

function extractLogs(data: unknown): string {
  if (!data || typeof data !== "object") return ""
  const obj = data as Record<string, unknown>
  if (typeof obj.logs === "string") return obj.logs
  return ""
}

function analyzeLogs(logs: string, status?: string | null): {
  success: boolean
  failed: boolean
  matchedLine: string | null
} {
  const normalizedStatus = String(status || "").toLowerCase()
  if (["finished", "success", "completed", "done"].includes(normalizedStatus)) {
    return { success: true, failed: false, matchedLine: `status: ${status}` }
  }
  if (["failed", "error", "cancelled", "canceled"].includes(normalizedStatus)) {
    return { success: false, failed: true, matchedLine: `status: ${status}` }
  }

  const lines = logs.split("\n")
  for (const line of lines) {
    for (const pattern of SUCCESS_PATTERNS) {
      if (pattern.test(line)) return { success: true, failed: false, matchedLine: line.trim() }
    }
  }
  for (const line of lines) {
    for (const pattern of FAILURE_PATTERNS) {
      if (pattern.test(line)) return { success: false, failed: true, matchedLine: line.trim() }
    }
  }
  return { success: false, failed: false, matchedLine: null }
}

export async function resolveLatestDeploymentUuid(applicationUuid: string): Promise<string | null> {
  const running = await coolify.listDeployments()
  if (!running.ok || !Array.isArray(running.data)) return null
  const match = running.data
    .filter((d: any) => d?.application_id === applicationUuid || d?.application_uuid === applicationUuid)
    .sort((a: any, b: any) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())
  return (match[0]?.deployment_uuid as string | undefined) || null
}

export async function waitForCoolifyDeployment(opts: {
  applicationUuid: string
  deploymentUuid?: string | null
  timeoutMs?: number
  pollIntervalMs?: number
  onProgress?: (message: string) => void
}): Promise<DeploymentWaitResult> {
  const timeoutMs = opts.timeoutMs ?? 8 * 60_000
  const pollIntervalMs = opts.pollIntervalMs ?? 4_000
  const started = Date.now()
  let deploymentUuid = opts.deploymentUuid ?? null
  let lastLogs = ""

  while (Date.now() - started < timeoutMs) {
    if (!deploymentUuid) {
      deploymentUuid = await resolveLatestDeploymentUuid(opts.applicationUuid)
    }
    if (!deploymentUuid) {
      opts.onProgress?.("Waiting for Coolify to queue the deployment…")
      await sleep(pollIntervalMs)
      continue
    }

    const res = await coolify.getDeployment(deploymentUuid)
    if (res.ok && res.data) {
      lastLogs = extractLogs(res.data)
      const status = (res.data as any)?.status as string | undefined
      const analysis = analyzeLogs(lastLogs, status)

      if (analysis.success) {
        return {
          status: "success",
          deploymentUuid,
          applicationUuid: opts.applicationUuid,
          logs: lastLogs,
          matchedLine: analysis.matchedLine,
          error: null,
          progressMessage: analysis.matchedLine || "Deployment finished",
        }
      }
      if (analysis.failed) {
        return {
          status: "failed",
          deploymentUuid,
          applicationUuid: opts.applicationUuid,
          logs: lastLogs,
          matchedLine: analysis.matchedLine,
          error: analysis.matchedLine || "Deployment failed",
          progressMessage: "Build failed",
        }
      }
    }

    const elapsed = Math.round((Date.now() - started) / 1000)
    opts.onProgress?.(
      `Building on Coolify… (${elapsed}s) — waiting for deployment success in logs`,
    )
    await sleep(pollIntervalMs)
  }

  return {
    status: "timeout",
    deploymentUuid,
    applicationUuid: opts.applicationUuid,
    logs: lastLogs,
    matchedLine: null,
    error: "Deployment did not finish within the timeout window",
    progressMessage: "Deployment timed out",
  }
}

export async function checkCoolifyDeploymentStatus(opts: {
  applicationUuid: string
  deploymentUuid?: string | null
}): Promise<DeploymentWaitResult> {
  let deploymentUuid = opts.deploymentUuid ?? (await resolveLatestDeploymentUuid(opts.applicationUuid))
  if (!deploymentUuid) {
    return {
      status: "building",
      deploymentUuid: null,
      applicationUuid: opts.applicationUuid,
      logs: "",
      matchedLine: null,
      error: null,
      progressMessage: "Waiting for deployment to start…",
    }
  }

  const res = await coolify.getDeployment(deploymentUuid)
  const logs = res.ok ? extractLogs(res.data) : ""
  const status = res.ok ? ((res.data as any)?.status as string | undefined) : undefined
  const analysis = analyzeLogs(logs, status)

  if (analysis.success) {
    return {
      status: "success",
      deploymentUuid,
      applicationUuid: opts.applicationUuid,
      logs,
      matchedLine: analysis.matchedLine,
      error: null,
      progressMessage: analysis.matchedLine || "Deployment finished",
    }
  }
  if (analysis.failed) {
    return {
      status: "failed",
      deploymentUuid,
      applicationUuid: opts.applicationUuid,
      logs,
      matchedLine: analysis.matchedLine,
      error: analysis.matchedLine || "Deployment failed",
      progressMessage: "Build failed",
    }
  }

  return {
    status: "building",
    deploymentUuid,
    applicationUuid: opts.applicationUuid,
    logs,
    matchedLine: null,
    error: null,
    progressMessage: 'Building… waiting for "Nixpacks build completed" or finished status',
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function buildCoolifyAutofixMessage(logs: string, error: string): string {
  const snippet = logs.split("\n").slice(-30).join("\n").slice(0, 2500)
  return (
    `[SYSTEM] ❌ Deployment build FAILED on Coolify.\n\n` +
    `Error signal: ${error}\n\n` +
    `Recent build logs:\n${snippet}\n\n` +
    `AUTO-FIX REQUIRED — do NOT tell the user deployment succeeded:\n` +
    `Coolify Docker build logs are GROUND TRUTH.\n` +
    `1. Read the log lines above and identify the root cause.\n` +
    `2. readFile() failing files/components before editing callers.\n` +
    `3. Fix → readFile verify → typeCheck() → save() → deploy() again.\n` +
    `4. Use coolifyMcp({ action: "get_deployment", deploymentUuid }) or coolifyCommand() for deeper inspection if needed.`
  )
}

/** Re-export for deploy trigger responses. */
export { extractDeploymentUuid }
