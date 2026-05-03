import os from "node:os"
import { promises as fs } from "node:fs"
import { config } from "./config.js"
import { ensureBaseDirectories } from "./logs.js"
import { runCommand } from "./processes.js"

type ServiceDiagnostics = {
  installed: boolean
  running: boolean
  enabled?: boolean
  status: "online" | "offline"
}

async function commandOutput(command: string, args: string[]) {
  const result = await runCommand(command, args)
  return {
    ok: result.code === 0,
    stdout: result.stdout.join("\n").trim(),
    stderr: result.stderr.join("\n").trim(),
  }
}

async function checkSystemdService(service: string): Promise<ServiceDiagnostics> {
  const active = await commandOutput("systemctl", ["is-active", service])
  const enabled = await commandOutput("systemctl", ["is-enabled", service])
  const present = await commandOutput("systemctl", ["status", service, "--no-pager"])

  return {
    installed: present.ok || !/could not be found/i.test(`${present.stdout}\n${present.stderr}`),
    running: active.ok,
    enabled: enabled.ok,
    status: active.ok ? "online" : "offline",
  }
}

async function checkProcessRunning(pattern: string) {
  const result = await commandOutput("bash", ["-lc", `pgrep -af '${pattern}' || true`])
  return {
    running: Boolean(result.stdout),
    processes: result.stdout ? result.stdout.split("\n").filter(Boolean) : [],
  }
}

async function diskUsage() {
  const result = await runCommand("bash", ["-lc", `df -h ${config.sitesDir} | tail -1 | awk '{print $5}'`])
  return result.stdout.join("").trim() || null
}

async function portListenerDetails(port: number) {
  const ss = await commandOutput("bash", ["-lc", `ss -ltnp | grep ':${port}\\b' || true`])
  const lsof = await commandOutput("bash", ["-lc", `lsof -nP -iTCP:${port} -sTCP:LISTEN || true`])
  const pidMatch = ss.stdout.match(/pid=(\d+)/)
  const pid = pidMatch ? Number(pidMatch[1]) : null
  const process = pid
    ? await commandOutput("bash", ["-lc", `ps -p ${pid} -o pid=,ppid=,comm=,args= || true`])
    : { ok: false, stdout: "", stderr: "" }
  const executable = pid
    ? await commandOutput("bash", ["-lc", `readlink -f /proc/${pid}/exe || true`])
    : { ok: false, stdout: "", stderr: "" }
  const service = pid
    ? await commandOutput("bash", ["-lc", `grep -oE '[^/[:space:]]+\\.service' /proc/${pid}/cgroup | head -n1 || true`])
    : { ok: false, stdout: "", stderr: "" }
  const owner = [ss.stdout, lsof.stdout, service.stdout && `service=${service.stdout}`, executable.stdout && `exe=${executable.stdout}`, process.stdout && `process=${process.stdout}`]
    .filter(Boolean)
    .join("\n")
    .trim()
  return {
    listening: Boolean(owner),
    owner: owner || null,
    pid,
    service: service.stdout || null,
    executable: executable.stdout || null,
    process: process.stdout || null,
    ss: ss.stdout || null,
    lsof: lsof.stdout || null,
  }
}

async function relatedServices() {
  const result = await commandOutput(
    "bash",
    ["-lc", "systemctl list-units --type=service --all | grep -Ei 'flask|python|runner|sycord|server|nginx|caddy|cloudflared' || true"],
  )
  return result.stdout ? result.stdout.split("\n").filter(Boolean) : []
}

export async function getSetupStatus() {
  await ensureBaseDirectories()
  let stateExists = false
  try {
    await fs.access(config.stateFile)
    stateExists = true
  } catch {}

  const nginxService = await checkSystemdService("nginx")
  const cloudflaredService = await checkSystemdService("cloudflared")
  const cloudflaredProcess = await checkProcessRunning("cloudflared")
  const runnerListener = await portListenerDetails(config.port)
  const port80 = await portListenerDetails(80)
  const port80Owner = port80.owner
  const port80Available = !port80.listening || Boolean(port80.service?.includes("nginx.service")) || Boolean(port80.process?.includes("nginx"))

  const nginx = {
    installed: nginxService.installed,
    running: nginxService.running,
    enabled: nginxService.enabled,
    status: nginxService.status,
    port80Available,
    port80Owner,
    error: port80Available ? null : "Port 80 already in use",
  }

  const runner = {
    installed: true,
    running: runnerListener.listening,
    status: runnerListener.listening ? "online" : "offline",
    port: config.port,
    portOwner: runnerListener.owner,
  }

  return {
    success: nginx.running && runner.running,
    online: runner.running,
    apiOnline: true,
    setupComplete: stateExists,
    setup: {
      sitesDirReady: true,
      envDirReady: true,
      stateFileReady: stateExists,
    },
    nginx,
    tunnel: {
      ...cloudflaredService,
      ok: cloudflaredService.running || cloudflaredProcess.running,
      status: cloudflaredService.running || cloudflaredProcess.running ? "online" : "offline",
    },
    cloudflared: {
      ...cloudflaredService,
      ok: cloudflaredService.running || cloudflaredProcess.running,
      running: cloudflaredService.running || cloudflaredProcess.running,
      processes: cloudflaredProcess.processes,
    },
    proxy: {
      ok: nginx.running,
      status: nginx.status,
    },
    runner,
    cpu: Math.round(os.loadavg()[0] * 100) / 100,
    mem: {
      total: os.totalmem(),
      free: os.freemem(),
      percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    },
    disk: {
      percent: await diskUsage(),
    },
    diagnostics: {
      port80,
      runnerPort: runnerListener,
      cloudflaredProcesses: cloudflaredProcess.processes,
      relatedServices: await relatedServices(),
    },
    warning: nginx.error
      ? "Port 80 is already in use. Nginx cannot start. Cloudflare Tunnel may be routing to the wrong service."
      : null,
  }
}

export async function runSetup() {
  await ensureBaseDirectories()
  await fs.writeFile(config.stateFile, JSON.stringify({ websites: {} }, null, 2), { flag: "a+" })

  const result = await runCommand("bash", [config.setupScriptPath], {
    env: {
      ...process.env,
      SYCORD_AUTO_FIX_PORT_80: "1",
    },
  })

  const logs = [...result.stdout, ...result.stderr].join("\n").trim()
  const status = await getSetupStatus()

  return {
    success: result.code === 0 && status.nginx.running,
    phase: result.code === 0 ? "complete" : "nginx-port-80",
    logs,
    ...status,
    error: result.code === 0 ? null : status.nginx.error || "Setup failed",
  }
}
