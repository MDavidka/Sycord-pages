// Proxy for durable Turso agent sessions.
// Docs: https://sycord.site/api/#agent
//
// GET /api/workspace/sycord/agent-session?sessionId=<turso_uuid>&since_id=0
// → GET /sycord/api/agent_session/{session_id}?since_id=
//
// Auth: NextAuth session required. Ownership is verified via the session's
// project_id when present, otherwise by optional projectId query param.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import { getStoredSyteUuid } from "@/lib/deploy/syte-workspace"
import { isSyteConfigured, syteAgentSession } from "@/lib/deploy/syte-client"

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
  const sessionId = (searchParams.get("sessionId") || searchParams.get("id") || "").trim()
  const projectId = (searchParams.get("projectId") || "").trim()
  const sinceId = parseInt(searchParams.get("since_id") || "0", 10) || 0

  if (!sessionId) {
    return NextResponse.json({ ok: false, error: "Missing 'sessionId'" }, { status: 400 })
  }

  const result = await syteAgentSession(sessionId, { sinceId })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status || 502 },
    )
  }

  const data = result.data
  const remoteProjectId = data?.project_id

  // Prove ownership: match projectId query, or look up by remote project_id UUID.
  const client = await clientPromise
  const db = client.db()

  if (projectId) {
    const project = await getOwnedProject(db, userId, projectId)
    if (!project) {
      return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
    }
    const uuid = getStoredSyteUuid(project)
    if (remoteProjectId && uuid && remoteProjectId !== uuid) {
      return NextResponse.json({ ok: false, error: "Session does not belong to this project" }, { status: 403 })
    }
  } else if (remoteProjectId) {
    // Find a user-owned project whose stored Syte UUID matches project_id.
    const user = await db.collection("users").findOne(
      { id: userId },
      { projection: { projects: 1 } },
    )
    const projects = Array.isArray(user?.projects) ? user.projects : []
    const owns = projects.some((p: any) => getStoredSyteUuid(p) === remoteProjectId)
    if (!owns) {
      return NextResponse.json({ ok: false, error: "Session not found" }, { status: 404 })
    }
  } else {
    // No project_id on the session and no projectId query — refuse.
    return NextResponse.json(
      { ok: false, error: "Missing 'projectId' (required when session has no project_id)" },
      { status: 400 },
    )
  }

  return NextResponse.json({ ok: true, ...(data as object) })
}
