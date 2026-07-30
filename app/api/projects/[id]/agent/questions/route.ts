import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { syteAgentQuestions } from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/projects/[id]/agent/questions
 * → GET /api/agent_questions?uuid=&status=&limit=
 *
 * Docs: https://sycord.site/api/#agent
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
  const status = searchParams.get("status") || undefined
  const limitRaw = searchParams.get("limit")
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 200) : 50

  const listed = await syteAgentQuestions(workspace.uuid, { status, limit })
  if (!listed.ok) {
    return Response.json(
      { message: listed.error || "Failed to list agent questions." },
      { status: listed.status || 502 },
    )
  }

  return Response.json({
    ok: true,
    uuid: workspace.uuid,
    questions: listed.data?.questions || [],
  })
}
