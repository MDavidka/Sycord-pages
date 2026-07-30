import * as crypto from "node:crypto"
import * as path from "node:path"
import { NodeSSH } from "node-ssh"
import clientPromise from "@/lib/torso"

export type SshDeploymentMode = "ssh"

export type DeployFile = {
  path: string
  content: string
}

export type ContainerInfo = {
  projectId: string
  containerName: string
  workspaceName: string
  privateKey: string
  publicKey: string
  host: string
  port: number
  createdAt: Date
}

export type DeployStreamEvent =
  | {
      type: "stage"
      stage:
        | "queued"
        | "preparing"
        | "container-setup"
        | "upload"
        | "build"
        | "publish"
        | "saving"
        | "health-check"
        | "complete"
        | "failed"
      status: "pending" | "running" | "success" | "error"
      message: string
      timestamp: string
    }
  | {
      type: "log"
      source: "ssh" | "build" | "publish" | "health"
      line: string
      timestamp: string
    }
  | {
      type: "result"
      success: true
      url: string
      domain: string
      health: unknown
      warning?: string
      timestamp: string
    }
  | {
      type: "error"
      error: string
      stage?: string
      logs?: string[]
      timestamp: string
    }

function now() {
  return new Date().toISOString()
}

export function generateSshKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 4096,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  })
  return { privateKey, publicKey }
}

function getVpsConfig(): { host: string; username: string; password: string; port: number } {
  // Accept both env var naming schemes so the per-project deploy path and the
  // admin setuper (lib/admin/vm-ssh.ts) always target the same VM.
  const host = process.env.VPS_HOST || process.env.VPS_SSH_HOST
  const username = process.env.VPS_USERNAME || "root"
  const password = process.env.VPS_ROOT_PSW || process.env.VPS_SSH_ROOT_PASSWORD
  const port = Number(process.env.VPS_SSH_PORT || "22")

  if (!host || !password) {
    throw new Error("VPS_HOST and VPS_ROOT_PSW environment variables are required")
  }

  return { host, username, password, port }
}

export function getVpsDebugInfo(): Record<string, unknown> {
  return {
    host: process.env.VPS_HOST || process.env.VPS_SSH_HOST || "not set",
    username: process.env.VPS_USERNAME || "root",
    passwordConfigured: !!(process.env.VPS_ROOT_PSW || process.env.VPS_SSH_ROOT_PASSWORD),
    port: Number(process.env.VPS_SSH_PORT || "22"),
  }
}

async function getSshConnection(host: string, username: string, password: string, port: number): Promise<NodeSSH> {
  const ssh = new NodeSSH()
  await ssh.connect({ host, username, password, port })
  return ssh
}

function stripLeadingSlash(input: string) {
  return input.replace(/^\/+/, "")
}

export function prepareProjectDeployFiles(project: any): DeployFile[] {
  const pages = Array.isArray(project?.pages) ? project.pages : []
  return pages
    .filter((page: any) => typeof page?.name === "string" && typeof page?.content === "string")
    .map((page: any) => ({
      path: stripLeadingSlash(page.name),
      content: page.content,
    }))
}

export function validateSshDeployFiles(files: DeployFile[]): string[] {
  const errors: string[] = []
  if (!files.length) {
    errors.push("No files to deploy")
    return errors
  }
  for (const file of files) {
    if (!file.path || file.path.startsWith("/") || file.path.includes("..")) {
      errors.push(`Invalid deploy path: ${file.path || "(empty)"}`)
      continue
    }
    if (/^\.env(?:\.|$)/.test(file.path) || /\/\.env(?:\.|$)/.test(file.path)) {
      errors.push(`Env files must not be deployed: ${file.path}`)
    }
  }
  return errors
}

export function slugifyContainerName(project: any, projectId: string): string {
  return (
    project?.containerName ||
    (project?.businessName
      ? project.businessName.toLowerCase().replace(/[^a-z0-9-]/g, "-")
      : `project-${projectId}`)
  )
}

export async function ensureContainer(
  project: any,
  projectId: string,
): Promise<ContainerInfo> {
  const client = await clientPromise
  const db = client.db()

  const existing = await db.collection("containers").findOne({ projectId })
  if (existing) {
    return existing as unknown as ContainerInfo
  }

  const vps = getVpsConfig()
  const containerName = slugifyContainerName(project, projectId)
  const workspaceName = `/srv/sycord/workspaces/${containerName}`
  const keys = generateSshKeyPair()

  const container: ContainerInfo = {
    projectId,
    containerName,
    workspaceName,
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    host: vps.host,
    port: vps.port,
    createdAt: new Date(),
  }

  await db.collection("containers").insertOne(container as any)

  return container
}

