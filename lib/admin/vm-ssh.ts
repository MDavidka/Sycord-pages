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
