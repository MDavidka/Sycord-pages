import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { syteStreamCommand } from "@/lib/deploy/syte-client"
import { isDangerousCommand } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/projects/[id]/command
 *
 * Stream terminal shell command output live over Better-SSE.
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
    command?: string
    cwd?: string
  }

  const command = typeof body?.command === "string" ? body.command.trim() : ""
  if (!command) {
    return Response.json({ message: "Command is required." }, { status: 400 })
  }

  if (isDangerousCommand(command)) {
    return Response.json({ message: `Dangerous command blocked: ${command}` }, { status: 400 })
  }

  const upstreamRes = await syteStreamCommand(workspace.uuid, command, {
    cwd: body?.cwd || "app",
    signal: request.signal,
  })

  if (!upstreamRes.ok || !upstreamRes.body) {
    return Response.json(
      { message: `Command stream failed with upstream status ${upstreamRes.status}` },
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
