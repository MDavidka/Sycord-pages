// ============================================================================
// Sycord — Container-per-project workspace provisioning over SSH
// ----------------------------------------------------------------------------
// Replaces the single shared "vm-runner" model. Each project gets its own
// isolated Docker container on the parent VPS. This module:
//
//   1. Bootstraps the parent host (Docker, sycord-net, /opt/sycord, image).
//   2. Provisions a per-project container + Ed25519 keypair, returning the
//      connection details that get stored under the user's project record.
//   3. Connects directly into a container over SSH/SFTP to write files, build
//      the Next.js app, and run `sycord-deploy` to publish it live.
//   4. Reports host/container status and tears workspaces down.
//
// The parent VPS credentials follow the deployment plan's env names, falling
// back to the legacy VPS_SSH_* names for compatibility.
// ============================================================================

import path from "node:path"
import os from "node:os"
import { promises as fs } from "node:fs"
import { NodeSSH } from "node-ssh"

export type ParentVpsConfig = {
  host: string
  username: string
  password: string
  port: number
}

export type WorkspaceCredentials = {
  containerName: string
  sshHost: string
  sshPort: number
  sshUser: string
  /** PEM-encoded Ed25519 private key for connecting into the container. */
  privateKey: string
  publicKey?: string
  createdAt?: string
}

export type ProvisionResult = {
  success: boolean
  phase: string
  error: string | null
  logs: string
  credentials?: WorkspaceCredentials
}

export type DeployResult = {
  success: boolean
  phase: string
  error: string | null
  logs: string
  url?: string
  domain?: string
}

export type WorkspaceFile = { name: string; content: string }

const REMOTE_BASE = "/opt/sycord"
const REMOTE_INFRA = `${REMOTE_BASE}/infra`
const WORKSPACE_IMAGE = "sycord/workspace-base:latest"

export function getBaseDomain(): string {
  return (process.env.SYCORD_BASE_DOMAIN || "sycord.site").trim()
}

/** Resolve parent VPS credentials from the plan's env names (legacy fallback). */
export function getParentVpsConfig(overrides?: Partial<ParentVpsConfig>): ParentVpsConfig {
  const host = overrides?.host || process.env.VPS_HOST || process.env.VPS_SSH_HOST || ""
  const username = overrides?.username || process.env.VPS_USERNAME || "root"
  const password = overrides?.password || process.env.VPS_ROOT_PSW || process.env.VPS_SSH_ROOT_PASSWORD || ""
  const port = Number(overrides?.port || process.env.VPS_SSH_PORT || 22)

  if (!host || !password) {
    throw new Error("Missing parent VPS host or password (set VPS_HOST and VPS_ROOT_PSW)")
  }

  return { host, username, password, port: Number.isFinite(port) ? port : 22 }
}

async function withParentSsh<T>(
  fn: (ssh: NodeSSH) => Promise<T>,
  overrides?: Partial<ParentVpsConfig>,
): Promise<T> {
  const config = getParentVpsConfig(overrides)
  const ssh = new NodeSSH()
  try {
    await ssh.connect({
      host: config.host,
      username: config.username,
      password: config.password,
      port: config.port,
      readyTimeout: 30000,
    })
    return await fn(ssh)
  } finally {
    ssh.dispose()
  }
}

/** Sanitise a project name into a docker-safe container name (sycord-<slug>). */
export function containerNameForProject(projectName: string): string {
  const slug = `sycord-${projectName.replace(/[^a-zA-Z0-9]/g, "-")}`
    .toLowerCase()
    .replace(/-{2,}/g, "-")
    .replace(/-+$/g, "")
  return slug
}

/** Probe SSH connectivity to the parent VPS. */
export async function probeParentVps(overrides?: Partial<ParentVpsConfig>) {
  try {
    const result = await withParentSsh((ssh) => ssh.execCommand("echo connected"), overrides)
    return { reachable: result.stdout.trim() === "connected", error: result.stderr || null }
  } catch (error: any) {
    return { reachable: false, error: error?.message || "SSH probe failed" }
  }
}

/**
 * Bootstrap the parent host: upload infra/, run host-setup.sh, place the
 * provisioning scripts and build the workspace base image. Idempotent.
 */
