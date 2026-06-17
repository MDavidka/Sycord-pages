import { NextResponse } from "next/server"
import { getContainerLogs } from "@/lib/admin/workspace-provision"
import { requireAdminResponse } from "../../../_shared"

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const { projectId: containerName } = await params
  const { searchParams } = new URL(request.url)
  const limit = Number(searchParams.get("limit") || "200")

  try {
    const logs = await getContainerLogs(containerName, limit)
    return NextResponse.json({ success: true, logs })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to read logs", logs: [] }, { status: 503 })
  }
}
