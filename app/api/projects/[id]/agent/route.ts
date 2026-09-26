import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { getProjectOwnerUserId } from "@/lib/project-id"
import { listMcpConnections, resolveMcpCredentials } from "@/lib/mcp-connections"
import {
  syteAgentChange,
  syteAgentSessions,
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
    thinkingLevel?: unknown
    executionSpeed?: unknown
    credentials?: unknown
  }
  const message = typeof body?.message === "string" ? body.message.trim() : ""
  const requestedProfile = typeof body?.modelProfile === "string" ? body.modelProfile : ""
  const modelProfile = MODEL_PROFILES.has(requestedProfile) || DYNAMIC_MODEL_PROFILE.test(requestedProfile)
    ? requestedProfile
    : "syra-base"
  const afterSession = Math.max(0, Math.floor(Number(body?.afterSession) || 0))
  const agentMode = body?.agentMode === "plan" ? "plan" : "build"
  const planMode = body?.planMode === "auto" || body?.planMode === "always" || body?.planMode === "off"
    ? body.planMode
    : agentMode === "plan"
      ? "always"
      : "auto"
  const thinkingLevel = typeof body?.thinkingLevel === "string" ? body.thinkingLevel : undefined
  const executionSpeed = typeof body?.executionSpeed === "string" ? body.executionSpeed : undefined

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

  const explicitCreds =
    body?.credentials && typeof body.credentials === "object" && !Array.isArray(body.credentials)
      ? (body.credentials as Record<string, unknown>)
      : {}
  const resolvedCredentials: Record<string, unknown> = {
    git_name: session.user.name || undefined,
    git_email: session.user.email || undefined,
    ...explicitCreds,
  }

  // Check project fields for GitHub tokens
  if (!resolvedCredentials.github_token && !resolvedCredentials.GITHUB_TOKEN) {
    if (typeof (project as any).githubToken === "string" && (project as any).githubToken) {
      resolvedCredentials.github_token = (project as any).githubToken
      resolvedCredentials.GITHUB_TOKEN = (project as any).githubToken
    } else if (typeof (project as any).githubAccessToken === "string" && (project as any).githubAccessToken) {
      resolvedCredentials.github_token = (project as any).githubAccessToken
      resolvedCredentials.GITHUB_TOKEN = (project as any).githubAccessToken
    }
  }

  // Check MCP connections for GitHub and other tool tokens
  try {
    const ownerId = getProjectOwnerUserId(project, session.user.id)
    const connections = await listMcpConnections(db, ownerId, projectId)
    for (const conn of connections) {
      if (conn.status === "connected") {
        const creds = await resolveMcpCredentials(db, conn)
        if (creds?.accessToken) {
          if (conn.providerId === "github" && !resolvedCredentials.github_token && !resolvedCredentials.GITHUB_TOKEN) {
            resolvedCredentials.github_token = creds.accessToken
            resolvedCredentials.GITHUB_TOKEN = creds.accessToken
          }
          resolvedCredentials[`${conn.providerId}_token`] = creds.accessToken
        }
        if (creds?.apiKeys) {
          for (const [k, v] of Object.entries(creds.apiKeys)) {
            if (v && !resolvedCredentials[k]) {
              resolvedCredentials[k] = v
            }
          }
        } else if ((creds as any)?.values) {
          for (const [k, v] of Object.entries((creds as any).values)) {
            if (v && !resolvedCredentials[k]) {
              resolvedCredentials[k] = String(v)
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn("[Agent] Failed to resolve MCP connections for agent turn:", err)
  }

  // Start the agent immediately — do not block on a sessions list round-trip.
  // Session numbers from the client (`afterSession`) are authoritative enough
  // for UI correlation; Turso poll events overwrite with the durable number.
  const change = await syteAgentChange(workspace.uuid, message, modelProfile, {
    planMode,
    agentMode,
    thinkingLevel,
    executionSpeed,
    credentials: resolvedCredentials,
  })
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

  const sessionNumber = afterSession + 1

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
