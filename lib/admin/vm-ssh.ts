import path from "node:path"
import * as crypto from "node:crypto"
import { NodeSSH } from "node-ssh"
import clientPromise from "@/lib/mongodb"

type SshConfig = {
  host: string
  password: string
  port: number
  username: string
}

export type VmSetupInput = {
  host: string
  password: string
  port?: number
  baseDomain?: string
  runnerToken?: string
}

export type VmSetupResult = {
  success: boolean
  phase: string
  error: string | null
  logs: string
  runnerUrl?: string
  runnerToken?: string
  baseDomain?: string
}

function getSshConfig(input?: VmSetupInput): SshConfig {
  // Accept both env var naming schemes so the admin setuper and the per-project
  // deploy path (lib/deploy/ssh-deploy.ts) always target the same VM.
  const host = input?.host || process.env.VPS_SSH_HOST || process.env.VPS_HOST
  const password =
    input?.password || process.env.VPS_SSH_ROOT_PASSWORD || process.env.VPS_ROOT_PSW
  const port = Number(input?.port || process.env.VPS_SSH_PORT || "22")

  if (!host || !password) {
    throw new Error("Missing VM host or root password")
  }

  return {
    host,
    password,
    port,
    username: process.env.VPS_USERNAME || "root",
  }
}

async function withRootSsh<T>(fn: (ssh: NodeSSH) => Promise<T>, input?: VmSetupInput) {
  const ssh = new NodeSSH()
  try {
    await ssh.connect(getSshConfig(input))
    return await fn(ssh)
  } finally {
    ssh.dispose()
  }
}

export async function probeDeployVmSsh(input?: VmSetupInput) {
  try {
    const result = await withRootSsh(
      async (ssh) => ssh.execCommand("echo connected"),
      input,
    )
    return {
      reachable: result.stdout.trim() === "connected",
      error: result.stderr || null,
    }
  } catch (error: any) {
    return {
      reachable: false,
      error: error?.message || "SSH probe failed",
    }
  }
}

export async function readDeployVmDiagnostics(input?: VmSetupInput) {
  return withRootSsh(async (ssh) => {
    const port80 = await ssh.execCommand("ss -ltnp | grep ':5050' || true")
    const port5050 = await ssh.execCommand("ss -ltnp | grep ':5050' || true")
    const port5051 = await ssh.execCommand("ss -ltnp | grep ':5051' || true")
    const nginx = await ssh.execCommand("systemctl is-active nginx || true")
    const cloudflared = await ssh.execCommand("systemctl is-active cloudflared || true")
    const cloudflaredProcess = await ssh.execCommand("pgrep -af cloudflared || true")
    const related = await ssh.execCommand("systemctl list-units --type=service --all | grep -Ei 'flask|python|runner|sycord|server|nginx|caddy|cloudflared' || true")
    const port80Pid = port80.stdout.match(/pid=(\d+)/)?.[1] || null
    const port80ParentPid = port80Pid ? await ssh.execCommand(`ps -p ${port80Pid} -o ppid= | tr -d ' ' || true`) : { stdout: "", stderr: "" }
    const port80Process = port80Pid ? await ssh.execCommand(`ps -p ${port80Pid} -o pid=,ppid=,comm=,args= || true`) : { stdout: "", stderr: "" }
    const port80ParentProcess = port80ParentPid.stdout.trim()
      ? await ssh.execCommand(`ps -p ${port80ParentPid.stdout.trim()} -o pid=,ppid=,comm=,args= || true`)
      : { stdout: "", stderr: "" }
    const port80Exe = port80Pid ? await ssh.execCommand(`readlink -f /proc/${port80Pid}/exe || true`) : { stdout: "", stderr: "" }
    const port80Service = port80Pid ? await ssh.execCommand(`grep -oE '[^/[:space:]]+\\.service' /proc/${port80Pid}/cgroup | head -n1 || true`) : { stdout: "", stderr: "" }
    const port80StartupRefs =
      port80Pid && (port80Exe.stdout.trim() || port80Process.stdout.trim())
        ? await ssh.execCommand(
            `grep -RInE '${(port80Exe.stdout.trim() || "").replace(/[.[\]{}()*+?^$|\\]/g, "\\$&")}|/go/bin/main|main /go/bin/main|/root/myapp' /etc/systemd/system /lib/systemd/system /usr/lib/systemd/system /etc/rc.local /etc/crontab /var/spool/cron/crontabs/root /root/.config/systemd /root 2>/dev/null | grep -vE '/root/myapp/cloudflared|/srv/sycord/vm-runner|sycord-vm-runner' || true`,
          )
        : { stdout: "", stderr: "" }

    return {
      nginx: {
        running: nginx.stdout.trim() === "active",
        port80Available:
          !port80.stdout.trim() ||
          port80.stdout.includes("nginx") ||
          port80Service.stdout.includes("nginx.service") ||
          port80Process.stdout.includes("nginx"),
        port80Owner: [
          port80.stdout.trim(),
          port80Service.stdout.trim() ? `service=${port80Service.stdout.trim()}` : "",
          port80Exe.stdout.trim() ? `exe=${port80Exe.stdout.trim()}` : "",
          port80Process.stdout.trim() ? `process=${port80Process.stdout.trim()}` : "",
          port80ParentProcess.stdout.trim() ? `parent=${port80ParentProcess.stdout.trim()}` : "",
        ]
          .filter(Boolean)
          .join("\n") || null,
        error:
          port80.stdout.trim() &&
          !port80.stdout.includes("nginx") &&
          !port80Service.stdout.includes("nginx.service") &&
          !port80Process.stdout.includes("nginx")
            ? "Port 80 already in use"
            : null,
      },
      runner: {
        running: Boolean(port5051.stdout.trim()),
        port: 5051,
        portOwner: port5051.stdout.trim() || null,
      },
      cloudflared: {
        running: cloudflared.stdout.trim() === "active" || Boolean(cloudflaredProcess.stdout.trim()),
        processes: cloudflaredProcess.stdout.split("\n").filter(Boolean),
      },
      diagnostics: {
        port80ParentPid: port80ParentPid.stdout.trim() || null,
        port80ParentProcess: port80ParentProcess.stdout.trim() || null,
        port80StartupReferences: port80StartupRefs.stdout.split("\n").filter(Boolean),
        cloudflaredProcesses: cloudflaredProcess.stdout.split("\n").filter(Boolean),
        relatedServices: related.stdout.split("\n").filter(Boolean),
      },
    }
  }, input)
}

