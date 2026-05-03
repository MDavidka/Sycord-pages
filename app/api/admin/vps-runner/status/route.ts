import { NextResponse } from "next/server"
import { exec } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"
import { promisify } from "node:util"
import { assertAdmin, proxyRunner } from "../_shared"

const execAsync = promisify(exec)

async function checkVmReachable() {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const privateKey = process.env.VPS_SSH_PRIVATE_KEY
  const port = process.env.VPS_SSH_PORT || "22"
  if (!host) return { reachable: false, error: "Missing VPS_SSH_HOST" }

  try {
    const check = await execAsync("command -v sshpass || true")
    if (check.stdout.trim() && password) {
      await execAsync(`sshpass -p '${password.replace(/'/g, "'\\''")}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p ${port} root@${host} 'echo ok'`)
      return { reachable: true, error: null }
    }

    if (privateKey) {
      const keyPath = path.join(process.cwd(), ".tmp-runner-ssh-key")
      await fs.writeFile(keyPath, privateKey.replace(/\n/g, "
"), { mode: 0o600 })
      try {
        await execAsync(`ssh -i ${keyPath} -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p ${port} root@${host} 'echo ok'`)
      } finally {
        await fs.unlink(keyPath).catch(() => {})
      }
      return { reachable: true, error: null }
    }

    return { reachable: false, error: "sshpass not installed and VPS_SSH_PRIVATE_KEY missing" }
  } catch (error: any) {
    return { reachable: false, error: error?.stderr || error?.message || "SSH check failed" }
  }
}

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const upstream = await proxyRunner("/api/status")
  if (upstream.status !== 503) return upstream

  const sshProbe = await checkVmReachable()
  const reachable = sshProbe.reachable

  let cachedSetup: any = null
  try {
    const raw = await fs.readFile(path.join(process.cwd(), ".runner-setup-state.json"), "utf8")
    cachedSetup = JSON.parse(raw)
  } catch {}

  const recentlySetup = Boolean(cachedSetup?.setupComplete && cachedSetup?.setupAt)

  return NextResponse.json({
    success: reachable || recentlySetup,
    online: reachable || recentlySetup,
    degraded: !reachable && recentlySetup,
    warning: reachable
      ? "Runner API is offline, but VM is reachable via SSH."
      : recentlySetup
        ? "Runner API/SSH checks failed, but setup completed recently. Marking as online (degraded) for debugging."
        : "VM is offline or SSH is unreachable.",
    debug: {
      sshReachable: reachable,
      sshError: sshProbe.error,
      hasCachedSetupState: Boolean(cachedSetup),
      setupAt: cachedSetup?.setupAt || null,
    },
  }, { status: reachable || recentlySetup ? 200 : 503 })
}
