import { NextResponse } from "next/server"
import { ensureAdmin, requestRunner } from "../_utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const query = searchParams.toString()
  const path = query ? `setup/status?${query}` : "setup/status"

  const result = await requestRunner(path)

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.data?.error || "Runner offline" },
      { status: result.status },
    )
  }

  return NextResponse.json({ success: true, ...(result.data || {}) })
}

export async function POST(request: Request) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))

  const result = await requestRunner("setup", {
    method: "POST",
    body: JSON.stringify(body),
  })

  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.data?.error || "Setup failed" },
      { status: result.status },
    )
  }

  return NextResponse.json({ success: true, ...(result.data || {}) })
}