export async function manageDeployVmRunnerService(action: "start" | "stop" | "restart" | "status", input?: VmSetupInput) {
  return withRootSsh(async (ssh) => {
    const command =
      action === "status"
        ? "systemctl status sycord-vm-runner --no-pager || true"
        : `systemctl ${action} sycord-vm-runner && systemctl status sycord-vm-runner --no-pager || true`

    const result = await ssh.execCommand(command)
    const runnerSocket = await ssh.execCommand("ss -ltnp | grep ':5051' || true")
    const nginxSocket = await ssh.execCommand("ss -ltnp | grep ':5050' || true")
    const cloudflared = await ssh.execCommand("pgrep -af cloudflared || true")

    return {
      success:
        action === "stop"
          ? !runnerSocket.stdout.trim()
          : Boolean(runnerSocket.stdout.trim()),
      action,
      logs: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
      diagnostics: {
        runner: {
          running: Boolean(runnerSocket.stdout.trim()),
          port: 5050,
          portOwner: runnerSocket.stdout.trim() || null,
        },
        nginx: {
          running: Boolean(nginxSocket.stdout.includes("nginx")),
          port80Owner: nginxSocket.stdout.trim() || null,
        },
        cloudflared: {
          running: Boolean(cloudflared.stdout.trim()),
          processes: cloudflared.stdout.split("\n").filter(Boolean),
        },
        diagnostics: {},
      },
    }
  }, input)
}

export function generateRunnerToken(): string {
  return crypto.randomBytes(32).toString("hex")
}

export type TunnelSetupState = {
  phase: "install" | "login-needed" | "login-polling" | "create-tunnel" | "config" | "service" | "complete" | "error"
  tunnelId?: string
  credentialsPath?: string
  loginUrl?: string
  error?: string
  logs: string[]
  baseDomain: string
  host: string
}

