import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/is-admin"

// NOTE: The legacy single-runner proxy (proxyRunner -> :5050) has been removed.
// The admin "Runner" surface now manages the Docker host + per-project
// workspace containers directly over SSH via lib/admin/workspace-provision.ts.

export async function assertAdmin() {
  return isAdmin()
}

export async function requireAdminResponse() {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}

/** Extract optional custom-VM overrides from an admin request body. */
export function parseVpsOverrides(body: any) {
  const host = String(body?.host || "").trim()
  const password = String(body?.rootPassword || body?.password || "")
  const port = Number(body?.port || 22)
  if (!host || !password) return undefined
  return { host, password, port: Number.isFinite(port) ? port : 22, username: "root" }
}