export async function ensureHostSetup(
  overrides?: Partial<ParentVpsConfig>,
  onLog?: (line: string) => void,
): Promise<ProvisionResult> {
  const localInfra = path.join(process.cwd(), "infra")
  const baseDomain = getBaseDomain()
  const steps: string[] = []
  const emit = (line: string) => {
    if (!line) return
    steps.push(line)
    onLog?.(line)
  }

  return withParentSsh(async (ssh) => {
    let phase = "upload"
    emit(`Uploading infra/ to ${REMOTE_INFRA}...`)
    try {
      await ssh.execCommand(`mkdir -p ${REMOTE_INFRA}`)
      await ssh.putDirectory(localInfra, REMOTE_INFRA, {
        recursive: true,
        concurrency: 4,
        validate: (itemPath) => !/node_modules|\.git/.test(itemPath),
      })
      emit("Uploaded infra files")
    } catch (err: any) {
      const error = `Infra upload failed: ${err?.message || "unknown error"}`
      emit(error)
      return { success: false, phase, error, logs: steps.join("\n") }
    }

    phase = "place-scripts"
    emit("Placing provisioning scripts and image context...")
    const place = await ssh.execCommand(
      [
        "set -e",
        `cp ${REMOTE_INFRA}/setup-workspace.sh ${REMOTE_BASE}/setup-workspace.sh`,
        `cp ${REMOTE_INFRA}/destroy-workspace.sh ${REMOTE_BASE}/destroy-workspace.sh`,
        `mkdir -p ${REMOTE_BASE}/image`,
        `cp ${REMOTE_INFRA}/image/Dockerfile ${REMOTE_BASE}/image/Dockerfile`,
        `cp ${REMOTE_INFRA}/image/entrypoint.sh ${REMOTE_BASE}/image/entrypoint.sh`,
        `cp ${REMOTE_INFRA}/image/sycord-deploy ${REMOTE_BASE}/image/sycord-deploy`,
        `chmod +x ${REMOTE_BASE}/setup-workspace.sh ${REMOTE_BASE}/destroy-workspace.sh ${REMOTE_INFRA}/host-setup.sh`,
      ].join(" && "),
    )
    emit(place.stdout)
    emit(place.stderr)
    if (place.code !== 0) {
      return { success: false, phase, error: `Failed to place scripts (exit ${place.code})`, logs: steps.join("\n") }
    }

    phase = "host-setup"
    emit("Running host-setup.sh (Docker, sycord-net, directories, CDN receiver)...")
    const setup = await ssh.execCommand(`bash ${REMOTE_INFRA}/host-setup.sh 2>&1`, {
      execOptions: { env: { SYCORD_BASE_DOMAIN: baseDomain } },
    })
    emit(setup.stdout)
    emit(setup.stderr)
    if (setup.code !== 0) {
      return { success: false, phase, error: `host-setup.sh failed (exit ${setup.code})`, logs: steps.join("\n") }
    }

    phase = "build-image"
    emit(`Building workspace base image ${WORKSPACE_IMAGE}...`)
    const build = await ssh.execCommand(`docker build -t ${WORKSPACE_IMAGE} ${REMOTE_BASE}/image 2>&1`)
    emit(build.stdout)
    emit(build.stderr)
    if (build.code !== 0) {
      return { success: false, phase, error: `docker build failed (exit ${build.code})`, logs: steps.join("\n") }
    }

    phase = "verify"
    const verify = await ssh.execCommand("docker network inspect sycord-net >/dev/null 2>&1 && echo ok || echo missing")
    const ok = verify.stdout.trim() === "ok"
    emit(ok ? "sycord-net verified" : "sycord-net missing after setup")
    return {
      success: ok,
      phase,
      error: ok ? null : "sycord-net network not present after setup",
      logs: steps.join("\n"),
    }
  }, overrides)
}