export async function installCloudflared(ssh: NodeSSH, logs: string[]): Promise<boolean> {
  logs.push("[cloudflare] Checking cloudflared installation...")
  const check = await ssh.execCommand("cloudflared --version 2>&1 || echo 'NOT_INSTALLED'")

  if (check.stdout.includes("NOT_INSTALLED")) {
    logs.push("[cloudflare] Installing cloudflared...")
    const install = await ssh.execCommand(
      "curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb -o /tmp/cloudflared.deb && dpkg -i /tmp/cloudflared.deb && rm /tmp/cloudflared.deb && cloudflared --version 2>&1",
    )
    logs.push(`[cloudflare] Install: ${install.stdout}`)
    if (install.stderr) logs.push(`[cloudflare] Install stderr: ${install.stderr}`)
    if (install.code !== 0) {
      logs.push(`[cloudflare] Install failed: ${install.stderr || install.stdout}`)
      return false
    }
  } else {
    logs.push(`[cloudflare] Already installed: ${check.stdout.trim()}`)
  }
  return true
}

/**
 * Install and run cloudflared as a systemd service using a remotely-managed
 * tunnel run token. This requires NO interactive `cloudflared tunnel login`
 * and NO cert.pem — the token (obtained from the Cloudflare API) is all that
 * is needed. The ingress + DNS are managed remotely via the API.
 */
export async function runCloudflaredWithToken(
  ssh: NodeSSH,
  token: string,
  logs: string[],
): Promise<{ success: boolean; error?: string }> {
  logs.push("[cloudflare] Installing token-based cloudflared service...")

  // Remove any previous (interactive / config-file based) setup so the
  // token-based service starts cleanly.
  await ssh.execCommand("systemctl stop cloudflared 2>&1 || true")
  await ssh.execCommand("cloudflared service uninstall 2>&1 || true")
  await ssh.execCommand("rm -f /etc/cloudflared/config.yml 2>&1 || true")
  await ssh.execCommand("systemctl daemon-reload 2>&1 || true")

  // `cloudflared service install <token>` writes the systemd unit and starts it.
  const install = await ssh.execCommand(`cloudflared service install ${token} 2>&1`)
  logs.push(`[cloudflare] service install: ${(install.stdout + install.stderr).trim().slice(0, 300)}`)

  await ssh.execCommand("systemctl daemon-reload 2>&1 || true")
  await ssh.execCommand("systemctl enable cloudflared 2>&1 || true")
  const start = await ssh.execCommand(
    "systemctl restart cloudflared 2>&1 && sleep 5 && systemctl is-active cloudflared 2>&1",
  )
  const active = start.stdout.includes("active")
  logs.push(`[cloudflare] Service status: ${start.stdout.trim()}`)

  if (!active) {
    const journal = await ssh.execCommand("journalctl -u cloudflared --no-pager -n 30 2>&1 || true")
    for (const line of journal.stdout.split("\n").slice(-15)) {
      if (line.trim()) logs.push(`  ${line.trim()}`)
    }
    return { success: false, error: "cloudflared service failed to become active" }
  }

  return { success: true }
}

export async function checkCloudflaredLogin(ssh: NodeSSH, logs: string[]): Promise<{ loggedIn: boolean; certPath?: string }> {
  logs.push("[cloudflare] Checking existing tunnel authentication...")
  const certCheck = await ssh.execCommand("ls /root/.cloudflared/cert.pem 2>&1 || echo 'NO_CERT'")
  if (!certCheck.stdout.includes("NO_CERT")) {
    logs.push("[cloudflare] Existing cert.pem found — already authenticated")
    return { loggedIn: true, certPath: "/root/.cloudflared/cert.pem" }
  }
  logs.push("[cloudflare] No existing cert found — login required")
  return { loggedIn: false }
}

