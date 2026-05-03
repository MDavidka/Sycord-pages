import { NextResponse } from "next/server"
import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { assertAdmin, proxyRunner } from "../_shared"

const execFileAsync = promisify(execFile)

async function commandExists(cmd: string) {
  try {
    await execFileAsync("bash", ["-lc", `command -v ${cmd}`])
    return true
  } catch {
    return false
  }
}

async function runRootSetupOverSsh() {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const privateKey = process.env.VPS_SSH_PRIVATE_KEY
  const port = process.env.VPS_SSH_PORT || "22"

  if (!host || (!password && !privateKey)) throw new Error("Missing VPS_SSH_HOST and auth (VPS_SSH_ROOT_PASSWORD or VPS_SSH_PRIVATE_KEY)")

  const remoteScript = [
    "set -e",
    "pkill -f 'python3.*runner.py' || true",
    "pkill -f flask || true",
    "pkill -f gunicorn || true",
    "rm -f /srv/sycord/runner.py /srv/sycord/app.py || true",
    "mkdir -p /srv/sycord/vm-runner",
    "echo 'runner setup complete'",
  ].join(" && ")

  const sshCmd = `root@${host}`
  let stdout = ""
  let stderr = ""

  if (password && await commandExists("sshpass")) {
    const args = ["-p", password, "ssh", "-o", "StrictHostKeyChecking=no", "-p", port, sshCmd, remoteScript]
    const out = await execFileAsync("sshpass", args, { timeout: 120000, maxBuffer: 1024 * 1024 })
    stdout = out.stdout
    stderr = out.stderr
  } else if (privateKey) {
    const keyPath = path.join(process.cwd(), ".tmp-runner-ssh-key")
    await fs.writeFile(keyPath, privateKey.replace(/\\n/g, "\n"), { mode: 0o600 })
    try {
      const out = await execFileAsync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=no", "-p", port, sshCmd, remoteScript], { timeout: 120000, maxBuffer: 1024 * 1024 })
      stdout = out.stdout
      stderr = out.stderr
    } finally {
      await fs.rm(keyPath, { force: true })
    }
  } else {
    throw new Error("sshpass is not installed on server and VPS_SSH_PRIVATE_KEY is not configured")
  }
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
    await fs.writeFile(path.join(process.cwd(), ".runner-setup-state.json"), JSON.stringify({ setupComplete: true, setupAt: new Date().toISOString(), logs: logs.slice(-4000) }, null, 2))
    return NextResponse.json({ success: true, message: "SSH fallback setup completed", logs })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Runner setup failed", details: error?.message || "unknown error" }, { status: 500 })
  }
}