export async function getContainer(projectId: string): Promise<ContainerInfo | null> {
  const client = await clientPromise
  const db = client.db()
  return db.collection("containers").findOne({ projectId }) as unknown as ContainerInfo | null
}

export async function bootstrapContainer(container: ContainerInfo): Promise<{ success: boolean; error?: string }> {
  const vps = getVpsConfig()
  const ssh = await getSshConnection(vps.host, vps.username, vps.password, vps.port)

  try {
    await ssh.execCommand(
      `mkdir -p ${container.workspaceName} /srv/sycord/deploy/${container.containerName}`,
    )

    // Ensure nginx is installed and configured for sites-enabled includes
    const nginxCheck = await ssh.execCommand("which nginx 2>&1 || echo 'NOT_FOUND'")
    if (nginxCheck.stdout.includes("NOT_FOUND")) {
      await ssh.execCommand("apt-get update -qq && apt-get install -y -qq nginx 2>&1")
    }

    // Ensure nginx loads configs from sites-enabled directory
    const nginxConfCheck = await ssh.execCommand("grep -r 'sites-enabled' /etc/nginx/nginx.conf /etc/nginx/conf.d/ 2>&1 || echo 'NO_INCLUDE'")
    if (nginxConfCheck.stdout.includes("NO_INCLUDE")) {
      await ssh.execCommand(
        "mkdir -p /etc/nginx/sites-enabled && " +
        "grep -q 'include /etc/nginx/sites-enabled' /etc/nginx/nginx.conf || " +
        "sed -i '/http {/a \\    include /etc/nginx/sites-enabled/*;' /etc/nginx/nginx.conf 2>&1 || true"
      )
    }

    await ssh.execCommand("mkdir -p /etc/nginx/sites-enabled")
    await ssh.execCommand("nginx -t 2>&1 && systemctl enable nginx 2>&1 && systemctl start nginx 2>&1 || true")

    const deployScriptPath = `/srv/sycord/deploy/${container.containerName}/sycord-deploy.sh`
    const deployScript = `#!/bin/bash
set -e
# Sycord Deploy Script for container: ${container.containerName}
WORKSPACE="${container.workspaceName}"
DEPLOY_DIR="/srv/sycord/deploy/${container.containerName}"
PUBLISH_DIR="/var/www/sycord/${container.containerName}"

echo "[sycord-deploy] Starting deployment for ${container.containerName}..."

# Extract build
mkdir -p "\$WORKSPACE"
if [ -f "\$DEPLOY_DIR/build.tar.gz" ]; then
  tar -xzf "\$DEPLOY_DIR/build.tar.gz" -C "\$WORKSPACE"
  echo "[sycord-deploy] Build extracted to \$WORKSPACE"
else
  echo "[sycord-deploy] No build.tar.gz found — using workspace files directly"
fi

# Install deps and build
cd "\$WORKSPACE"
if [ -f "package.json" ]; then
  npm install --legacy-peer-deps --prefer-offline 2>&1
  npm run build 2>&1
fi

# Publish
mkdir -p "\$PUBLISH_DIR"
if [ -d ".next" ] || [ -d "out" ]; then
  cp -r .next "\$PUBLISH_DIR/" 2>/dev/null || true
  cp -r out "\$PUBLISH_DIR/" 2>/dev/null || true
  echo "[sycord-deploy] Published to \$PUBLISH_DIR"
fi

echo "[sycord-deploy] Deployment complete"
`

    await ssh.execCommand(`cat > ${deployScriptPath} << 'SYCORD_EOF'
${deployScript}
SYCORD_EOF
chmod +x ${deployScriptPath}`)

    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || "Container bootstrap failed" }
  } finally {
    ssh.dispose()
  }
}

