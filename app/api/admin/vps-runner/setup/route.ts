import { NextResponse } from "next/server"
import { bootstrapDeployVmRunner, probeDeployVmSsh, readDeployVmDiagnostics } from "@/lib/admin/vm-ssh"
import { proxyRunner, requireAdminResponse } from "../_shared"

export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const upstream = await proxyRunner("/api/setup/status")
  if (upstream.status !== 503) {
    return upstream
  }

  const ssh = await probeDeployVmSsh()
  const diagnostics = ssh.reachable ? await readDeployVmDiagnostics().catch(() => null) : null
  return NextResponse.json(
    {
      success: ssh.reachable,
      online: ssh.reachable,
      apiOnline: false,
      degraded: ssh.reachable,
      setupComplete: false,
      warning: ssh.reachable ? "Runner API offline, but deploy VM SSH login works" : "Deploy VM SSH login failed",
      nginx: diagnostics?.nginx ?? null,
      runner: diagnostics?.runner ?? { running: false, port: 5050 },
      cloudflared: diagnostics?.cloudflared ?? { running: false },
      diagnostics: diagnostics?.diagnostics ?? null,
      debug: {
        sshReachable: ssh.reachable,
        sshError: ssh.error,
      },
    },
    { status: ssh.reachable ? 200 : 503 },
  )
}

export async function POST() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const upstream = await proxyRunner("/api/setup", { method: "POST" })
  if (upstream.status !== 503) {
    return upstream
  }

  try {
    const ssh = await probeDeployVmSsh()
    if (!ssh.reachable) {
      return NextResponse.json(
        {
          success: false,
          error: "Root SSH login to deploy VM failed",
          phase: "ssh-login",
          debug: {
            sshReachable: false,
            sshError: ssh.error,
          },
        },
        { status: 500 },
      )
    }

    const result = await bootstrapDeployVmRunner()
    return NextResponse.json(
      {
        success: result.success,
        message: result.success ? "Deploy VM runner bootstrapped over root SSH" : "Deploy VM runner bootstrap failed",
        phase: result.phase,
        logs: result.logs,
        debug: {
          sshReachable: true,
          sshError: ssh.error,
        },
      },
      { status: result.success ? 200 : 500 },
    )
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Failed to bootstrap deploy VM runner over SSH",
        phase: "bootstrap",
      },
      { status: 500 },
    )
  }
}