export async function startCloudflaredLogin(ssh: NodeSSH, logs: string[]): Promise<{ loginUrl: string | null; error?: string }> {
  logs.push("[cloudflare] Starting tunnel login process...")

  // cloudflared tunnel login outputs a URL then blocks waiting for browser auth.
  // Run it in background, capture output to a temp file, then read the URL.
  const runBg = await ssh.execCommand(
    "nohup cloudflared tunnel login > /tmp/cloudflared-login.log 2>&1 & sleep 4 && cat /tmp/cloudflared-login.log 2>&1",
  )

  const combined = runBg.stdout + runBg.stderr
  logs.push(`[cloudflare] Login output: ${combined.slice(0, 500)}`)

  // Try multiple URL patterns
  const urlMatch = combined.match(/https:\/\/[^\s\n]+/)
  if (urlMatch) {
    logs.push(`[cloudflare] Login URL found: ${urlMatch[0]}`)
    return { loginUrl: urlMatch[0] }
  }

  // Check if cert already exists (already logged in previously)
  if (combined.includes("You have an existing certificate") || combined.includes("cert.pem")) {
    logs.push("[cloudflare] Already have a certificate — skipping login")
    return { loginUrl: null }
  }

  // If no URL found, check if the file was written
  const fileCheck = await ssh.execCommand("cat /tmp/cloudflared-login.log 2>&1 || echo 'NO_FILE'")
  logs.push(`[cloudflare] File content: ${fileCheck.stdout.slice(0, 500)}`)
  const fileMatch = fileCheck.stdout.match(/https:\/\/[^\s\n]+/)
  if (fileMatch) {
    return { loginUrl: fileMatch[0] }
  }

  logs.push("[cloudflare] No login URL found in output — trying alternate command")
  // Try alternate: cloudflared login (without 'tunnel')
  const altRun = await ssh.execCommand(
    "nohup cloudflared login > /tmp/cloudflared-login2.log 2>&1 & sleep 3 && cat /tmp/cloudflared-login2.log 2>&1",
  )
  const altMatch = altRun.stdout.match(/https:\/\/[^\s\n]+/)
  if (altMatch) {
    return { loginUrl: altMatch[0] }
  }

  return { loginUrl: null, error: "Could not extract login URL. Check VM manually with: cloudflared tunnel login" }
}

export async function pollCloudflaredCert(ssh: NodeSSH, logs: string[]): Promise<{ ready: boolean }> {
  const certCheck = await ssh.execCommand("test -f /root/.cloudflared/cert.pem && echo 'READY' || echo 'WAITING'")
  const ready = certCheck.stdout.includes("READY")
  if (ready) logs.push("[cloudflare] Authentication certificate found — ready to proceed")
  return { ready }
}

export async function createCloudflaredTunnel(ssh: NodeSSH, logs: string[]): Promise<{ tunnelId: string; credentialsPath: string } | null> {
  logs.push("[cloudflare] Creating named tunnel 'sycord-deployer'...")
  const existing = await ssh.execCommand("cloudflared tunnel list --output json 2>&1 | grep -o '\"id\":\"[^\"]*\"' | head -1 || echo 'NO_TUNNEL'")

  let tunnelId: string
  if (existing.stdout.includes("NO_TUNNEL")) {
    const create = await ssh.execCommand("cloudflared tunnel create sycord-deployer 2>&1")
    logs.push(`[cloudflare] Create output: ${create.stdout}`)
    if (create.stderr) logs.push(`[cloudflare] Create stderr: ${create.stderr}`)

    const idMatch = (create.stdout + create.stderr).match(/Created tunnel\s+\S+\s+with id\s+([a-f0-9-]+)/i) ||
      (create.stdout + create.stderr).match(/"([a-f0-9-]{36})"/)
    if (idMatch) {
      tunnelId = idMatch[1].trim()
    } else {
      logs.push("[cloudflare] Failed to parse tunnel ID from creation output")
      return null
    }
  } else {
    tunnelId = existing.stdout.replace(/"id":"|"/g, "").trim()
    logs.push(`[cloudflare] Existing tunnel found: ${tunnelId}`)
  }

  const credentialsPath = `/root/.cloudflared/${tunnelId}.json`

  const credentialsCheck = await ssh.execCommand(`test -f ${credentialsPath} && echo 'EXISTS' || echo 'MISSING'`)
  if (credentialsCheck.stdout.includes("MISSING")) {
    const list = await ssh.execCommand(`cloudflared tunnel list --output json 2>&1`)
    logs.push(`[cloudflare] Tunnel list: ${list.stdout}`)
    if (list.stdout.includes(tunnelId)) {
      logs.push(`[cloudflare] Credentials should be at ${credentialsPath}`)
    }
  }

  return { tunnelId, credentialsPath }
}