export async function sshDeployFiles(
  container: ContainerInfo,
  files: DeployFile[],
): Promise<{ success: boolean; error?: string; logs: string[] }> {
  const vps = getVpsConfig()
  const ssh = await getSshConnection(vps.host, vps.username, vps.password, vps.port)
  const logs: string[] = []

  try {
    logs.push(`[ssh-deploy] Connected to ${vps.host}`)
    logs.push(`[ssh-deploy] Deploying ${files.length} files to ${container.workspaceName}`)

    await ssh.execCommand(`mkdir -p ${container.workspaceName}`)

    for (const file of files) {
      const remotePath = path.posix.join(container.workspaceName, file.path)
      await ssh.execCommand(`mkdir -p "$(dirname "${remotePath}")"`)
      await ssh.execCommand(`cat > "${remotePath}" << 'FILECONTENT_EOF'
${file.content}
FILECONTENT_EOF`)
      logs.push(`[ssh-deploy] Written: ${file.path}`)
    }

    const buildDir = `/srv/sycord/deploy/${container.containerName}`
    await ssh.execCommand(`mkdir -p ${buildDir}`)

    await ssh.execCommand(`cd ${container.workspaceName} && tar -czf ${buildDir}/build.tar.gz . 2>&1 || true`)

    const deployScript = `/srv/sycord/deploy/${container.containerName}/sycord-deploy.sh`
    const buildResult = await ssh.execCommand(`bash ${deployScript} 2>&1`)
    logs.push(`[ssh-deploy] Build output: ${buildResult.stdout}`)
    if (buildResult.stderr) {
      logs.push(`[ssh-deploy] Build stderr: ${buildResult.stderr}`)
    }

    if (buildResult.code !== 0) {
      return { success: false, error: `Build failed with exit code ${buildResult.code}`, logs }
    }

    const publishDir = `/var/www/sycord/${container.containerName}`
    const publishCheck = await ssh.execCommand(`ls ${publishDir} 2>&1 || echo "EMPTY_DIR"`)

    logs.push(`[ssh-deploy] Published to ${publishDir}`)
    if (publishCheck.stdout.includes("EMPTY_DIR")) {
      logs.push("[ssh-deploy] Warning: publish directory is empty")
    }

    return { success: true, logs }
  } catch (err: any) {
    logs.push(`[ssh-deploy] Error: ${err?.message || "Unknown error"}`)
    return { success: false, error: err?.message || "SSH deployment failed", logs }
  } finally {
    ssh.dispose()
  }
}

export async function sshExecuteCommand(
  container: ContainerInfo,
  command: string,
  cwd?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null }> {
  const vps = getVpsConfig()
  const ssh = await getSshConnection(vps.host, vps.username, vps.password, vps.port)

  try {
    const workDir = cwd ? path.posix.join(container.workspaceName, cwd.replace(/^\/+/, "")) : container.workspaceName

    const result = await ssh.execCommand(command, { cwd: workDir })
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      exitCode: result.code,
    }
  } finally {
    ssh.dispose()
  }
}

export function createStageEvent(
  stage: Extract<DeployStreamEvent, { type: "stage" }>["stage"],
  status: Extract<DeployStreamEvent, { type: "stage" }>["status"],
  message: string,
): DeployStreamEvent {
  return { type: "stage", stage, status, message, timestamp: now() }
}

export function createLogEvent(
  source: Extract<DeployStreamEvent, { type: "log" }>["source"],
  line: string,
): DeployStreamEvent {
  return { type: "log", source, line: redactSecrets(line), timestamp: now() }
}

export function createErrorEvent(error: string, stage?: string, logs?: string[]): DeployStreamEvent {
  return {
    type: "error",
    error: redactSecrets(error),
    stage,
    logs: logs?.map((line) => redactSecrets(line)),
    timestamp: now(),
  }
}

export function createResultEvent(result: {
  url: string
  domain: string
  health: unknown
  warning?: string
}): DeployStreamEvent {
  return {
    type: "result",
    success: true,
    url: result.url,
    domain: result.domain,
    health: result.health,
    warning: result.warning,
    timestamp: now(),
  }
}

