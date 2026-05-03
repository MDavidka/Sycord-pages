import { NextResponse } from "next/server"
import { exec } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { assertAdmin, proxyRunner } from "../_shared"

const execAsync = promisify(exec)

async function runRootSetupOverSsh() {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const privateKey = process.env.VPS_SSH_PRIVATE_KEY
  const port = process.env.VPS_SSH_PORT || "22"

  if (!host) {
    throw new Error("Missing VPS_SSH_HOST env value")
  }

  const remoteScript = [
    "set -e",
    "pkill -f 'python3.*runner.py' || true",
    "pkill -f 'flask' || true",
    "pkill -f 'gunicorn' || true",
    "rm -f /srv/sycord/runner.py /srv/sycord/app.py || true",
    "mkdir -p /srv/sycord/vm-runner",
    "cd /srv/sycord/vm-runner",
    "if [ ! -f package.json ]; then echo '{\"name\":\"sycord-vm-runner\",\"private\":true}' > package.json; fi",
    "echo 'Legacy Flask scripts destroyed. VM runner folder prepared.'"
  ].join(" && ")

  const sshCheck = await execAsync("command -v sshpass || true")
  const hasSshpass = sshCheck.stdout.trim().length > 0

  if (hasSshpass && password) {
    const cmd = `sshpass -p '${password.replace(/'/g, "'\\''")}' ssh -o StrictHostKeyChecking=no -p ${port} root@${host} "${remoteScript.replace(/\"/g, '\\\"')}"`
    const { stdout, stderr } = await execAsync(cmd, { timeout: 120000, maxBuffer: 1024 * 1024 })
    return `${stdout}
${stderr}`.trim()
  }

  if (privateKey) {
    const keyPath = path.join(process.cwd(), ".tmp-runner-ssh-key")
    await fs.writeFile(keyPath, privateKey.replace(/\n/g, "
"), { mode: 0o600 })
    try {
      const cmd = `ssh -i ${keyPath} -o StrictHostKeyChecking=no -p ${port} root@${host} "${remoteScript.replace(/\"/g, '\\\"')}"`
      const { stdout, stderr } = await execAsync(cmd, { timeout: 120000, maxBuffer: 1024 * 1024 })
      return `${stdout}
${stderr}`.trim()
    } finally {
      await fs.unlink(keyPath).catch(() => {})
    }
  }

  throw new Error("SSH setup unavailable: sshpass is not installed and VPS_SSH_PRIVATE_KEY is missing. Add VPS_SSH_PRIVATE_KEY (recommended) or provide sshpass in runtime.")
}

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return proxyRunner("/api/setup/status")
}

export async function POST() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const upstream = await proxyRunner("/api/setup", { method: "POST" })
  if (upstream.status !== 503) return upstream

  try {
    const logs = await runRootSetupOverSsh()
    const statePath = path.join(process.cwd(), ".runner-setup-state.json")
    await fs.writeFile(statePath, JSON.stringify({ setupComplete: true, setupAt: new Date().toISOString(), logs: logs.slice(-4000) }, null, 2))
    return NextResponse.json({
      success: true,
      setupComplete: true,
      message: "Root SSH setup completed. Legacy Flask processes/scripts removed and runner directory prepared.",
      logs,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: "Runner setup failed over root SSH",
      details: error?.message || "unknown error",
    }, { status: 500 })
  }
}
