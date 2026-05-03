import { NextResponse } from "next/server"
import { assertAdmin, proxyRunner } from "../../../_shared"

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") || "runtime"
  const limit = searchParams.get("limit") || "200"
  return proxyRunner(`/api/websites/${params.projectId}/logs?type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`)
}
