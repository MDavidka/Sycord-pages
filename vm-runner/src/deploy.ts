import { promises as fs } from "node:fs"
import path from "node:path"
import { config } from "./config.js"
import { appendLog, ensureBaseDirectories, resetProjectLogs } from "./logs.js"
import { getEnvFilePath, getProcessName, getProjectRoot, validateDeployPath, validateProjectId, validateSubdomain } from "./paths.js"
import { runHealthCheck, runPublicHealthCheck } from "./health.js"
import { startOrRestartProcess } from "./processes.js"
import { reloadProxy, writeProxyConfig } from "./proxy.js"
import { allocatePort, getWebsiteState, retryAllocatePort, upsertWebsiteState } from "./state.js"
import type { DeployStreamWriter } from "./stream.js"

export type DeployPayload = {
  files: Array<{ path: string; content: string }>
  subdomain: string
  deployment_mode: "next-server"
  env_vars?: Record<string, string>
}

export type DeployResponse = {
  success: boolean
  deployment_mode: "next-server"
  project_id: string
  domain?: string
  url?: string
  port?: number
  processName?: string
  build: {
    ok: boolean
    logs: string[]
    error?: string
  }
  running: boolean
  health: {
    ok: boolean
    htmlOk: boolean
    statusCode?: number
    contentType?: string
    latencyMs?: number
    error?: string
    detail?: string
    url?: string
    protocol?: "https" | "http"
  }
  localHealth?: DeployResponse["health"]
  publicHealth?: DeployResponse["health"]
  logs: string[]
  error?: string
  warning?: string
}

async function writeFiles(projectId: string, files: DeployPayload["files"]) {
  const root = getProjectRoot(projectId)
  await fs.rm(root, { recursive: true, force: true })
  await fs.mkdir(root, { recursive: true })

  for (const file of files) {
    validateDeployPath(file.path)
    const outputPath = path.join(root, file.path)
    await fs.mkdir(path.dirname(outputPath), { recursive: true })
    await fs.writeFile(outputPath, file.content)
  }

  return root
}

async function writeEnvFile(projectId: string, envVars: Record<string, string> = {}) {
  const content = Object.entries(envVars)
    .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
    .join("\n")
  const envPath = getEnvFilePath(projectId)
  await fs.mkdir(path.dirname(envPath), { recursive: true })
  await fs.writeFile(envPath, content, { mode: 0o600 })
  await fs.chmod(envPath, 0o600)
  return envPath
}

async function runBuildStep(projectId: string, cwd: string, stream: DeployStreamWriter | null): Promise<{ logs: string[] }> {
  const buildLogs: string[] = []

  stream?.stage("installing", "running", "Installing dependencies")
  const { runCommand } = await import("./processes.js")
  const install = await runCommand("npm", ["install", "--no-fund", "--no-audit", "--legacy-peer-deps"], {
    cwd,
    onLine: (line) => {
      buildLogs.push(line)
      void appendLog(projectId, "deploy", line)
      void appendLog(projectId, "build", line)
      stream?.log("install", line)
    },
  })
  if (install.code !== 0) {
    const lastLines = buildLogs.slice(-20).join("\n")
    throw new Error(`npm install failed (exit ${install.code}): ${lastLines}`)
  }

  stream?.stage("building", "running", "Running next build")
  const build = await runCommand("npm", ["run", "build"], {
    cwd,
    onLine: (line) => {
      buildLogs.push(line)
      void appendLog(projectId, "build", line)
      stream?.log("build", line)
    },
  })
  if (build.code !== 0) {
    const lastLines = buildLogs.slice(-20).join("\n")
    throw new Error(`npm run build failed (exit ${build.code}): ${lastLines}`)
  }

  return { logs: buildLogs }
}

const MAX_START_RETRIES = 3

