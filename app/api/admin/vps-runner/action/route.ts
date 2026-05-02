import { NextResponse } from "next/server"
import { assertAdmin, proxyRunner } from "../_shared"

export async function POST(request: Request) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.text()
  const action = JSON.parse(body || "{}").action

  const response = await proxyRunner("/api/action", { method: "POST", body })
  if (response.status !== 503) return response

  if (action === "start") {
    return NextResponse.json({
      success: false,
      error: "Runner is offline. Run Setup first from the Runner tab to auto-prepare listener/runtime.",
      needsSetup: true,
    }, { status: 503 })
  }

  return response
}