export async function writeCloudflaredConfig(
  ssh: NodeSSH,
  tunnelId: string,
  credentialsPath: string,
  baseDomain: string,
  logs: string[],
): Promise<boolean> {
  logs.push("[cloudflare] Writing cloudflared config...")

  const config = `tunnel: ${tunnelId}
credentials-file: ${credentialsPath}

ingress:
  - hostname: "*.${baseDomain}"
    service: http://127.0.0.1:5050
  - hostname: "${baseDomain}"
    service: http://127.0.0.1:5050
  - service: http_status:404
`

  await ssh.execCommand("mkdir -p /etc/cloudflared")
  const escapedConfig = config.replace(/'/g, "'\\''")
  const writeResult = await ssh.execCommand(`cat > /etc/cloudflared/config.yml << 'CLOUDFLARED_EOF'
${config}
CLOUDFLARED_EOF
echo "CONFIG_WRITTEN"`)

  logs.push(`[cloudflare] Config write: ${writeResult.stdout}`)
  if (writeResult.stderr) logs.push(`[cloudflare] Config stderr: ${writeResult.stderr}`)
  return writeResult.stdout.includes("CONFIG_WRITTEN")
}

export async function installCloudflaredService(ssh: NodeSSH, logs: string[]): Promise<boolean> {
  logs.push("[cloudflare] Installing cloudflared systemd service...")

  // Stop any existing instance first
  await ssh.execCommand("systemctl stop cloudflared 2>&1 || true")

  const result = await ssh.execCommand("cloudflared service install 2>&1")
  logs.push(`[cloudflare] Service install: ${result.stdout}`)
  if (result.stderr) logs.push(`[cloudflare] Service stderr: ${result.stderr}`)

  await ssh.execCommand("systemctl daemon-reload 2>&1")
  await ssh.execCommand("systemctl enable cloudflared 2>&1")
  const start = await ssh.execCommand("systemctl restart cloudflared 2>&1 && sleep 4 && systemctl is-active cloudflared 2>&1")

  const active = start.stdout.includes("active")
  logs.push(`[cloudflare] Service status: ${start.stdout.trim()}`)
  if (!active && start.stderr) logs.push(`[cloudflare] Service error: ${start.stderr}`)

  if (!active) {
    const journal = await ssh.execCommand("journalctl -u cloudflared --no-pager -n 30 2>&1 || true")
    logs.push(`[cloudflare] Journal (last 30):`)
    for (const line of journal.stdout.split("\n").slice(-15)) {
      if (line.trim()) logs.push(`  ${line.trim()}`)
    }
  }

  return active
}

export async function registerCloudflaredWildcardDns(
  ssh: NodeSSH,
  tunnelId: string,
  baseDomain: string,
  logs: string[],
): Promise<{ success: boolean; detail: string }> {
  const wildcard = `*.${baseDomain}`
  const cleanId = tunnelId.trim()
  logs.push(`[cloudflare] Registering wildcard DNS route for ${wildcard} via tunnel ${cleanId.slice(0, 8)}...`)
  const result = await ssh.execCommand(`cloudflared tunnel route dns ${cleanId} ${wildcard} 2>&1`)
  const out = result.stdout + result.stderr
  logs.push(`[cloudflare] Wildcard DNS: ${out.trim().slice(0, 300)}`)

  const ok = result.code === 0 || out.includes("added") || out.includes("already exists") || out.includes("SUCCESS")
  return { success: ok, detail: out.trim().slice(0, 200) }
}

export async function resetCloudflaredTunnel(
  ssh: NodeSSH,
  baseDomain: string,
  logs: string[],
): Promise<{ success: boolean; tunnelId?: string; credentialsPath?: string; error?: string }> {
  logs.push("[cloudflare] === RESETTING CLOUDFLARE TUNNEL ===")

  // Stop and disable service
  await ssh.execCommand("systemctl stop cloudflared 2>&1 || true")
  await ssh.execCommand("systemctl disable cloudflared 2>&1 || true")

  // Delete existing tunnel
  const listResult = await ssh.execCommand("cloudflared tunnel list --output json 2>&1 || echo '[]'")
  try {
    const tunnels = JSON.parse(listResult.stdout)
    if (Array.isArray(tunnels)) {
      for (const t of tunnels) {
        const tid = t.id || t.name
        if (tid) {
          logs.push(`[cloudflare] Deleting tunnel: ${tid}`)
          await ssh.execCommand(`cloudflared tunnel delete -f ${tid} 2>&1 || true`)
        }
      }
    }
  } catch {
    logs.push("[cloudflare] Could not parse tunnel list, trying force cleanup")
    await ssh.execCommand("cloudflared tunnel cleanup 2>&1 || true")
  }

  // Clean up configs and credentials
  await ssh.execCommand("rm -f /etc/cloudflared/config.yml 2>&1 || true")
  await ssh.execCommand("rm -f /root/.cloudflared/*.json 2>&1 || true")
  await ssh.execCommand("rm -f /root/.cloudflared/cert.pem 2>&1 || true")

  // Uninstall service
  await ssh.execCommand("cloudflared service uninstall 2>&1 || true")
  await ssh.execCommand("systemctl daemon-reload 2>&1 || true")

  logs.push("[cloudflare] Tunnel fully reset — starting fresh setup")

  // Re-install cloudflared
  const installed = await installCloudflared(ssh, logs)
  if (!installed) {
    return { success: false, error: "Cloudflared re-install failed" }
  }

  // The user needs to re-authenticate (login)
  const { loggedIn } = await checkCloudflaredLogin(ssh, logs)
  if (!loggedIn) {
    return { success: false, error: "Cloudflare login required after reset — run Setup Deployer to authenticate" }
  }

  // Create new tunnel
  const tunnel = await createCloudflaredTunnel(ssh, logs)
  if (!tunnel) {
    return { success: false, error: "Failed to create new tunnel" }
  }

  // Write config
  const configOk = await writeCloudflaredConfig(ssh, tunnel.tunnelId, tunnel.credentialsPath, baseDomain, logs)
  if (!configOk) {
    return { success: false, error: "Failed to write config" }
  }

  // Register wildcard DNS
  const dnsResult = await registerCloudflaredWildcardDns(ssh, tunnel.tunnelId, baseDomain, logs)
  logs.push(`[cloudflare] DNS registration: ${dnsResult.success ? "ok" : "failed"} — ${dnsResult.detail}`)

  // Install and start service
  const serviceOk = await installCloudflaredService(ssh, logs)
  if (!serviceOk) {
    return { success: false, error: "Service start failed after reset" }
  }

  return { success: true, tunnelId: tunnel.tunnelId, credentialsPath: tunnel.credentialsPath }
}

export async function getTunnelStatus(ssh: NodeSSH, logs: string[]): Promise<{ running: boolean; info: string }> {
  const status = await ssh.execCommand("systemctl is-active cloudflared 2>&1 || echo 'inactive'")
  const info = await ssh.execCommand("cloudflared tunnel info sycord-deployer 2>&1 || echo 'no-info'")
  logs.push(`[cloudflare] Status: ${status.stdout.trim()}, Info: ${info.stdout.trim()}`)
  return {
    running: status.stdout.includes("active"),
    info: info.stdout.trim(),
  }
}

export async function saveTunnelStateToDb(
  host: string,
  baseDomain: string,
  tunnelId: string,
  credentialsPath?: string,
): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db()
    await db.collection("deployer_config").updateOne(
      { key: "cloudflare_tunnel" },
      {
        $set: {
          host,
          baseDomain,
          tunnelId,
          credentialsPath: credentialsPath || null,
          mode: "api",
          configured: true,
          configuredAt: new Date(),
        },
      },
      { upsert: true },
    )
  } catch (err: any) {
    console.error("[cloudflare] Failed to save tunnel state:", err?.message)
  }
}

