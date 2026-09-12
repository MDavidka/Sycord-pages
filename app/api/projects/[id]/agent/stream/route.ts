import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { syteStreamChat, syteStreamEvents } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * GET /api/projects/[id]/agent/stream
 *
 * Connect / reconnect directly to the Better-SSE agent stream.
 * Supports ?since_id= and Last-Event-ID header.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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
  const sinceId = searchParams.get("since_id")
    ? parseInt(searchParams.get("since_id")!, 10)
    : undefined
  const replay = searchParams.get("replay") === "true"
  const lastEventId = request.headers.get("Last-Event-ID") || undefined

  const upstreamRes = await syteStreamEvents(workspace.uuid, {
    sinceId,
    replay,
    lastEventId,
    signal: request.signal,
  })

  if (!upstreamRes.ok || !upstreamRes.body) {
    return Response.json(
      { message: `Stream connection failed with upstream status ${upstreamRes.status}` },
      { status: upstreamRes.status || 502 },
    )
  }

  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

/**
 * POST /api/projects/[id]/agent/stream
 *
 * Start an agent turn and stream events directly over Better-SSE.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

  const body = (await request.json().catch(() => ({}))) as {
    message?: string
    agentMode?: "build" | "plan"
    planMode?: "auto" | "always" | "off"
    thinkingLevel?: string
    executionSpeed?: string
  }

  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!message) {
    return Response.json({ message: "Message is required." }, { status: 400 })
  }

  const upstreamRes = await syteStreamChat(workspace.uuid, message, {
    agentMode: body.agentMode,
    planMode: body.planMode,
    thinkingLevel: body.thinkingLevel,
    executionSpeed: body.executionSpeed,
    lastEventId: request.headers.get("Last-Event-ID") || undefined,
    signal: request.signal,
  })

  if (!upstreamRes.ok || !upstreamRes.body) {
    return Response.json(
      { message: `Stream initiation failed with upstream status ${upstreamRes.status}` },
      { status: upstreamRes.status || 502 },
    )
  }

  return new Response(upstreamRes.body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
