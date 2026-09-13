import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { syteBroadcastSubtab, syteStreamSubtab } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * GET /api/projects/[id]/subtabs/[subtab]
 *
 * Subscribe to real-time events on a subtab channel over Better-SSE.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; subtab: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId, subtab } = await params
  if (!projectId || !subtab) {
    return Response.json({ message: "Project ID and subtab name are required." }, { status: 400 })
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

  const upstreamRes = await syteStreamSubtab(workspace.uuid, subtab, {
    sinceId,
    replay,
    lastEventId,
    signal: request.signal,
  })

  if (!upstreamRes.ok || !upstreamRes.body) {
    return Response.json(
      { message: `Subtab stream failed with upstream status ${upstreamRes.status}` },
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
 * POST /api/projects/[id]/subtabs/[subtab]
 *
 * Broadcast an event payload to all clients connected to this subtab.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; subtab: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId, subtab } = await params
  if (!projectId || !subtab) {
    return Response.json({ message: "Project ID and subtab name are required." }, { status: 400 })
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
    payload?: Record<string, unknown>
    event?: string
  }

  const payload = body?.payload || body || {}
  const eventName = typeof body?.event === "string" ? body.event : "update"

  const result = await syteBroadcastSubtab(workspace.uuid, subtab, payload, eventName)
  if (!result.ok) {
    return Response.json({ message: result.error || "Broadcast failed" }, { status: result.status || 502 })
  }

  return Response.json(result.data)
}
