import { NextResponse } from "next/server"
import { probeDeployVmSsh, readDeployVmDiagnostics } from "@/lib/admin/vm-ssh"
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
    const diagnostics = await readDeployVmDiagnostics().catch(() => null)
    return NextResponse.json(
      {
        success: true,
        online: true,
        apiOnline: false,
        degraded: true,
        warning: "Runner API offline, but deploy VM is reachable over root SSH",
        tunnel: { ok: diagnostics?.cloudflared?.running ?? false, status: diagnostics?.cloudflared?.running ? "online" : "offline" },
        proxy: { ok: diagnostics?.nginx?.running ?? false, status: diagnostics?.nginx?.running ? "online" : "offline" },
        nginx: diagnostics?.nginx ?? null,
        runner: diagnostics?.runner ?? { running: false, port: 5050 },
        cloudflared: diagnostics?.cloudflared ?? { running: false },
        cpu: null,
        mem: { percent: null },
        disk: { percent: null },
        diagnostics: diagnostics?.diagnostics ?? null,
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
      apiOnline: false,
      error: "Runner API and deploy VM SSH are unavailable",
      debug: {
        sshReachable: false,
        sshError: ssh.error,
      },
    },
    { status: 503 },
  )
}
