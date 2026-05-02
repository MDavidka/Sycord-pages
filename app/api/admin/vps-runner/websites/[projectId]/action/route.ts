import { NextResponse } from "next/server"
import { ensureAdmin, requestRunner } from "../../../_utils"

export const runtime = "nodejs"

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const projectId = params.projectId

  const result = await requestRunner(`websites/${projectId}/action`, {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.data?.error || "Website action failed" },
      { status: result.status },
    )
  }

  return NextResponse.json({ success: true, ...(result.data || {}) })
}
