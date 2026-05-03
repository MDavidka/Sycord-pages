import { NextResponse } from "next/server"
import { execFile } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { assertAdmin, proxyRunner } from "../_shared"

const execFileAsync = promisify(execFile)

async function runRootSetupOverSsh() {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const port = process.env.VPS_SSH_PORT || "22"

  if (!host || !password) throw new Error("Missing VPS_SSH_HOST or VPS_SSH_ROOT_PASSWORD")

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
  const args = [
    "-p",
    password,
    "ssh",
    "-o",
    "StrictHostKeyChecking=no",
    "-p",
    port,
    sshCmd,
    remoteScript,
  ]

  const { stdout, stderr } = await execFileAsync("sshpass", args, { timeout: 120000, maxBuffer: 1024 * 1024 })
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
