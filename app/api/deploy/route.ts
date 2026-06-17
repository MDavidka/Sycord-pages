import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import * as Sentry from "@sentry/nextjs"
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
  sshDeployFiles,
  getContainer,
} from "@/lib/deploy/ssh-deploy"

function slugifyContainerName(project: any, projectId: string) {
  return (
    project?.containerName ||
    project?.businessName?.toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
    `project-${projectId}`
  )
}

function summarizeLogs(logs: string[]) {
  return logs.slice(-40)
}

export async function POST(request: Request) {
  let sentryProjectId = "unknown"
  let sentryContainer = "unknown"

  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId } = await request.json()
    sentryProjectId = projectId || "unknown"
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne({ id: userId })
    const project = user?.projects?.find((item: any) => item._id.toString() === projectId)

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const files = prepareProjectDeployFiles(project)
    const validationErrors = validateApiDeployFiles(files)
    if (validationErrors.length > 0) {
      return NextResponse.json({ success: false, error: validationErrors.join("; ") }, { status: 400 })
    }

    const containerName = slugifyContainerName(project, projectId)
    sentryContainer = containerName

    let container = await getContainer(projectId)
    if (!container) {
      container = await ensureContainer(project, projectId)
      const bootstrap = await bootstrapContainer(container)
      if (!bootstrap.success) {
        return NextResponse.json({ error: bootstrap.error || "Container bootstrap failed" }, { status: 500 })
      }
    }

    const deployResult = await sshDeployFiles(container, files)
    const domain = getSycordDomain()
    const liveUrl = `https://${containerName}.${domain}`

    if (!deployResult.success) {
      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        {
          $set: {
            "projects.$.deploymentMode": "ssh",
            "projects.$.deploymentRuntime": {
              mode: "ssh",
              domain: liveUrl ? liveUrl.replace(/^https?:\/\//, "") : null,
              url: liveUrl,
              status: "failed",
              health: "unhealthy",
              lastHealthCheckAt: new Date(),
              lastDeployAt: new Date(),
              lastDeployError: deployResult.error,
            },
            "projects.$.lastDeployLogsSummary": summarizeLogs(deployResult.logs),
            "projects.$.lastFailedStage": "publish",
            "projects.$.lastDeployError": deployResult.error,
            "projects.$.containerName": containerName,
          },
        },
      )

      captureDeployFailure({
        projectId: sentryProjectId,
        container: sentryContainer,
        error: deployResult.error || "SSH deploy failed",
        stage: "publish",
      })

      return NextResponse.json({ error: deployResult.error || "SSH deployment failed" }, { status: 500 })
    }

    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.containerName": containerName,
          "projects.$.deploymentMode": "ssh",
          "projects.$.deploymentRuntime": {
            mode: "ssh",
            domain: liveUrl ? liveUrl.replace(/^https?:\/\//, "") : null,
            url: liveUrl,
            status: "deployed",
            health: "healthy",
            message: "Deployed via SSH",
            lastHealthCheckAt: new Date(),
            lastDeployAt: new Date(),
            lastDeployError: null,
          },
          "projects.$.lastDeployLogsSummary": summarizeLogs(deployResult.logs),
          "projects.$.lastFailedStage": null,
          "projects.$.lastDeployError": null,
          "projects.$.lastDeployWarning": null,
          "projects.$.deployedAt": new Date(),
        },
      },
    )

    return NextResponse.json({
      success: true,
      url: liveUrl,
      domain: domain,
      filesCount: files.length,
      message: "Deployment complete via SSH",
      deploymentMode: "ssh",
      running: true,
      health_ok: true,
      health: { ok: true, htmlOk: true },
      containerName,
    })
  } catch (error: any) {
    captureDeployFailure({
      projectId: sentryProjectId,
      container: sentryContainer,
      error: error?.message || "Deploy failed",
      stage: "ssh-deploy",
    })
    return NextResponse.json({ error: error?.message || "Deploy failed" }, { status: 500 })
  }
}

function captureDeployFailure(input: {
  projectId: string
  container: string
  error: string
  stage?: string
}) {
  Sentry.captureException(new Error(`SSH deploy failed: ${input.error}`), {
    tags: {
      area: "deploy",
      project_id: input.projectId,
      container: input.container,
      stage: input.stage || "unknown",
      deployment_mode: "ssh",
    },
  })
}
