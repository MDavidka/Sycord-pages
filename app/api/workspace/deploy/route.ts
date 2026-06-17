import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import {
  prepareProjectDeployFiles,
  validateApiDeployFiles,
  getSycordDomain,
} from "@/lib/deploy/runner-client"
import {
  bootstrapContainer,
  ensureContainer,
  getContainer,
  sshDeployFiles,
} from "@/lib/deploy/ssh-deploy"
import { isValidProjectId, validateNextBuildable } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function slugifyContainerName(project: any, projectId: string): string {
  return (
    project?.containerName ||
    project?.businessName?.toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
    `project-${projectId}`
  )
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return Response.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }

  const projectId = (new URL(req.url).searchParams.get("projectId") || body?.projectId || "").toString()
  if (!isValidProjectId(projectId)) {
    return Response.json({ status: "error", message: "Invalid project ID" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne({ id: userId })
  const project = user?.projects?.find((p: any) => p._id.toString() === projectId)

  if (!project) {
    return Response.json({ status: "error", message: "Project not found" }, { status: 404 })
  }

  const files = prepareProjectDeployFiles(project)
  const validationErrors = validateApiDeployFiles(files)
  if (validationErrors.length > 0) {
    return Response.json({ status: "error", message: validationErrors.join("; ") }, { status: 400 })
  }

  const buildProblems = validateNextBuildable(
    files.map((f) => ({ name: f.path, content: f.content })),
  )
  if (buildProblems.length > 0) {
    return Response.json({ status: "error", message: buildProblems.join("; ") }, { status: 400 })
  }

  const containerName = slugifyContainerName(project, projectId)
  const domain = getSycordDomain()

  let container = await getContainer(projectId)
  if (!container) {
    container = await ensureContainer(project, projectId)
    const bootstrap = await bootstrapContainer(container)
    if (!bootstrap.success) {
      return Response.json({ status: "error", message: bootstrap.error || "Container bootstrap failed" }, { status: 500 })
    }
  }

  const deployResult = await sshDeployFiles(container, files)

  const liveUrl = `https://${containerName}.${domain}`

  if (deployResult.success) {
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.deploymentMode": "ssh",
          "projects.$.containerName": containerName,
          "projects.$.deploymentRuntime": {
            mode: "ssh",
            domain: containerName,
            url: liveUrl,
            status: "deployed",
            health: "healthy",
            lastHealthCheckAt: new Date(),
            lastDeployAt: new Date(),
            lastDeployError: null,
          },
          "projects.$.deployedAt": new Date(),
        },
      },
    )

    return Response.json({ status: "success", url: liveUrl, containerName })
  }

  await db.collection("users").updateOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    {
      $set: {
        "projects.$.deploymentRuntime.status": "failed",
        "projects.$.deploymentRuntime.lastDeployError": deployResult.error,
      },
    },
  )

  return Response.json({ status: "error", message: deployResult.error || "SSH deployment failed" }, { status: 500 })
}
