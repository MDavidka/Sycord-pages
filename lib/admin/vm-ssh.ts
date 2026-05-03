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
    const port80Process = port80Pid ? await ssh.execCommand(`ps -p ${port80Pid} -o pid=,ppid=,comm=,args= || true`) : { stdout: "", stderr: "" }
    const port80Exe = port80Pid ? await ssh.execCommand(`readlink -f /proc/${port80Pid}/exe || true`) : { stdout: "", stderr: "" }
    const port80Service = port80Pid ? await ssh.execCommand(`grep -oE '[^/[:space:]]+\\.service' /proc/${port80Pid}/cgroup | head -n1 || true`) : { stdout: "", stderr: "" }

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
    const diagnostics = await readDeployVmDiagnostics()

    return {
      success:
        action === "stop"
          ? !diagnostics.runner.running
          : diagnostics.runner.running,
      action,
      logs: [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
      diagnostics,
    }
  })
}

export async function bootstrapDeployVmRunner() {
  const localRunnerDir = path.join(process.cwd(), "vm-runner")
  const remoteRunnerDir = "/srv/sycord/vm-runner"

  return withRootSsh(async (ssh) => {
    const steps: string[] = []
    let phase = "prepare"

    const prep = await ssh.execCommand(
      [
        "set -e",
        "mkdir -p /srv/sycord/sites /srv/sycord/logs /srv/sycord/env /srv/sycord/runner",
        "chmod 700 /srv/sycord/env",
        "mkdir -p /srv/sycord/vm-runner",
      ].join(" && "),
    )
    steps.push(prep.stdout, prep.stderr)
    if (prep.code !== 0) {
      return {
        success: false,
        phase,
        logs: steps.filter(Boolean).join("\n").trim(),
      }
    }

    phase = "upload"
    await ssh.putDirectory(localRunnerDir, remoteRunnerDir, {
      recursive: true,
      concurrency: 4,
      validate: (itemPath) => !/node_modules|dist|\.git/.test(itemPath),
    })

    phase = "install"
    const install = await ssh.execCommand(
      [
        "set -e",
        `cd ${remoteRunnerDir}`,
        "chmod +x scripts/*.sh",
        "bash scripts/setup-ubuntu.sh",
        "bash scripts/install-service.sh",
        "systemctl restart sycord-vm-runner",
        "systemctl is-active sycord-vm-runner",
      ].join(" && "),
      { cwd: remoteRunnerDir },
    )
    steps.push(install.stdout, install.stderr)

    phase = "verify"
    const verify = await ssh.execCommand("systemctl is-active sycord-vm-runner && ss -ltnp | grep ':5050 ' || true")
    steps.push(verify.stdout, verify.stderr)

    return {
      success: install.code === 0,
      phase,
      logs: steps.filter(Boolean).join("\n").trim(),
    }
  })
}
