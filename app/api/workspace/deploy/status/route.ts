// GET /api/workspace/deploy/status?projectId=&applicationUuid=&deploymentUuid=
// Poll Coolify build logs for Syra deploy() UI progress.

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { checkCoolifyDeploymentStatus } from "@/lib/deploy/wait-for-coolify-deployment"
import { isValidProjectId } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").toString()
  let applicationUuid =
    (searchParams.get("applicationUuid") || searchParams.get("applicationId") || "").toString()
  const deploymentUuid = searchParams.get("deploymentUuid") || searchParams.get("deploymentId")

  if (!isValidProjectId(projectId)) {
    return Response.json({ message: "projectId is required" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne({ id: userId })
  const project = user?.projects?.find((p: any) => p._id.toString() === projectId)
  if (!project) {
    return Response.json({ message: "Project not found" }, { status: 404 })
  }

  if (!applicationUuid) {
    applicationUuid =
      (project.coolifyApplicationUuid as string | undefined) ||
      (project.dokployApplicationId as string | undefined) ||
      ""
  }

  if (!applicationUuid) {
    return Response.json({
      status: "building",
      applicationUuid: null,
      applicationId: null,
      deploymentUuid: null,
      deploymentId: null,
      progressMessage: "Waiting for Coolify to start the deployment…",
      matchedLine: null,
      error: null,
      logsTail: "",
    })
  }

  const result = await checkCoolifyDeploymentStatus({
    applicationUuid,
    deploymentUuid: deploymentUuid || null,
  })

  return Response.json({
    status: result.status,
    applicationUuid,
    applicationId: applicationUuid,
    deploymentUuid: result.deploymentUuid,
    deploymentId: result.deploymentUuid,
    progressMessage: result.progressMessage,
    matchedLine: result.matchedLine,
    error: result.error,
    logsTail: result.logs.split("\n").slice(-40).join("\n"),
  })
}
