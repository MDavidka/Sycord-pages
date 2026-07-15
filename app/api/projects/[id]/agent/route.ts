import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import {
  syteAgentChange,
  syteAgentSessions,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MODEL_PROFILES = new Set(["syra-nano", "syra-base", "syra-havy"])

/**
 * GET /api/projects/[id]/agent
 *
 * Discover durable Turso sessions so a returning client can resume previous
 * activity after leaving mid-turn (no re-submit).
 *
 * ?resume=1  → prefer the newest open session, else the newest session
 * default    → list recent sessions
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  if (!projectId) {
    return Response.json({ message: "Project ID is required." }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, projectId)
  if (!project) {
    return Response.json({ message: "Project not found" }, { status: 404 })
  }

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) {
    return Response.json({ message: workspace.error, needsCreate: true }, { status: 409 })
  }

  const { searchParams } = new URL(request.url)
  const resume = searchParams.get("resume") === "1"
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10) || 20, 50)

  const listed = await syteAgentSessions(workspace.uuid, { limit })
  if (!listed.ok) {
    return Response.json(
      { message: listed.error || "Failed to list Turso agent sessions." },
      { status: listed.status || 502 },
    )
  }

  const sessions = listed.data?.sessions || []
  const open = sessions.find((s) => s.status === "open")
  const latest = sessions[0] || null
  const resumeTarget = open || (resume ? latest : null)

  return Response.json({
    ok: true,
    uuid: workspace.uuid,
    turso_configured: listed.data?.turso_configured ?? true,
    sessions,
    open_session: open || null,
    resume_session: resumeTarget
      ? {
          id: resumeTarget.id,
          session_number: resumeTarget.session_number ?? null,
          status: resumeTarget.status ?? null,
          session_url: `/api/workspace/sycord/agent-session?sessionId=${encodeURIComponent(resumeTarget.id)}&projectId=${encodeURIComponent(projectId)}`,
        }
      : null,
  })
}

/**
 * POST /api/projects/[id]/agent
 *
 * Submit one durable agent turn. Returns immediately with turso_session_id.
 * Clients poll GET /api/workspace/sycord/agent-session?sessionId=… for events.
 * See https://sycord.site/api/#agent
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  const body = (await request.json().catch(() => null)) as {
    message?: unknown
    modelProfile?: unknown
    afterSession?: unknown
  } | null
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const requestedProfile = typeof body?.modelProfile === "string" ? body.modelProfile : ""
  const modelProfile = MODEL_PROFILES.has(requestedProfile) ? requestedProfile : "syra-base"
  const afterSession = Math.max(0, Math.floor(Number(body?.afterSession) || 0))

  if (!projectId || !message) {
    return Response.json({ message: "Project ID and message are required." }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, projectId)
  if (!project) {
    return Response.json({ message: "Project not found" }, { status: 404 })
  }

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) {
    return Response.json({ message: workspace.error, needsCreate: true }, { status: 409 })
  }

  const listed = await syteAgentSessions(workspace.uuid, { limit: 1 })
  const latestSavedSession =
    listed.ok && listed.data?.sessions?.[0]?.session_number
      ? Math.max(afterSession, Number(listed.data.sessions[0].session_number) || 0)
      : afterSession

  const change = await syteAgentChange(workspace.uuid, message, modelProfile)
  const requestId = change.data?.request_id
  const tursoSessionId = change.data?.turso_session_id
  if (!change.ok || !requestId) {
    return Response.json(
      { message: change.error || "Syte agent did not accept the request." },
      { status: change.status || 502 },
    )
  }

  if (!tursoSessionId) {
    return Response.json(
      {
        message:
          "Syte agent accepted the request but did not return turso_session_id. " +
          "Configure turso_database_url in the Syte AI tab, or upgrade the deployer.",
        request_id: requestId,
        status: change.data?.status ?? "accepted",
      },
      { status: 503 },
    )
  }

  const sessionNumber = latestSavedSession + 1

  return Response.json({
    ok: true,
    request_id: requestId,
    status: change.data?.status ?? "accepted",
    turso_session_id: tursoSessionId,
    session_number: sessionNumber,
    session_url: `/api/workspace/sycord/agent-session?sessionId=${encodeURIComponent(tursoSessionId)}&projectId=${encodeURIComponent(projectId)}`,
    sessions_url: `/api/projects/${encodeURIComponent(projectId)}/agent?resume=1`,
  })
}
