import { NextResponse } from "next/server"
import { listWorkspaceContainers, getBaseDomain } from "@/lib/admin/workspace-provision"
import { requireAdminResponse } from "../_shared"

export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  try {
    const baseDomain = getBaseDomain()
    const containers = await listWorkspaceContainers()
    return NextResponse.json({
      success: true,
      websites: containers.map((c) => ({
        id: c.containerName,
        businessName: c.containerName.replace(/^sycord-/, ""),
        subdomain: c.containerName,
        status: c.running ? "running" : "stopped",
        running: c.running,
        health: c.health,
        url: `https://${c.containerName}.${baseDomain}`,
        sshPort: c.sshPort,
        createdAt: c.createdAt,
      })),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to list workspace containers", websites: [] },
      { status: 503 },
    )
  }
}
