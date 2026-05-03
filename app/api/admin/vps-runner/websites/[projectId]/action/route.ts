import { NextResponse } from "next/server"
import { assertAdmin, proxyRunner } from "../../../_shared"

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.text()
  return proxyRunner(`/api/websites/${params.projectId}/action`, { method: "POST", body })
}
