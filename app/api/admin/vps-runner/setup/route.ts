import { NextResponse } from "next/server"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { assertAdmin, proxyRunner } from "../_shared"

const execAsync = promisify(exec)

async function runRootSetupOverSsh() {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const port = process.env.VPS_SSH_PORT || "22"

  if (!host || !password) {
    throw new Error("Missing VPS_SSH_HOST or VPS_SSH_ROOT_PASSWORD env values")
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

  const cmd = `sshpass -p '${password.replace(/'/g, "'\\''")}' ssh -o StrictHostKeyChecking=no -p ${port} root@${host} \"${remoteScript.replace(/\"/g, '\\\"')}\"`
  const { stdout, stderr } = await execAsync(cmd, { timeout: 120000, maxBuffer: 1024 * 1024 })
  return `${stdout}\n${stderr}`.trim()
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
