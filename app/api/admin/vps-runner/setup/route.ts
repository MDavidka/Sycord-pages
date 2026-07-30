import { NextResponse } from "next/server"
import {
  bootstrapDeployVmRunner,
  generateRunnerToken,
  probeDeployVmSsh,
  readDeployVmDiagnostics,
  type VmSetupInput,
} from "@/lib/admin/vm-ssh"
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

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  // Parse request body for user-provided credentials
  const body = await request.json().catch(() => ({}))
  const host = String(body.host || "").trim()
  const password = String(body.rootPassword || body.password || "")
  const port = Number(body.port || 22)
  const baseDomain = String(body.baseDomain || "sycord.site").trim()

  // If credentials provided, use them; otherwise fall back to env vars and proxy
  const hasUserCredentials = Boolean(host && password)

  if (!hasUserCredentials) {
    // Try to proxy to existing runner first
    const upstream = await proxyRunner("/api/setup", { method: "POST" })
    if (upstream.status !== 503) {
      return upstream
    }
  }

  try {
    // Build SSH input from user credentials or env vars
    const sshInput: VmSetupInput | undefined = hasUserCredentials
      ? { host, password, port, baseDomain, runnerToken: generateRunnerToken() }
      : undefined

    const ssh = await probeDeployVmSsh(sshInput)
    if (!ssh.reachable) {
      return NextResponse.json(
        {
          success: false,
          error: hasUserCredentials
            ? "SSH login failed. Check VM IP and root password."
            : "Root SSH login to deploy VM failed",
          phase: "ssh-login",
          debug: {
            sshReachable: false,
            sshError: ssh.error,
          },
        },
        { status: 500 },
      )
    }

    const result = await bootstrapDeployVmRunner(sshInput)
    return NextResponse.json(
      {
        success: result.success,
        message: result.success ? "Deploy VM runner bootstrapped over root SSH" : "Deploy VM runner bootstrap failed",
        phase: result.phase,
        logs: result.logs,
        runnerUrl: result.runnerUrl,
        runnerToken: result.runnerToken,
        baseDomain: result.baseDomain,
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