function parseProvisionPayload(stdout: string): WorkspaceCredentials | null {
  const begin = stdout.indexOf("---SYCORD_JSON_BEGIN---")
  const end = stdout.indexOf("---SYCORD_JSON_END---")
  if (begin === -1 || end === -1 || end <= begin) return null
  const raw = stdout.slice(begin + "---SYCORD_JSON_BEGIN---".length, end).trim()
  let parsed: any
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (parsed?.status !== "success" || !parsed?.container_name) return null
  const privateKey = parsed.private_key_b64
    ? Buffer.from(String(parsed.private_key_b64), "base64").toString("utf8")
    : String(parsed.private_key || "")
  if (!privateKey) return null
  return {
    containerName: String(parsed.container_name),
    sshHost: String(parsed.ssh_host || ""),
    sshPort: Number(parsed.ssh_port),
    sshUser: String(parsed.ssh_user || "sycord"),
    privateKey,
    publicKey: parsed.public_key ? String(parsed.public_key) : undefined,
    createdAt: new Date().toISOString(),
  }
}

/**
 * Provision a per-project workspace container on the parent VPS. Ensures the
 * host is set up first, then runs setup-workspace.sh and parses the JSON
 * connection payload.
 */
export async function provisionWorkspace(
  projectName: string,
  overrides?: Partial<ParentVpsConfig>,
  onLog?: (line: string) => void,
): Promise<ProvisionResult> {
  const steps: string[] = []
  const emit = (line: string) => {
    if (!line) return
    steps.push(line)
    onLog?.(line)
  }

  // Make sure the host + image exist before provisioning.
  const setup = await ensureHostSetup(overrides, emit)
  if (!setup.success) {
    return { success: false, phase: setup.phase, error: setup.error, logs: steps.join("\n") }
  }

  return withParentSsh(async (ssh) => {
    emit(`Provisioning workspace container for "${projectName}"...`)
    const result = await ssh.execCommand(
      `bash ${REMOTE_BASE}/setup-workspace.sh ${JSON.stringify(projectName)}`,
      { execOptions: { env: { SYCORD_WORKSPACE_IMAGE: WORKSPACE_IMAGE } } },
    )
    if (result.stderr) emit(result.stderr)
    if (result.code !== 0) {
      return {
        success: false,
        phase: "provision",
        error: `setup-workspace.sh failed (exit ${result.code})`,
        logs: steps.join("\n"),
      }
    }

    const credentials = parseProvisionPayload(result.stdout)
    if (!credentials) {
      emit(result.stdout)
      return {
        success: false,
        phase: "provision",
        error: "Could not parse workspace connection payload",
        logs: steps.join("\n"),
      }
    }

    // The host may report an internal IP; prefer the configured public host.
    const config = getParentVpsConfig(overrides)
    if (!credentials.sshHost || credentials.sshHost.startsWith("172.")) {
      credentials.sshHost = config.host
    }

    emit(`Workspace container ${credentials.containerName} ready on port ${credentials.sshPort}`)
    return { success: true, phase: "provision", error: null, logs: steps.join("\n"), credentials }
  }, overrides)
}

async function withContainerSsh<T>(
  credentials: WorkspaceCredentials,
  fn: (ssh: NodeSSH) => Promise<T>,
): Promise<T> {
  const ssh = new NodeSSH()
  try {
    await ssh.connect({
      host: credentials.sshHost,
      port: credentials.sshPort,
      username: credentials.sshUser || "sycord",
      privateKey: credentials.privateKey,
      readyTimeout: 30000,
    })
    return await fn(ssh)
  } finally {
    ssh.dispose()
  }
}

/** Probe SSH connectivity into a provisioned container. */
export async function probeWorkspace(credentials: WorkspaceCredentials) {
  try {
    const result = await withContainerSsh(credentials, (ssh) => ssh.execCommand("echo connected"))
    return { reachable: result.stdout.trim() === "connected", error: result.stderr || null }
  } catch (error: any) {
    return { reachable: false, error: error?.message || "Workspace SSH probe failed" }
  }
}

function isUnsafeFileName(name: string): boolean {
  if (!name) return true
  if (name.includes("..") || name.includes("\0")) return true
  if (path.isAbsolute(name)) return true
  return false
}

