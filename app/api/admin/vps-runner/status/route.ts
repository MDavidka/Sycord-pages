import { NextResponse } from "next/server"
import { exec } from "node:child_process"
import { promisify } from "node:util"
import { assertAdmin, proxyRunner } from "../_shared"

const execAsync = promisify(exec)

async function checkVmReachable() {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const port = process.env.VPS_SSH_PORT || "22"
  if (!host || !password) return false
  try {
    await execAsync(`sshpass -p '${password.replace(/'/g, "'\\''")}' ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 -p ${port} root@${host} 'echo ok'`)
    return true
  } catch {
    return false
  }
}

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const upstream = await proxyRunner("/api/status")
  if (upstream.status !== 503) return upstream

  const reachable = await checkVmReachable()
  return NextResponse.json({
    success: reachable,
    online: reachable,
    warning: reachable ? "Runner API is offline, but VM is reachable via SSH." : "VM is offline or SSH is unreachable.",
  }, { status: reachable ? 200 : 503 })
}
