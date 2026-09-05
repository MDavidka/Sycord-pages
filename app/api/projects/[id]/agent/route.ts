import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import {
  syteAgentSessions,
  syteAgentStream,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MODEL_PROFILES = new Set(["syra-nano", "syra-base", "syra-havy", "syra-ultra"])
// Sycord's /api/models endpoint can expose provider-qualified profiles such as
// `9router:<model-id>`. Keep the accepted shape narrow while allowing those
// runtime profiles through to the upstream agent API.
const DYNAMIC_MODEL_PROFILE = /^[a-z0-9][a-z0-9._:/-]{0,127}$/i

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
  // Overlap auth + body parse — both are independent and often 20–80ms each.
  const [session, bodyResult, routeParams] = await Promise.all([
    getServerSession(authOptions),
    request.json().then(
      (body) => ({ ok: true as const, body }),
      () => ({ ok: false as const, body: null }),
    ),
    params,
  ])

  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const rate = checkRateLimit(`agent:${session.user.id}`, { limit: 20, windowMs: 60_000 })
  if (!rate.allowed) {
    return Response.json(
      { message: "Too many agent requests. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    )
  }

  const { id: projectId } = routeParams
  if (!bodyResult.ok || !bodyResult.body) {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 })
  }
  const body = bodyResult.body as {
    message?: unknown
    modelProfile?: unknown
    planMode?: unknown
    agentMode?: unknown
    afterSession?: unknown
  }
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const requestedProfile = typeof body?.modelProfile === "string" ? body.modelProfile : ""
  const modelProfile = MODEL_PROFILES.has(requestedProfile) || DYNAMIC_MODEL_PROFILE.test(requestedProfile)
    ? requestedProfile
    : "syra-base"
  const agentMode = body?.agentMode === "plan" ? "plan" : "build"
  const planMode = body?.planMode === "auto" || body?.planMode === "always" || body?.planMode === "off"
    ? body.planMode
    : agentMode === "plan"
      ? "always"
      : "off"

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

  let upstream: Response
  try {
    upstream = await syteAgentStream({
      projectId,
      message,
      modelProfile,
      planMode,
      agentMode,
      workspaceUuid: workspace.uuid,
    })
  } catch (error) {
    return Response.json(
      { message: error instanceof Error ? error.message : "Failed to connect to Syte agent." },
      { status: 502 },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => "")
    return Response.json(
      { message: detail || `Syte agent stream failed (${upstream.status}).` },
      { status: upstream.status || 502 },
    )
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
