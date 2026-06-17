import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import { loadProject, projectFiles, requireUserId, isValidProjectId, validateNextBuildable } from "@/lib/workspace/sandbox"
import { deployWorkspace, provisionWorkspace, type WorkspaceCredentials } from "@/lib/admin/workspace-provision"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

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

function sse(event: string, data: unknown) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify({ ...(data as object), timestamp: new Date().toISOString() })}\n\n`)
}

/**
 * POST /api/workspace/deploy/stream
 * Body: { projectId }
 *
 * Streaming variant of the container deploy: emits SSE stage/log/result/error
 * events while provisioning (if needed), building, and publishing the project.
 */
export async function POST(request: Request) {
  const userId = await requireUserId()
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { projectId } = await request.json().catch(() => ({}))
  if (!projectId || !isValidProjectId(projectId)) {
    return new Response(JSON.stringify({ error: "Missing or invalid projectId" }), { status: 400 })
  }

  const project = await loadProject(userId, projectId)
  if (!project) {
    return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
  }

  const files = projectFiles(project)
  const problems = validateNextBuildable(files)
  const projectName = project.businessName || project.subdomain || `project-${projectId}`

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Uint8Array) => controller.enqueue(data)
      const log = (line: string) => send(sse("log", { line }))
      const stage = (s: string, status: string, message: string) => send(sse("stage", { stage: s, status, message }))

      try {
        if (problems.length > 0) {
          stage("validate", "error", "Project is not buildable")
          send(sse("error", { error: problems.join("; "), stage: "validate" }))
          controller.close()
          return
        }

        const client = await clientPromise
        const db = client.db()

        let credentials = readStoredCredentials(project)
        if (!credentials) {
          stage("provision", "running", "Provisioning workspace container")
          const provisioned = await provisionWorkspace(projectName, undefined, log)
          if (!provisioned.success || !provisioned.credentials) {
            stage("provision", "error", provisioned.error || "Provisioning failed")
            send(sse("error", { error: provisioned.error || "Provisioning failed", stage: provisioned.phase }))
            controller.close()
            return
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
          stage("provision", "success", `Container ${credentials.containerName} ready`)
        }

        stage("deploy", "running", "Uploading, building and publishing")
        const result = await deployWorkspace(credentials, files, log)

        if (!result.success) {
          stage("deploy", "error", result.error || "Deploy failed")
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
          send(sse("error", { error: result.error || "Deploy failed", stage: result.phase }))
          controller.close()
          return
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

        stage("complete", "success", "Deployment finished")
        send(sse("result", { success: true, url: result.url, domain: result.domain, containerName: credentials.containerName }))
      } catch (error: any) {
        send(sse("error", { error: error?.message || "Deploy failed" }))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
