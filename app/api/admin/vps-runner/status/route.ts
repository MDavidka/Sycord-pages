import { NextResponse } from "next/server"
import { probeDeployVmSsh } from "@/lib/admin/vm-ssh"
import { proxyRunner, requireAdminResponse } from "../_shared"

export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const upstream = await proxyRunner("/api/status")
  if (upstream.status !== 503) {
    return upstream
  }

  const ssh = await probeDeployVmSsh()
  if (ssh.reachable) {
    return NextResponse.json(
      {
        success: true,
        online: true,
        degraded: true,
        warning: "Runner API offline, but deploy VM is reachable over root SSH",
        tunnel: { ok: false, status: "unknown" },
        proxy: { ok: false, status: "unknown" },
        cpu: null,
        mem: { percent: null },
        disk: { percent: null },
        debug: {
          sshReachable: true,
          sshError: ssh.error,
          bootstrapAvailable: true,
        },
      },
      { status: 200 },
    )
  }

  return NextResponse.json(
    {
      success: false,
      online: false,
      error: "Runner API and deploy VM SSH are unavailable",
      debug: {
        sshReachable: false,
        sshError: ssh.error,
      },
    },
    { status: 503 },
  )
}