export async function getTunnelStateFromDb(): Promise<{
  configured: boolean
  tunnelId?: string
  credentialsPath?: string
  baseDomain?: string
  host?: string
  mode?: string
  configuredAt?: Date
} | null> {
  try {
    const client = await clientPromise
    const db = client.db()
    return db.collection("deployer_config").findOne({ key: "cloudflare_tunnel" }) as any
  } catch {
    return null
  }
}

export async function bootstrapDeployVmRunner(input?: VmSetupInput): Promise<VmSetupResult> {
  const localRunnerDir = path.join(process.cwd(), "vm-runner")
  const remoteRunnerDir = "/srv/sycord/vm-runner"
  const runnerToken = input?.runnerToken || process.env.VPS_RUNNER_TOKEN || generateRunnerToken()
  const baseDomain = input?.baseDomain || "sycord.site"
  const host = input?.host || process.env.VPS_SSH_HOST || ""

  return withRootSsh(async (ssh) => {
    const steps: string[] = []
    let phase = "prepare"
    let errorMsg: string | null = null

    const emit = (text: string) => {
      steps.push(text)
    }

    const prep = await ssh.execCommand(
      [
        "set -e",
        "mkdir -p /srv/sycord/sites /srv/sycord/logs /srv/sycord/env /srv/sycord/runner",
        "chmod 700 /srv/sycord/env",
        "mkdir -p /srv/sycord/vm-runner",
      ].join(" && "),
    )
    emit(prep.stdout)
    emit(prep.stderr)
    if (prep.code !== 0) {
      errorMsg = `Failed to create directories (exit ${prep.code}): ${prep.stderr || prep.stdout}`
      return { success: false, phase, error: errorMsg, logs: steps.filter(Boolean).join("\n").trim() }
    }

    phase = "upload"
    emit(`Uploading vm-runner/ to ${remoteRunnerDir}...`)
    try {
      await ssh.putDirectory(localRunnerDir, remoteRunnerDir, {
        recursive: true,
        concurrency: 4,
        validate: (itemPath) => !/node_modules|dist|\.git|package-lock/.test(itemPath),
      })
      emit("Uploaded vm-runner files successfully")
    } catch (err: any) {
      errorMsg = `SCP upload failed: ${err?.message || "Unknown error"}`
      emit(errorMsg)
      return { success: false, phase, error: errorMsg, logs: steps.filter(Boolean).join("\n").trim() }
    }

    phase = "setup-script"
    emit("Running setup-ubuntu.sh...")
    const setupResult = await ssh.execCommand(
      [
        "set -e",
        `cd ${remoteRunnerDir}`,
        "chmod +x scripts/setup-ubuntu.sh",
        "bash scripts/setup-ubuntu.sh 2>&1",
      ].join(" && "),
      { cwd: remoteRunnerDir },
    )
    emit(setupResult.stdout)
    emit(setupResult.stderr)
    if (setupResult.code !== 0) {
      errorMsg = `setup-ubuntu.sh failed (exit ${setupResult.code})`
      emit(errorMsg)
      return { success: false, phase, error: errorMsg, logs: steps.filter(Boolean).join("\n").trim() }
    }

    phase = "install-service"
    emit("Running install-service.sh (npm install, tsc build, systemd)...")
    emit(`Using runner token: ${runnerToken.slice(0, 8)}...`)
    emit(`Using base domain: ${baseDomain}`)
    const installResult = await ssh.execCommand(
      [
        "set -e",
        `cd ${remoteRunnerDir}`,
        "chmod +x scripts/install-service.sh",
        `VPS_RUNNER_TOKEN="${runnerToken}" SYCORD_BASE_DOMAIN="${baseDomain}" bash scripts/install-service.sh 2>&1`,
      ].join(" && "),
      { cwd: remoteRunnerDir },
    )
    emit(installResult.stdout)
    emit(installResult.stderr)
    if (installResult.code !== 0) {
      errorMsg = `install-service.sh failed (exit ${installResult.code})`
      emit(errorMsg)
      return { success: false, phase, error: errorMsg, logs: steps.filter(Boolean).join("\n").trim() }
    }

    phase = "start-service"
    emit("Starting sycord-vm-runner service...")
    const startResult = await ssh.execCommand("systemctl restart sycord-vm-runner 2>&1 && sleep 2 && systemctl is-active sycord-vm-runner 2>&1")
    emit(startResult.stdout)
    emit(startResult.stderr)
    if (!startResult.stdout.includes("active")) {
      const journal = await ssh.execCommand("journalctl -u sycord-vm-runner --no-pager -n 30 2>&1 || true")
      emit(journal.stdout)
      emit(journal.stderr)
      errorMsg = `Runner service failed to start: ${startResult.stdout.trim() || startResult.stderr.trim()}`
      return { success: false, phase, error: errorMsg, logs: steps.filter(Boolean).join("\n").trim() }
    }

    phase = "verify"
    emit("Verifying runner is listening on port 5051...")
    const verify = await ssh.execCommand("ss -ltnp | grep ':5051 ' || true")
    emit(verify.stdout)
    emit(verify.stderr)

    const success = Boolean(verify.stdout.trim())
    const runnerUrl = `http://${host}:5051`
    
    return {
      success,
      phase,
      error: success ? null : "Runner process not found on port 5051 after start",
      logs: steps.filter(Boolean).join("\n").trim(),
      runnerUrl: success ? runnerUrl : undefined,
      runnerToken: success ? runnerToken : undefined,
      baseDomain: success ? baseDomain : undefined,
    }
  }, input)
}