export function toSseChunk(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function redactSecrets(input: string): string {
  return input
    .replace(/(token|secret|apikey|api_key|password|privatekey)\s*[:=]\s*([^\s]+)/gi, "$1=[redacted]")
    .replace(/(TURSO_AUTH_TOKEN|GITHUB_TOKEN|GITHUB_API_TOKEN|DATABASE_URL)=([^\s]+)/g, "$1=[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]")
    .replace(/libsql:\/\/[^\s]+/gi, "[redacted-database-url]")
    .replace(/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[^-]*-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi, "[redacted-ssh-key]")
}

export async function probeSshConnection(): Promise<{ reachable: boolean; error?: string; debug: Record<string, unknown> }> {
  try {
    const vps = getVpsConfig()
    const ssh = await getSshConnection(vps.host, vps.username, vps.password, vps.port)
    const result = await ssh.execCommand("echo connected && hostname && whoami")
    ssh.dispose()

    return {
      reachable: true,
      debug: {
        host: vps.host,
        username: vps.username,
        port: vps.port,
        response: result.stdout.trim(),
        configured: true,
      },
    }
  } catch (err: any) {
    return {
      reachable: false,
      error: err?.message || "SSH probe failed",
      debug: {
        error: err?.message,
        configured: !!(process.env.VPS_HOST && process.env.VPS_ROOT_PSW),
      },
    }
  }
}

const PORT_START = 4100
const PORT_END = 4999

async function allocatePort(ssh: NodeSSH): Promise<number> {
  for (let port = PORT_START; port <= PORT_END; port++) {
    const check = await ssh.execCommand(`ss -ltnp | grep ':${port} ' || true`)
    if (!check.stdout.trim()) return port
  }
  throw new Error("No available ports in range 4100-4999")
}

async function writeNginxSiteConfig(
  ssh: NodeSSH,
  serverName: string,
  port: number,
): Promise<void> {
  const config = `server {
  listen 80;
  server_name ${serverName};

  location / {
    proxy_pass http://127.0.0.1:${port};
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 300;
    proxy_connect_timeout 300;
    proxy_send_timeout 300;
  }
}
`

  const safeName = serverName.replace(/[^a-zA-Z0-9._-]/g, "-")
  await ssh.execCommand(`cat > /etc/nginx/sites-enabled/sycord-${safeName}.conf << 'NGINX_EOF'
${config}
NGINX_EOF`)
}

async function reloadNginx(ssh: NodeSSH): Promise<boolean> {
  const test = await ssh.execCommand("nginx -t 2>&1")
  if (test.code !== 0) return false
  const reload = await ssh.execCommand("systemctl reload nginx 2>&1")
  return reload.code === 0
}

async function startPm2Site(
  ssh: NodeSSH,
  projectName: string,
  workspaceName: string,
  port: number,
): Promise<boolean> {
  const pm2Name = `sycord-${projectName}`.slice(0, 30)

  // Verify the build output exists before trying to start
  const buildCheck = await ssh.execCommand(`ls ${workspaceName}/.next ${workspaceName}/out ${workspaceName}/dist 2>&1 || echo "NO_BUILD_OUTPUT"`)
  if (buildCheck.stdout.includes("NO_BUILD_OUTPUT") && !buildCheck.stdout.includes(".next")) {
    return false
  }

  // Stop existing instance if any
  await ssh.execCommand(`pm2 delete "${pm2Name}" 2>&1 || true`)

  // Start with explicit PORT environment — env vars go BEFORE pm2 command
  const startCmd = `cd ${workspaceName} && PORT=${port} NODE_ENV=production pm2 start npm --name "${pm2Name}" -- run start 2>&1`
  const result = await ssh.execCommand(startCmd)
  const output = result.stdout + result.stderr

  // Give the process a moment to start
  await new Promise((r) => setTimeout(r, 3000))

  // Verify process is online by checking pm2 list
  const status = await ssh.execCommand("pm2 jlist 2>&1")
  const online = output.includes("online") || status.stdout.includes(`"name":"${pm2Name}"`)

  // Save pm2 process list for restart on reboot
  await ssh.execCommand("pm2 save 2>&1 || true")

  // Quick health check on local port
  const health = await ssh.execCommand(`curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${port} 2>&1 || echo "000"`)
  const healthOk = health.stdout.trim() !== "000" && health.stdout.trim() !== "502"

  return online || result.code === 0 || healthOk
}

async function ensurePm2Startup(ssh: NodeSSH): Promise<void> {
  await ssh.execCommand("pm2 startup systemd -u root --hp /root 2>&1 || true")
  await ssh.execCommand("pm2 save 2>&1 || true")
}

/**
 * With the API-managed tunnel, all `*.<baseDomain>` traffic is already routed
 * to this VM's nginx (:80) via the wildcard ingress + wildcard DNS created by
 * the admin setuper. So a freshly deployed `<project>.<baseDomain>` is reachable
 * immediately once its nginx vhost exists — no per-host CLI command is needed
 * (and the old `cloudflared tunnel route dns` CLI cannot work with token-based
 * tunnels because there is no local cert.pem).
 *
 * As an optional belt-and-suspenders, if the Cloudflare API is configured we
 * also ensure an explicit per-host CNAME exists (harmless; the wildcard already
 * covers it). We then confirm the cloudflared service is running on the VM.
 */
async function updateCloudflareTunnelRoute(
  ssh: NodeSSH,
  hostname: string,
  _port: number,
): Promise<{ updated: boolean; detail: string }> {
  try {
    // Make sure the tunnel daemon is up so traffic can flow.
    const serviceCheck = await ssh.execCommand("systemctl is-active cloudflared 2>&1 || echo 'inactive'")
    const running = serviceCheck.stdout.includes("active")
    if (!running) {
      await ssh.execCommand("systemctl restart cloudflared 2>&1 || true")
    }

    // Optionally ensure an explicit per-host DNS record via the Cloudflare API.
    try {
      const { getCloudflareEnv, ensureTunnelDns } = await import("@/lib/admin/cloudflare-api")
      const { getTunnelStateFromDb } = await import("@/lib/admin/vm-ssh")
      const env = getCloudflareEnv()
      const state = await getTunnelStateFromDb()
      if (env && state?.tunnelId) {
        const dns = await ensureTunnelDns(env, hostname, state.tunnelId)
        return {
          updated: dns.ok,
          detail: dns.ok
            ? `Reachable via wildcard tunnel; per-host DNS ${dns.created ? "created" : "verified"} for ${hostname}`
            : `Wildcard tunnel handles routing (per-host DNS skipped: ${dns.error})`,
        }
      }
    } catch {
      /* API not available — wildcard still covers the host */
    }

    return {
      updated: running,
      detail: running
        ? `Reachable via wildcard tunnel (*.${hostname.split(".").slice(1).join(".")} → nginx)`
        : "cloudflared service was not active — restarted it; run Setup Deployer if the site stays unreachable",
    }
  } catch (err: any) {
    return { updated: false, detail: err?.message || "Tunnel route check failed" }
  }
}

async function healthCheckSite(url: string, maxRetries = 3): Promise<{ ok: boolean; status?: number; error?: string }> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, 2000))
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 5000)
      const res = await fetch(url, { method: "HEAD", signal: controller.signal as any })
      clearTimeout(timer)
      if (res.ok || res.status < 500) {
        return { ok: true, status: res.status }
      }
    } catch (err: any) {
      if (i === maxRetries - 1) {
        return { ok: false, error: err?.message || "Health check failed" }
      }
    }
  }
  return { ok: false, error: "Health check timeout after retries" }
}

