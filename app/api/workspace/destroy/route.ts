import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import { loadProject, requireUserId, isValidProjectId } from "@/lib/workspace/sandbox"
import { destroyWorkspace } from "@/lib/admin/workspace-provision"

/**
 * POST /api/workspace/destroy
 * Body: { projectId }
 *
 * Tears down the project's workspace container and clears its stored
 * credentials and deployment runtime from the user's project record.
 */
export async function POST(request: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { projectId } = await request.json().catch(() => ({}))
  if (!projectId || !isValidProjectId(projectId)) {
    return NextResponse.json({ error: "Missing or invalid projectId" }, { status: 400 })
  }

  const project = await loadProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }

  const containerName = project.workspace?.containerName
  if (!containerName) {
    return NextResponse.json({ success: true, message: "No workspace to destroy" })
  }

  try {
    const result = await destroyWorkspace(containerName)
    const client = await clientPromise
    const db = client.db()
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $unset: { "projects.$.workspace": "" },
        $set: {
          "projects.$.deploymentRuntime": {
            mode: "container",
            status: "destroyed",
            url: null,
            domain: null,
            lastDeployAt: new Date(),
          },
        },
      },
    )

    return NextResponse.json({ success: result.success, logs: result.logs })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Destroy failed" }, { status: 500 })
  }
}
