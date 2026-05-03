import { promises as fs } from "node:fs"
import path from "node:path"
import { config } from "./config.js"
import { appendLog, ensureBaseDirectories, resetProjectLogs } from "./logs.js"
import { getEnvFilePath, getProcessName, getProjectRoot, validateDeployPath, validateProjectId, validateSubdomain } from "./paths.js"
import { runHealthCheck } from "./health.js"
import { startOrRestartProcess } from "./processes.js"
import { reloadProxy, writeProxyConfig } from "./proxy.js"
import { allocatePort, getWebsiteState, upsertWebsiteState } from "./state.js"
import type { DeployStreamWriter } from "./stream.js"

export type DeployPayload = {
  files: Array<{ path: string; content: string }>
  subdomain: string
  deployment_mode: "next-server"
  env_vars?: Record<string, string>
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

async function runBuildStep(projectId: string, cwd: string, stream: DeployStreamWriter | null) {
  stream?.stage("installing", "running", "Installing dependencies")
  const { runCommand } = await import("./processes.js")
  const install = await runCommand("npm", ["install", "--no-fund", "--no-audit", "--legacy-peer-deps"], {
    cwd,
    onLine: (line) => {
      void appendLog(projectId, "deploy", line)
      void appendLog(projectId, "build", line)
      stream?.log("install", line)
    },
  })
  if (install.code !== 0) {
    throw new Error("npm install failed")
  }

  stream?.stage("building", "running", "Running next build")
  const build = await runCommand("npm", ["run", "build"], {
    cwd,
    onLine: (line) => {
      void appendLog(projectId, "build", line)
      stream?.log("build", line)
    },
  })
  if (build.code !== 0) {
    throw new Error("npm run build failed")
  }
}

export async function deployProject(projectId: string, payload: DeployPayload, stream: DeployStreamWriter | null = null) {
  validateProjectId(projectId)
  validateSubdomain(payload.subdomain)
  if (payload.deployment_mode !== "next-server") {
    throw new Error('deployment_mode must be "next-server"')
  }

  await ensureBaseDirectories()
  await resetProjectLogs(projectId)
  stream?.stage("queued", "running", "Deployment queued")
  stream?.stage("preparing", "running", "Preparing project directory")

  await appendLog(projectId, "deploy", `Preparing deployment for ${projectId}`)
  const cwd = await writeFiles(projectId, payload.files)
  stream?.stage("writing-files", "running", `Writing ${payload.files.length} files`)
  stream?.log("deploy", `Writing ${payload.files.length} files`)

  const envFile = await writeEnvFile(projectId, payload.env_vars)
  await runBuildStep(projectId, cwd, stream)

  const previous = await getWebsiteState(projectId)
  const port = previous?.port || (await allocatePort(projectId))
  const processName = getProcessName(projectId)

  stream?.stage("starting-server", "running", "Starting Next.js server")
  const { code: startCode, stdout: runtimeOut, stderr: runtimeErr } = await startOrRestartProcess(projectId, processName, port, cwd, envFile)
  for (const line of runtimeOut.concat(runtimeErr)) {
    await appendLog(projectId, "runtime", line)
    stream?.log("runtime", line)
  }
  if (startCode !== 0) {
    throw new Error("Failed to start Next.js server")
  }

  const domain = `${payload.subdomain}.${config.baseDomain}`
  stream?.stage("configuring-proxy", "running", "Configuring nginx reverse proxy")
  await writeProxyConfig(projectId, domain, port)
  await reloadProxy()

  stream?.stage("health-check", "running", "Checking root HTML")
  const health = await runHealthCheck(projectId, port)
  if (!health.ok || !health.htmlOk) {
    throw new Error(health.error || "Health check failed")
  }

  const state = await upsertWebsiteState({
    projectId,
    subdomain: payload.subdomain,
    domain,
    port,
    processName,
    status: "running",
    health: "healthy",
    lastDeployAt: new Date().toISOString(),
    lastHealthCheckAt: new Date().toISOString(),
    lastDeployError: null,
  })

  stream?.stage("complete", "success", "Deployment complete")
  stream?.result({
    success: true,
    domain,
    port,
    processName,
    running: true,
    build: { ok: true },
    health,
    url: `https://${domain}`,
  })

  return {
    success: true,
    domain,
    port,
    processName,
    running: true,
    build: { ok: true },
    health,
    url: `https://${domain}`,
    state,
  }
}
