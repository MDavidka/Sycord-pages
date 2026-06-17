import { NextResponse } from "next/server"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import { loadProject, projectFiles, requireUserId, isValidProjectId, validateNextBuildable } from "@/lib/workspace/sandbox"
import { deployWorkspace, provisionWorkspace, type WorkspaceCredentials } from "@/lib/admin/workspace-provision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/** Read stored workspace credentials off a project document, if present. */
function readStoredCredentials(project: any): WorkspaceCredentials | null {
  const ws = project?.workspace
  if (!ws?.containerName || !ws?.privateKey || !ws?.sshHost || !ws?.sshPort) return null
  return {
    containerName: ws.containerName,
    sshHost: ws.sshHost,
    sshPort: Number(ws.sshPort),
    sshUser: ws.sshUser || "sycord",
    privateKey: ws.privateKey,
    publicKey: ws.publicKey || undefined,
    createdAt: ws.createdAt,
  }
}

/**
 * POST /api/workspace/deploy?projectId=...   (projectId also accepted in body)
 *
 * Uploads the project's files into its workspace container (provisioning one
 * first if needed), builds the Next.js app and publishes it live via
 * sycord-deploy. Persists the resulting deployment state on the project.
 *
 * Backward compatible with the Glovix AI builder `deploy` tool: returns
 * { status: "success", url } on success and { status: "error", message } on
 * failure (additional fields are included for newer callers).
 */
export async function POST(request: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return NextResponse.json({ status: "error", success: false, message: "Unauthorized", error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const projectId = (new URL(request.url).searchParams.get("projectId") || body?.projectId || "").toString()
  if (!projectId || !isValidProjectId(projectId)) {
    return NextResponse.json(
      { status: "error", success: false, message: "Missing or invalid projectId", error: "Missing or invalid projectId" },
      { status: 400 },
    )
  }

  const project = await loadProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ status: "error", success: false, message: "Project not found", error: "Project not found" }, { status: 404 })
  }

  const files = projectFiles(project)
  const problems = validateNextBuildable(files)
  if (problems.length > 0) {
    return NextResponse.json(
      { status: "error", success: false, message: problems.join("; "), error: problems.join("; ") },
      { status: 400 },
    )
  }

  const client = await clientPromise
  const db = client.db()
  const projectName = project.businessName || project.subdomain || `project-${projectId}`

  try {
    // Ensure a workspace container exists.
    let credentials = readStoredCredentials(project)
    if (!credentials) {
      const provisioned = await provisionWorkspace(projectName)
      if (!provisioned.success || !provisioned.credentials) {
        return NextResponse.json(
          { status: "error", success: false, message: provisioned.error || "Provisioning failed", error: provisioned.error || "Provisioning failed", phase: provisioned.phase, logs: provisioned.logs },
          { status: 500 },
        )
      }
      credentials = provisioned.credentials
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
    }

    const result = await deployWorkspace(credentials, files)

    if (!result.success) {
      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        {
          $set: {
            "projects.$.deploymentMode": "container",
            "projects.$.deploymentRuntime": {
              mode: "container",
              containerName: credentials.containerName,
              domain: null,
              url: null,
              status: "failed",
              health: "unhealthy",
              lastDeployAt: new Date(),
              lastDeployError: result.error,
            },
            "projects.$.lastFailedStage": result.phase,
            "projects.$.lastDeployError": result.error,
          },
        },
      )
      return NextResponse.json(
        { status: "error", success: false, message: result.error, error: result.error, phase: result.phase, logs: result.logs },
        { status: 500 },
      )
    }

    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.cloudflareUrl": result.url || null,
          "projects.$.domain": result.domain || null,
          "projects.$.deploymentMode": "container",
          "projects.$.deploymentRuntime": {
            mode: "container",
            containerName: credentials.containerName,
            domain: result.domain || null,
            url: result.url || null,
            status: "deployed",
            health: "healthy",
            lastDeployAt: new Date(),
            lastHealthCheckAt: new Date(),
            lastDeployError: null,
          },
          "projects.$.lastFailedStage": null,
          "projects.$.lastDeployError": null,
          "projects.$.deployedAt": new Date(),
        },
      },
    )

    return NextResponse.json({
      status: "success",
      success: true,
      url: result.url,
      domain: result.domain,
      containerName: credentials.containerName,
      deploymentMode: "container",
    })
  } catch (error: any) {
    return NextResponse.json({ status: "error", success: false, message: error?.message || "Deploy failed", error: error?.message || "Deploy failed" }, { status: 500 })
  }
}