/** Materialize files into a local temp dir for SFTP upload. */
async function materializeLocal(files: WorkspaceFile[]): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "sycord-deploy-"))
  for (const file of files) {
    const rel = file.name.replace(/^\/+/, "")
    if (isUnsafeFileName(rel)) continue
    const target = path.resolve(root, rel)
    if (target !== root && !target.startsWith(root + path.sep)) continue
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, file.content ?? "")
  }
  return root
}

/**
 * Deploy a set of files into a provisioned container: upload via SFTP, install
 * dependencies, build the Next.js app, then run `sycord-deploy` to publish.
 */
export async function deployWorkspace(
  credentials: WorkspaceCredentials,
  files: WorkspaceFile[],
  onLog?: (line: string) => void,
): Promise<DeployResult> {
  const steps: string[] = []
  const emit = (line: string) => {
    if (!line) return
    steps.push(line)
    onLog?.(line)
  }

  const baseDomain = getBaseDomain()
  const localRoot = await materializeLocal(files)

  try {
    return await withContainerSsh(credentials, async (ssh) => {
      let phase = "upload"
      emit("Uploading project files into /workspace...")
      const cleared = await ssh.execCommand("rm -rf /workspace/* /workspace/.next 2>/dev/null; mkdir -p /workspace")
      if (cleared.stderr) emit(cleared.stderr)
      const uploaded = await ssh.putDirectory(localRoot, "/workspace", {
        recursive: true,
        concurrency: 4,
        validate: (itemPath) => !/node_modules|\.git/.test(itemPath),
      })
      if (!uploaded) {
        return { success: false, phase, error: "SFTP upload failed", logs: steps.join("\n") }
      }
      emit("Project files uploaded")

      phase = "install"
      emit("Installing dependencies...")
      const install = await ssh.execCommand(
        "if [ -f pnpm-lock.yaml ]; then pnpm install --no-frozen-lockfile; else npm install; fi 2>&1",
        { cwd: "/workspace" },
      )
      emit(install.stdout)
      emit(install.stderr)
      if (install.code !== 0) {
        return { success: false, phase, error: `Dependency install failed (exit ${install.code})`, logs: steps.join("\n") }
      }

      phase = "build"
      emit("Building Next.js production bundle...")
      const build = await ssh.execCommand(
        "rm -rf .next; if [ -f pnpm-lock.yaml ]; then pnpm run build; else npm run build; fi 2>&1",
        { cwd: "/workspace" },
      )
      emit(build.stdout)
      emit(build.stderr)
      if (build.code !== 0) {
        return { success: false, phase, error: `Build failed (exit ${build.code})`, logs: steps.join("\n") }
      }

      phase = "deploy"
      emit("Running sycord-deploy...")
      const deploy = await ssh.execCommand("sycord-deploy 2>&1", { cwd: "/workspace" })
      emit(deploy.stdout)
      emit(deploy.stderr)
      if (deploy.code !== 0) {
        return { success: false, phase, error: `sycord-deploy failed (exit ${deploy.code})`, logs: steps.join("\n") }
      }

      const domain = `${credentials.containerName}.${baseDomain}`
      const url = `https://${domain}`
      emit(`Published to ${url}`)
      return { success: true, phase: "complete", error: null, logs: steps.join("\n"), url, domain }
    })
  } catch (error: any) {
    return { success: false, phase: "deploy", error: error?.message || "Deploy failed", logs: steps.join("\n") }
  } finally {
    await fs.rm(localRoot, { recursive: true, force: true }).catch(() => undefined)
  }
}

/** Tear down a workspace container and all of its artifacts on the host. */
export async function destroyWorkspace(
  containerName: string,
  overrides?: Partial<ParentVpsConfig>,
): Promise<{ success: boolean; logs: string }> {
  return withParentSsh(async (ssh) => {
    const result = await ssh.execCommand(`bash ${REMOTE_BASE}/destroy-workspace.sh ${JSON.stringify(containerName)} 2>&1`)
    const logs = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    return { success: result.code === 0, logs }
  }, overrides)
}

export type WorkspaceContainer = {
  id: string
  containerName: string
  status: string
  running: boolean
  health: "healthy" | "unhealthy" | "unknown"
  sshPort: number | null
  createdAt: string | null
}

