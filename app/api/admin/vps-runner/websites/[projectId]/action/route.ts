import { NextResponse } from "next/server"
import {
  controlWorkspaceContainer,
  destroyWorkspace,
  probeWorkspace,
  listWorkspaceContainers,
} from "@/lib/admin/workspace-provision"
import { requireAdminResponse } from "../../../_shared"

// Per-container actions. `projectId` here is the container name (the id the
// /websites listing returns).
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const { projectId: containerName } = await params
  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === "string" ? body.action : ""

  try {
    if (action === "start" || action === "stop" || action === "restart") {
      const result = await controlWorkspaceContainer(containerName, action)
      return NextResponse.json({ success: result.success, logs: result.logs }, { status: result.success ? 200 : 500 })
    }

    if (action === "destroy") {
      const result = await destroyWorkspace(containerName)
      return NextResponse.json({ success: result.success, logs: result.logs }, { status: result.success ? 200 : 500 })
    }

    if (action === "health") {
      const containers = await listWorkspaceContainers()
      const container = containers.find((c) => c.containerName === containerName)
      if (!container || !container.sshPort) {
        return NextResponse.json({ success: false, error: "Container not running or SSH port unknown" }, { status: 404 })
      }
      // We only have the private key in the user's DB record; at the admin host
      // level we report reachability of the container's mapped SSH port.
      const probe = await probeWorkspace({
        containerName,
        sshHost: "",
        sshPort: container.sshPort,
        sshUser: "sycord",
        privateKey: "",
      }).catch(() => ({ reachable: false, error: "Probe requires per-project key" }))
      return NextResponse.json({ success: true, health: { ok: container.running, reachable: probe.reachable } })
    }

    return NextResponse.json({ success: false, error: "Invalid website action" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Action failed" }, { status: 500 })
  }
}
