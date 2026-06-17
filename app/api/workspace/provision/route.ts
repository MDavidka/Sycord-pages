import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import { loadProject, requireUserId, isValidProjectId } from "@/lib/workspace/sandbox"
import { provisionWorkspace, containerNameForProject, type WorkspaceCredentials } from "@/lib/admin/workspace-provision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * POST /api/workspace/provision
 * Body: { projectId }
 *
 * Provisions a per-project Docker workspace container on the parent VPS and
 * persists its connection credentials under the user's project record
 * (users.projects.$.workspace).
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

  const projectName = project.businessName || project.subdomain || `project-${projectId}`

  try {
    const result = await provisionWorkspace(projectName)
    if (!result.success || !result.credentials) {
      return NextResponse.json(
        { success: false, error: result.error || "Provisioning failed", phase: result.phase, logs: result.logs },
        { status: 500 },
      )
    }

    const credentials: WorkspaceCredentials = result.credentials
    const client = await clientPromise
    const db = client.db()
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.workspace": {
            containerName: credentials.containerName,
            sshHost: credentials.sshHost,
            sshPort: credentials.sshPort,
            sshUser: credentials.sshUser,
            privateKey: credentials.privateKey,
            publicKey: credentials.publicKey || null,
            createdAt: credentials.createdAt || new Date().toISOString(),
            status: "provisioned",
          },
        },
      },
    )

    return NextResponse.json({
      success: true,
      containerName: credentials.containerName,
      sshHost: credentials.sshHost,
      sshPort: credentials.sshPort,
      sshUser: credentials.sshUser,
      phase: result.phase,
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Provisioning failed" },
      { status: 500 },
    )
  }
}

/** Stable container name preview for a project (no provisioning). */
export async function GET(request: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId") || ""
  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ error: "Missing or invalid projectId" }, { status: 400 })
  }
  const project = await loadProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 })
  }
  const projectName = project.businessName || project.subdomain || `project-${projectId}`
  return NextResponse.json({
    success: true,
    containerName: project.workspace?.containerName || containerNameForProject(projectName),
    provisioned: Boolean(project.workspace?.containerName),
  })
}