/** List all Sycord workspace containers on the parent host. */
export async function listWorkspaceContainers(
  overrides?: Partial<ParentVpsConfig>,
): Promise<WorkspaceContainer[]> {
  return withParentSsh(async (ssh) => {
    const result = await ssh.execCommand(
      "docker ps -a --filter name=sycord- --format '{{.Names}}|{{.State}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}' || true",
    )
    const lines = result.stdout.split("\n").map((l) => l.trim()).filter(Boolean)
    return lines.map((line) => {
      const [name, state, status, ports, createdAt] = line.split("|")
      const portMatch = ports?.match(/0\.0\.0\.0:(\d+)->22/) || ports?.match(/:(\d+)->22/)
      const running = state === "running"
      return {
        id: name,
        containerName: name,
        status: status || state || "unknown",
        running,
        health: running ? "healthy" : "unknown",
        sshPort: portMatch ? Number(portMatch[1]) : null,
        createdAt: createdAt || null,
      } as WorkspaceContainer
    })
  }, overrides)
}

export type HostStatus = {
  online: boolean
  dockerInstalled: boolean
  dockerRunning: boolean
  networkReady: boolean
  receiverReady: boolean
  imageReady: boolean
  baseDomain: string
  containers: number
  runningContainers: number
  error?: string | null
}

/** Read parent host status: docker, sycord-net, receiver, image, containers. */
export async function getHostStatus(overrides?: Partial<ParentVpsConfig>): Promise<HostStatus> {
  const baseDomain = getBaseDomain()
  try {
    return await withParentSsh(async (ssh) => {
      const docker = await ssh.execCommand("command -v docker >/dev/null 2>&1 && echo yes || echo no")
      const dockerRunning = await ssh.execCommand("docker info >/dev/null 2>&1 && echo yes || echo no")
      const network = await ssh.execCommand("docker network inspect sycord-net >/dev/null 2>&1 && echo yes || echo no")
      const receiver = await ssh.execCommand("[ -x /opt/sycord/deployments/receive-deploy.sh ] && echo yes || echo no")
      const image = await ssh.execCommand(`docker image inspect ${WORKSPACE_IMAGE} >/dev/null 2>&1 && echo yes || echo no`)
      const containers = await ssh.execCommand("docker ps -a --filter name=sycord- --format '{{.State}}' || true")
      const states = containers.stdout.split("\n").map((s) => s.trim()).filter(Boolean)

      const dockerInstalled = docker.stdout.trim() === "yes"
      const dockerOk = dockerRunning.stdout.trim() === "yes"
      const networkReady = network.stdout.trim() === "yes"
      const receiverReady = receiver.stdout.trim() === "yes"
      const imageReady = image.stdout.trim() === "yes"

      return {
        online: dockerInstalled && dockerOk && networkReady && receiverReady,
        dockerInstalled,
        dockerRunning: dockerOk,
        networkReady,
        receiverReady,
        imageReady,
        baseDomain,
        containers: states.length,
        runningContainers: states.filter((s) => s === "running").length,
        error: null,
      }
    }, overrides)
  } catch (error: any) {
    return {
      online: false,
      dockerInstalled: false,
      dockerRunning: false,
      networkReady: false,
      receiverReady: false,
      imageReady: false,
      baseDomain,
      containers: 0,
      runningContainers: 0,
      error: error?.message || "Host status check failed",
    }
  }
}

/** Control a single workspace container: start | stop | restart. */
export async function controlWorkspaceContainer(
  containerName: string,
  action: "start" | "stop" | "restart",
  overrides?: Partial<ParentVpsConfig>,
): Promise<{ success: boolean; logs: string }> {
  return withParentSsh(async (ssh) => {
    const result = await ssh.execCommand(`docker ${action} ${JSON.stringify(containerName)} 2>&1`)
    const logs = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    return { success: result.code === 0, logs }
  }, overrides)
}

/** Read the most recent docker logs for a workspace container. */
export async function getContainerLogs(
  containerName: string,
  limit = 200,
  overrides?: Partial<ParentVpsConfig>,
): Promise<string[]> {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.min(limit, 2000) : 200
  return withParentSsh(async (ssh) => {
    const result = await ssh.execCommand(
      `docker logs --tail ${safeLimit} ${JSON.stringify(containerName)} 2>&1 || true`,
    )
    return result.stdout.split("\n").filter(Boolean)
  }, overrides)
}

