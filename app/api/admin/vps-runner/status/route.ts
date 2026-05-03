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

async function checkVmReachable() {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const privateKey = process.env.VPS_SSH_PRIVATE_KEY
  const port = process.env.VPS_SSH_PORT || "22"
  if (!host || (!password && !privateKey)) return { reachable: false, error: "Missing VPS_SSH_HOST and auth (password or private key)" }

  try {
    const target = `root@${host}`
    if (password && await commandExists("sshpass")) {
      const args = ["-p", password, "ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=5", "-p", port, target, "echo ok"]
      await execFileAsync("sshpass", args, { timeout: 15000 })
    } else if (privateKey) {
      const keyPath = path.join(process.cwd(), ".tmp-runner-ssh-key")
      await fs.writeFile(keyPath, privateKey.replace(/\\n/g, "\n"), { mode: 0o600 })
      try {
        await execFileAsync("ssh", ["-i", keyPath, "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=5", "-p", port, target, "echo ok"], { timeout: 15000 })
      } finally {
        await fs.rm(keyPath, { force: true })
      }
    } else {
      throw new Error("sshpass is not installed on server and VPS_SSH_PRIVATE_KEY is not configured")
    }
    return { reachable: true, error: null }
  } catch (error: any) {
    return { reachable: false, error: error?.message || "SSH probe failed" }
  }
}

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const upstream = await proxyRunner("/api/status")
  if (upstream.status !== 503) return upstream

  const sshProbe = await checkVmReachable()

  let cachedSetup: any = null
  try {
    cachedSetup = JSON.parse(await fs.readFile(path.join(process.cwd(), ".runner-setup-state.json"), "utf8"))
  } catch {}

  const recentlySetup = Boolean(cachedSetup?.setupComplete)
  const online = sshProbe.reachable || recentlySetup

  return NextResponse.json({
    success: online,
    online,
    degraded: !sshProbe.reachable && recentlySetup,
    warning: sshProbe.reachable ? "Runner API offline but VM reachable" : "Runner API and SSH probe failed",
    debug: { sshReachable: sshProbe.reachable, sshError: sshProbe.error, setupAt: cachedSetup?.setupAt || null },
  }, { status: online ? 200 : 503 })
}
