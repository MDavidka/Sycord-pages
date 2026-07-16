import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { syteAgentInterrupt, syteAgentStop } from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * POST /api/projects/[id]/agent/interrupt
 *
 * Cancel the in-progress agent turn from the chat Stop button.
 * Tries agent_interrupt first (keeps runtime warm), falls back to agent_stop.
 * Docs: https://sycord.site/api/#agent
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const interrupted = await syteAgentInterrupt(workspace.uuid)
  if (interrupted.ok) {
    return Response.json({ ok: true, uuid: workspace.uuid, action: "interrupt" })
  }

  const stopped = await syteAgentStop(workspace.uuid)
  if (stopped.ok) {
    return Response.json({
      ok: true,
      uuid: workspace.uuid,
      action: "stop",
      interrupt_error: interrupted.error,
    })
  }

  return Response.json(
    {
      ok: false,
      message: interrupted.error || stopped.error || "Failed to stop agent.",
    },
    { status: interrupted.status || stopped.status || 502 },
  )
}