/** Apply start/stop to every Sycord workspace container on the host. */
export async function controlAllWorkspaceContainers(
  action: "start" | "stop",
  overrides?: Partial<ParentVpsConfig>,
): Promise<{ success: boolean; logs: string }> {
  return withParentSsh(async (ssh) => {
    const names = await ssh.execCommand("docker ps -a --filter name=sycord- --format '{{.Names}}' || true")
    const list = names.stdout.split("\n").map((n) => n.trim()).filter(Boolean)
    if (list.length === 0) return { success: true, logs: "No workspace containers found" }
    const result = await ssh.execCommand(`docker ${action} ${list.map((n) => JSON.stringify(n)).join(" ")} 2>&1`)
    const logs = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    return { success: result.code === 0, logs }
  }, overrides)
}

/** Remove every Sycord workspace container (host stays intact). */
export async function destroyAllWorkspaceContainers(
  overrides?: Partial<ParentVpsConfig>,
): Promise<{ success: boolean; logs: string }> {
  return withParentSsh(async (ssh) => {
    const names = await ssh.execCommand("docker ps -a --filter name=sycord- --format '{{.Names}}' || true")
    const list = names.stdout.split("\n").map((n) => n.trim()).filter(Boolean)
    if (list.length === 0) return { success: true, logs: "No workspace containers found" }
    const result = await ssh.execCommand(`docker rm -f ${list.map((n) => JSON.stringify(n)).join(" ")} 2>&1`)
    const logs = [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
    return { success: result.code === 0, logs }
  }, overrides)
}


export type AdminWebsite = {
  id: string
  businessName: string
  subdomain: string
  status: string
  running: boolean
  health: "healthy" | "unhealthy" | "unknown"
  url: string | null
  sshPort: number | null
}

/**
 * Map the Docker host status + containers into the response shape the existing
 * admin "Runner" tab UI expects (online/degraded/nginx/runner/cloudflared +
 * websites). In the container model:
 *   - "runner"      -> Docker daemon
 *   - "nginx"       -> CDN receiver readiness
 *   - "cloudflared" -> workspace base image readiness
 */
export async function buildAdminStatus(overrides?: Partial<ParentVpsConfig>) {
  const host = await getHostStatus(overrides)
  let websites: AdminWebsite[] = []
  if (host.dockerRunning) {
    try {
      const containers = await listWorkspaceContainers(overrides)
      websites = containers.map((c) => ({
        id: c.containerName,
        businessName: c.containerName.replace(/^sycord-/, ""),
        subdomain: c.containerName,
        status: c.running ? "running" : "stopped",
        running: c.running,
        health: c.health,
        url: `https://${c.containerName}.${host.baseDomain}`,
        sshPort: c.sshPort,
      }))
    } catch {
      websites = []
    }
  }

  return {
    success: host.online || host.dockerRunning,
    online: host.online,
    apiOnline: host.online,
    degraded: !host.online && host.dockerRunning,
    setupComplete: host.online,
    model: "container",
    baseDomain: host.baseDomain,
    warning: host.error
      ? host.error
      : !host.dockerInstalled
        ? "Docker is not installed on the parent VPS"
        : !host.networkReady
          ? "sycord-net Docker network is missing — run setup"
          : !host.receiverReady
            ? "CDN receiver is missing — run setup"
            : !host.imageReady
              ? "Workspace base image not built — run setup"
              : null,
    nginx: { running: host.receiverReady, port80Available: true, port80Owner: null, error: null },
    runner: { running: host.dockerRunning, port: 0 },
    cloudflared: { running: host.imageReady },
    tunnel: { ok: host.imageReady, status: host.imageReady ? "online" : "offline" },
    proxy: { ok: host.receiverReady, status: host.receiverReady ? "online" : "offline" },
    cpu: null,
    mem: { percent: null },
    disk: { percent: null },
    setup: { sitesDirReady: host.receiverReady },
    host,
    websites,
    debug: { sshReachable: host.dockerInstalled || !host.error, sshError: host.error },
  }
}
