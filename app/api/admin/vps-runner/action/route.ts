import { NextResponse } from "next/server"
import { ensureAdmin, requestRunner } from "../_utils"

export const runtime = "nodejs"

export async function POST(request: Request) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))

  const result = await requestRunner("action", {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.data?.error || "Runner action failed" },
      { status: result.status },
    )
  }

  return NextResponse.json({ success: true, ...(result.data || {}) })
}
