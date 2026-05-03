import { NextResponse } from "next/server"
import { proxyRunner, requireAdminResponse } from "../_shared"

const ACTION_PATHS: Record<string, string> = {
  start: "/api/runner/start",
  stop: "/api/runner/stop",
  destroy: "/api/runner/destroy",
  setup: "/api/setup",
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))
  const action = typeof body.action === "string" ? body.action : ""
  const path = ACTION_PATHS[action]
  if (!path) {
    return NextResponse.json({ success: false, error: "Invalid runner action" }, { status: 400 })
  }

  return proxyRunner(path, { method: "POST" })
}
