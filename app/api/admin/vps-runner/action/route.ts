import { NextResponse } from "next/server"
import {
  buildAdminStatus,
  controlAllWorkspaceContainers,
  destroyAllWorkspaceContainers,
  ensureHostSetup,
} from "@/lib/admin/workspace-provision"
import { requireAdminResponse } from "../_shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

// Host-level actions for the admin "Runner" tab, mapped to the container model:
//   setup   -> bootstrap the Docker host
//   start   -> start all workspace containers
//   stop    -> stop all workspace containers
//   destroy -> remove all workspace containers (host stays intact)
export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === "string" ? body.action : ""

  try {
    if (action === "setup") {
      const result = await ensureHostSetup()
      const status = await buildAdminStatus().catch(() => null)
      return NextResponse.json(
        { success: result.success, message: result.success ? "Host configured" : result.error, logs: result.logs, ...(status || {}) },
        { status: result.success ? 200 : 500 },
      )
    }

    if (action === "start" || action === "stop") {
      const result = await controlAllWorkspaceContainers(action)
      const status = await buildAdminStatus().catch(() => null)
      return NextResponse.json(
        {
          success: result.success,
          message: result.success
            ? `Workspace containers ${action === "start" ? "started" : "stopped"}`
            : `Failed to ${action} workspace containers`,
          logs: result.logs,
          ...(status || {}),
        },
        { status: result.success ? 200 : 500 },
      )
    }

    if (action === "destroy") {
      const result = await destroyAllWorkspaceContainers()
      return NextResponse.json(
        { success: result.success, message: result.success ? "All workspace containers removed" : "Destroy failed", logs: result.logs },
        { status: result.success ? 200 : 500 },
      )
    }

    return NextResponse.json({ success: false, error: "Invalid runner action" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Action failed", apiOnline: false },
      { status: 500 },
    )
  }
}