export async function publishSiteViaNginx(
  containerName: string,
  workspaceName: string,
  domain: string,
): Promise<{ url: string; port: number; success: boolean; error?: string; tunnelRoute?: { updated: boolean; detail: string }; health?: { ok: boolean; status?: number; error?: string } }> {
  const vps = getVpsConfig()
  const ssh = await getSshConnection(vps.host, vps.username, vps.password, vps.port)
  try {
    const port = await allocatePort(ssh)
    const serverName = `${containerName}.${domain}`
    const url = `https://${serverName}`

    await writeNginxSiteConfig(ssh, serverName, port)

    await ensurePm2Startup(ssh)

    const started = await startPm2Site(ssh, containerName, workspaceName, port)
    if (!started) {
      return { url, port, success: false, error: "PM2 start failed" }
    }

    const nginxOk = await reloadNginx(ssh)
    if (!nginxOk) {
      return { url, port, success: false, error: "Nginx reload failed" }
    }

    const tunnelRoute = await updateCloudflareTunnelRoute(ssh, serverName, port)

    const serviceCheck = await ssh.execCommand("systemctl is-active cloudflared 2>&1 || echo 'inactive'")
    if (!serviceCheck.stdout.includes("active")) {
      await ssh.execCommand("systemctl restart cloudflared 2>&1 || true")
    }

    return { url, port, success: true, tunnelRoute, health: { ok: true } }
  } catch (err: any) {
    return { url: `https://${containerName}.${domain}`, port: 0, success: false, error: err?.message }
  } finally {
    ssh.dispose()
  }
}

export async function getVpsDiagnostics(): Promise<Record<string, unknown>> {
  try {
    const vps = getVpsConfig()
    const ssh = await getSshConnection(vps.host, vps.username, vps.password, vps.port)

    const [containers, disk, memory, uptime, dockerPs] = await Promise.all([
      ssh.execCommand("ls /srv/sycord/workspaces/ 2>&1 || echo 'no-workspaces'"),
      ssh.execCommand("df -h / | tail -n1 || true"),
      ssh.execCommand("free -h | grep Mem || true"),
      ssh.execCommand("uptime || true"),
      ssh.execCommand("docker ps --format '{{.Names}} {{.Status}}' 2>&1 || echo 'no-docker'"),
    ])
    ssh.dispose()

    return {
      host: vps.host,
      username: vps.username,
      containers: containers.stdout.trim().split("\n").filter(Boolean),
      disk: disk.stdout.trim(),
      memory: memory.stdout.trim(),
      uptime: uptime.stdout.trim(),
      dockerProcesses: dockerPs.stdout.trim().split("\n").filter(Boolean),
    }
  } catch (err: any) {
    return {
      error: err?.message || "Failed to get VPS diagnostics",
      configured: !!(process.env.VPS_HOST && process.env.VPS_ROOT_PSW),
    }
  }
}
