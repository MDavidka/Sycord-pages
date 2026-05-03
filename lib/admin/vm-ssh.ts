import path from "node:path"
import { NodeSSH } from "node-ssh"

type SshConfig = {
  host: string
  password: string
  port: number
  username: string
}

function getSshConfig(): SshConfig {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const port = Number(process.env.VPS_SSH_PORT || "22")

  if (!host || !password) {
    throw new Error("Missing VPS_SSH_HOST or VPS_SSH_ROOT_PASSWORD")
  }

  return {
    host,
    password,
    port,
    username: "root",
  }
}

async function withRootSsh<T>(fn: (ssh: NodeSSH) => Promise<T>) {
  const ssh = new NodeSSH()
  try {
    await ssh.connect(getSshConfig())
    return await fn(ssh)
  } finally {
    ssh.dispose()
  }
}

export async function probeDeployVmSsh() {
  try {
    const result = await withRootSsh(async (ssh) => ssh.execCommand("echo connected"))
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

export async function readDeployVmDiagnostics() {
  return withRootSsh(async (ssh) => {
    const port80 = await ssh.execCommand("ss -ltnp | grep ':80' || true")
    const port5050 = await ssh.execCommand("ss -ltnp | grep ':5050' || true")
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
        running: Boolean(port5050.stdout.trim()),
        port: 5050,
        portOwner: port5050.stdout.trim() || null,
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
  })
}

export async function manageDeployVmRunnerService(action: "start" | "stop" | "restart" | "status") {
  return withRootSsh(async (ssh) => {
    const command =
      action === "status"
        ? "systemctl status sycord-vm-runner --no-pager || true"
        : `systemctl ${action} sycord-vm-runner && systemctl status sycord-vm-runner --no-pager || true`

    const result = await ssh.execCommand(command)
    const runnerSocket = await ssh.execCommand("ss -ltnp | grep ':5050' || true")
    const nginxSocket = await ssh.execCommand("ss -ltnp | grep ':80' || true")
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
  })
}

export async function bootstrapDeployVmRunner() {
  const localRunnerDir = path.join(process.cwd(), "vm-runner")
  const remoteRunnerDir = "/srv/sycord/vm-runner"

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
    const installResult = await ssh.execCommand(
      [
        "set -e",
        `cd ${remoteRunnerDir}`,
        "chmod +x scripts/install-service.sh",
        "bash scripts/install-service.sh 2>&1",
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
    emit("Verifying runner is listening on port 5050...")
    const verify = await ssh.execCommand("ss -ltnp | grep ':5050 ' || true")
    emit(verify.stdout)
    emit(verify.stderr)

    const success = Boolean(verify.stdout.trim())
    return {
      success,
      phase,
      error: success ? null : "Runner process not found on port 5050 after start",
      logs: steps.filter(Boolean).join("\n").trim(),
    }
  })
}
