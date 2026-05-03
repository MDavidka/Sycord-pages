import { NextResponse } from "next/server"
import { manageDeployVmRunnerService, probeDeployVmSsh, readDeployVmDiagnostics } from "@/lib/admin/vm-ssh"
import { proxyRunner, requireAdminResponse } from "../_shared"

const ACTION_PATHS: Record<string, string> = {
  start: "/api/runner/start",
  stop: "/api/runner/stop",
  destroy: "/api/runner/destroy",
  setup: "/api/setup",
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === "string" ? body.action : ""
  const path = ACTION_PATHS[action]
  if (!path) {
    return NextResponse.json({ success: false, error: "Invalid runner action" }, { status: 400 })
  }

  const upstream = await proxyRunner(path, { method: "POST" })
  const shouldFallback = upstream.status >= 400

  if (!shouldFallback) {
    return upstream
  }

  if (action === "setup") {
    return upstream
  }

  const ssh = await probeDeployVmSsh()
  if (!ssh.reachable) {
    return upstream
  }

  if (action === "start" || action === "stop") {
    try {
      const result = await manageDeployVmRunnerService(action)
      return NextResponse.json(
        {
          success: result.success,
          message:
            action === "start"
              ? result.success
                ? "Runner service is active on the deploy VM"
                : "Failed to start runner service over SSH"
              : result.success
                ? "Runner service stopped on the deploy VM"
                : "Failed to stop runner service over SSH",
          logs: result.logs,
          runner: result.diagnostics.runner,
          nginx: result.diagnostics.nginx,
          cloudflared: result.diagnostics.cloudflared,
          diagnostics: result.diagnostics.diagnostics,
          degraded: true,
          apiOnline: false,
        },
        { status: result.success ? 200 : 500 },
      )
    } catch (error: any) {
      return NextResponse.json(
        {
          success: false,
          error: error?.message || "Failed to control runner service over SSH",
          degraded: true,
          apiOnline: false,
        },
        { status: 500 },
      )
    }
  }

  const diagnostics = await readDeployVmDiagnostics().catch(() => null)
  return NextResponse.json(
    {
      success: action === "destroy" ? false : Boolean(diagnostics?.runner?.running),
      error: "Runner API is unavailable",
      runner: diagnostics?.runner ?? null,
      nginx: diagnostics?.nginx ?? null,
      cloudflared: diagnostics?.cloudflared ?? null,
      diagnostics: diagnostics?.diagnostics ?? null,
      degraded: true,
      apiOnline: false,
    },
    { status: action === "destroy" ? 503 : 200 },
  )
}
