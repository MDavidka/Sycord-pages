// GET /api/workspace/deploy/status?projectId=&applicationId=&deploymentId=
// Poll Dokploy build logs for Syra deploy() UI progress.

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { checkDeploymentStatus } from "@/lib/deploy/wait-for-deployment"
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
  let applicationId = (searchParams.get("applicationId") || "").toString()
  const deploymentId = searchParams.get("deploymentId")

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

  if (!applicationId) {
    applicationId = (project.dokployApplicationId as string | undefined) || ""
  }

  if (!applicationId) {
    return Response.json({
      status: "building",
      deploymentId: null,
      progressMessage: "Waiting for Dokploy to start the deployment…",
      matchedLine: null,
      error: null,
      logsTail: "",
    })
  }

  const result = await checkDeploymentStatus({
    applicationId,
    deploymentId: deploymentId || null,
  })

  return Response.json({
    status: result.status,
    applicationId,
    deploymentId: result.deploymentId,
    progressMessage: result.progressMessage,
    matchedLine: result.matchedLine,
    error: result.error,
    logsTail: result.logs.split("\n").slice(-40).join("\n"),
  })
}
