// Proxy for listing durable Turso agent sessions for a project.
// Docs: https://sycord.site/api/#agent
//
// GET /api/workspace/sycord/agent-sessions?projectId=<id>&limit=50
// → GET /sycord/api/agent_sessions?uuid=&limit=
//
// Auth: NextAuth session required.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import { getStoredSyteUuid } from "@/lib/deploy/syte-workspace"
import { isSyteConfigured, syteAgentSessions } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  if (!isSyteConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Syte deployer is not configured (DEPLOYER_API_KEY missing)." },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").trim()
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10) || 50, 200)

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing 'projectId'" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const uuid = getStoredSyteUuid(project)
  if (!uuid) {
    return NextResponse.json(
      { ok: false, error: "No Syte workspace UUID for this project." },
      { status: 409 },
    )
  }

  const result = await syteAgentSessions(uuid, { limit })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status || 502 },
    )
  }

  const sessions = (result.data?.sessions || []).map((s) => ({
    ...s,
    // Rewrite absolute upstream session_url to our authenticated proxy
    session_url: s.id
      ? `/api/workspace/sycord/agent-session?sessionId=${encodeURIComponent(s.id)}&projectId=${encodeURIComponent(projectId)}`
      : s.session_url,
  }))

  return NextResponse.json({
    ok: true,
    uuid,
    turso_configured: result.data?.turso_configured ?? true,
    sessions,
  })
}