export async function deployProject(projectId: string, payload: DeployPayload, stream: DeployStreamWriter | null = null): Promise<DeployResponse> {
  validateProjectId(projectId)
  validateSubdomain(payload.subdomain)
  if (payload.deployment_mode !== "next-server") {
    throw new Error('deployment_mode must be "next-server"')
  }

  await ensureBaseDirectories()
  await resetProjectLogs(projectId)
  stream?.stage("queued", "pending", "Deployment queued")
  stream?.stage("preparing-files", "running", "Preparing project directory")

  await appendLog(projectId, "deploy", `Preparing deployment for ${projectId}`)
  const cwd = await writeFiles(projectId, payload.files)
  stream?.stage("preparing-files", "success", `Wrote ${payload.files.length} files`)
  stream?.log("runner", `Writing ${payload.files.length} files`)

  const envFile = await writeEnvFile(projectId, payload.env_vars)

  const buildResult = await runBuildStep(projectId, cwd, stream)

  stream?.stage("allocating-port", "running", "Allocating port for website")
  const previous = await getWebsiteState(projectId)
  const port = previous?.port || (await allocatePort(projectId))
  const processName = getProcessName(projectId)
  stream?.log("runner", `Allocated port ${port}`)
  stream?.stage("allocating-port", "success", `Port ${port} allocated`)

  stream?.stage("starting-server", "running", "Starting Next.js server")
  let startCode = 0
  let runtimeOut: string[] = []
  let runtimeErr: string[] = []
  let currentPort = port

  for (let attempt = 0; attempt < MAX_START_RETRIES; attempt += 1) {
    const result = await startOrRestartProcess(projectId, processName, currentPort, cwd, envFile)
    startCode = result.code
    runtimeOut = result.stdout
    runtimeErr = result.stderr
    for (const line of runtimeOut.concat(runtimeErr)) {
      await appendLog(projectId, "runtime", line)
      stream?.log("runtime", line)
    }

    if (startCode === 0) break

    const combined = runtimeErr.join("\n").toLowerCase()
    if (combined.includes("eaddrinuse") || combined.includes("address already in use")) {
      const newPort = await retryAllocatePort(projectId, currentPort)
      stream?.log("runner", `Port ${currentPort} in use, retrying with port ${newPort}`)
      await appendLog(projectId, "error", `EADDRINUSE on port ${currentPort}, retrying with ${newPort}`)
      currentPort = newPort
      continue
    }
    throw new Error(`Failed to start Next.js server (exit ${startCode})`)
  }

  if (startCode !== 0) {
    throw new Error(`Failed to start Next.js server after ${MAX_START_RETRIES} attempts`)
  }

  const domain = `${payload.subdomain}.${config.baseDomain}`
  stream?.stage("configuring-proxy", "running", "Configuring nginx reverse proxy")
  await writeProxyConfig(projectId, domain, currentPort)
  await reloadProxy()
  stream?.stage("configuring-proxy", "success", "Proxy configured")

  stream?.stage("health-check", "running", "Checking local Next.js HTML response")
  const health = await runHealthCheck(projectId, currentPort)
  if (!health.ok || !health.htmlOk) {
    stream?.stage("health-check", "error", health.error || "Root response invalid")
    stream?.error({
      error: health.error || "Root route did not return valid HTML",
      stage: "health-check",
      logs: [health.detail || ""],
    })
    const failResponse: DeployResponse = {
      success: false,
      deployment_mode: "next-server",
      project_id: projectId,
      domain,
      port: currentPort,
      processName,
      build: { ok: true, logs: buildResult.logs },
      running: false,
      health: {
        ok: health.ok,
        htmlOk: health.htmlOk,
        statusCode: health.statusCode,
        contentType: health.contentType,
        latencyMs: health.latencyMs,
        error: health.error || undefined,
        detail: health.detail,
      },
      localHealth: health,
      logs: [],
      error: health.error || "Health check failed: root route did not return valid HTML",
    }
    await upsertWebsiteState({
      projectId,
      subdomain: payload.subdomain,
      domain,
      port: currentPort,
      processName,
      status: "failed",
      health: "unhealthy",
      lastDeployAt: new Date().toISOString(),
      lastHealthCheckAt: new Date().toISOString(),
      lastDeployError: failResponse.error || null,
    })
    return failResponse
  }

  stream?.stage("health-check", "success", `Local root returns valid HTML (HTTP ${health.statusCode})`)
  stream?.stage("health-check", "running", `Checking public subdomain ${domain}`)
  const publicHealth = await runPublicHealthCheck(projectId, domain)
  const publicUrl = publicHealth.url || `https://${domain}`
  const insecurePublicUrlWarning = publicHealth.ok && publicHealth.protocol === "http"
    ? "Public subdomain only passed over HTTP. Configure Cloudflare/TLS before advertising it as HTTPS."
    : undefined

  if (!publicHealth.ok || !publicHealth.htmlOk) {
    const error = publicHealth.error || "Public subdomain did not return valid HTML"
    stream?.stage("health-check", "error", error)
    stream?.error({
      error,
      stage: "public-health-check",
      logs: [publicHealth.detail || ""],
      localHealth: health,
      publicHealth,
    })
    const failResponse: DeployResponse = {
      success: false,
      deployment_mode: "next-server",
      project_id: projectId,
      domain,
      url: publicUrl,
      port: currentPort,
      processName,
      build: { ok: true, logs: buildResult.logs },
      running: true,
      health: {
        ok: publicHealth.ok,
        htmlOk: publicHealth.htmlOk,
        statusCode: publicHealth.statusCode,
        contentType: publicHealth.contentType,
        latencyMs: publicHealth.latencyMs,
        error,
        detail: publicHealth.detail,
        url: publicUrl,
        protocol: publicHealth.protocol,
      },
      localHealth: health,
      publicHealth,
      logs: [],
      error,
    }
    await upsertWebsiteState({
      projectId,
      subdomain: payload.subdomain,
      domain,
      port: currentPort,
      processName,
      status: "failed",
      health: "unhealthy",
      lastDeployAt: new Date().toISOString(),
      lastHealthCheckAt: new Date().toISOString(),
      lastDeployError: `${error}${publicHealth.detail ? `: ${publicHealth.detail}` : ""}`,
    })
    return failResponse
  }

  stream?.stage("health-check", "success", `Public subdomain returns valid HTML (${publicHealth.protocol?.toUpperCase() || "HTTPS"})`)

  await upsertWebsiteState({
    projectId,
    subdomain: payload.subdomain,
    domain,
    port: currentPort,
    processName,
    status: "running",
    health: "healthy",
    lastDeployAt: new Date().toISOString(),
    lastHealthCheckAt: new Date().toISOString(),
    lastDeployError: null,
  })

  stream?.stage("complete", "success", insecurePublicUrlWarning || "Deployment complete")
  stream?.result({
    success: true,
    domain,
    url: publicUrl,
    port: currentPort,
    processName,
    running: true,
    build: { ok: true },
    health: publicHealth,
    localHealth: health,
    publicHealth,
    warning: insecurePublicUrlWarning,
  })

  return {
    success: true,
    deployment_mode: "next-server",
    project_id: projectId,
    domain,
    url: publicUrl,
    port: currentPort,
    processName,
    build: { ok: true, logs: buildResult.logs },
    running: true,
    health: {
      ok: publicHealth.ok,
      htmlOk: publicHealth.htmlOk,
      statusCode: publicHealth.statusCode,
      contentType: publicHealth.contentType,
      latencyMs: publicHealth.latencyMs,
      url: publicUrl,
      protocol: publicHealth.protocol,
    },
    localHealth: health,
    publicHealth,
    logs: [],
    warning: insecurePublicUrlWarning,
  }
}
