import { NextResponse } from "next/server"
import { ensureAdmin, requestRunner } from "../../../_utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, logs: [], error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.toString()
  const path = query ? `websites/${params.projectId}/logs?${query}` : `websites/${params.projectId}/logs`

  const result = await requestRunner(path)

  if (!result.ok) {
    return NextResponse.json(
      { success: false, logs: [], error: result.data?.error || "Runner offline" },
      { status: result.status },
    )
  }

  const logs = Array.isArray(result.data?.logs)
    ? result.data.logs
    : Array.isArray(result.data)
      ? result.data
      : []

  return NextResponse.json({ success: true, logs })
}
