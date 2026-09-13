import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { syteUploadFiles } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/projects/[id]/upload
 *
 * Upload files (.zip, .csv, code, pdf, docs) to project workspace for AI understanding.
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

  const formData = await request.formData()
  const result = await syteUploadFiles(workspace.uuid, formData, {
    extractToWorkspace: true,
    signal: request.signal,
  })

  if (!result.ok) {
    return Response.json(
      { message: result.error || "File upload failed" },
      { status: result.status || 502 },
    )
  }

  return Response.json(result.data)
}
