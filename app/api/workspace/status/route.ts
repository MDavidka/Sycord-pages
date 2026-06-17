import { NextResponse } from "next/server"
import { loadProject, requireUserId, isValidProjectId } from "@/lib/workspace/sandbox"
import { probeWorkspace, type WorkspaceCredentials } from "@/lib/admin/workspace-provision"

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
 * GET /api/workspace/status?projectId=...
 * Reports whether the project's workspace container is provisioned and
 * reachable over SSH, plus its current deployment runtime.
 */
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

  const credentials = readStoredCredentials(project)
  if (!credentials) {
    return NextResponse.json({
      success: true,
      provisioned: false,
      reachable: false,
      deployment: project.deploymentRuntime || null,
    })
  }

  const probe = await probeWorkspace(credentials)
  return NextResponse.json({
    success: true,
    provisioned: true,
    reachable: probe.reachable,
    error: probe.error,
    containerName: credentials.containerName,
    sshHost: credentials.sshHost,
    sshPort: credentials.sshPort,
    deployment: project.deploymentRuntime || null,
  })
}
