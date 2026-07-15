// Proxy for POST /sycord/api/agent_change — submit a durable agent task.
//
// The browser never holds DEPLOYER_API_KEY. All calls are proxied here.
// Auth: NextAuth session required.
//
// POST /api/workspace/sycord/agent-change
// Body: { projectId: string; message: string; modelProfile?: string }
//
// Response includes turso_session_id — poll
// GET /api/workspace/sycord/agent-session?sessionId=<turso_session_id>&since_id=N
// until status != "open". See https://sycord.site/api/#agent

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import { getStoredSyteUuid } from "@/lib/deploy/syte-workspace"
import { isSyteConfigured, syteAgentChange } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request): Promise<Response> {
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

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectId, message, modelProfile } = body
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing 'projectId'" }, { status: 400 })
  }
  if (!message || typeof message !== "string" || !message.trim()) {
    return NextResponse.json({ ok: false, error: "Missing 'message'" }, { status: 400 })
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
      {
        ok: false,
        error: "No Syte workspace UUID for this project. Run create_project first.",
      },
      { status: 409 },
    )
  }

  const result = await syteAgentChange(uuid, message.trim(), modelProfile || undefined)
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status || 502 },
    )
  }

  const tursoSessionId = result.data?.turso_session_id ?? null
  const sessionPath = tursoSessionId
    ? `/api/workspace/sycord/agent-session?sessionId=${encodeURIComponent(tursoSessionId)}`
    : null

  return NextResponse.json({
    ok: true,
    uuid,
    request_id: result.data?.request_id ?? null,
    status: result.data?.status ?? "accepted",
    turso_session_id: tursoSessionId,
    // Proxied Turso session document — poll until status != "open"
    session_url: sessionPath,
    // Discovery helper for listing recent durable sessions on this project
    sessions_url: `/api/workspace/sycord/agent-sessions?projectId=${encodeURIComponent(projectId)}`,
    // Local SQLite mirror only — prefer Turso session_url when available
    activity_url: `/api/workspace/sycord/agent-activity?projectId=${encodeURIComponent(projectId)}`,
  })
}
