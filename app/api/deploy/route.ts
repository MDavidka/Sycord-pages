import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import * as Sentry from "@sentry/nextjs"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import {
  callCompanionDeploy,
  callCompanionHealth,
  getProjectEnvVars,
  prepareProjectDeployFiles,
  validateApiDeployFiles,
} from "@/lib/deploy/runner-client"
import { deployViaGitTree, ensureRepo, getEnvGitHubCredentials } from "@/lib/deploy/github"

function slugifyRepoName(project: any, projectId: string) {
  return (
    project?.githubRepo ||
    project?.businessName?.toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
    `project-${projectId}`
  )
}

function summarizeLogs(logs: string[]) {
  return logs.slice(-40)
}

function captureDeployFailure(input: {
  projectId: string
  repo: string
  error: string
  stage?: string
  response?: any
}) {
  Sentry.captureException(new Error(`Companion deploy failed: ${input.error}`), {
    tags: {
      area: "deploy",
      project_id: input.projectId,
      repo: input.repo,
      stage: input.stage || "unknown",
      deployment_mode: "api",
    },
    extra: {
      response: input.response,
    },
  })
}

export async function POST(request: Request) {
  let sentryProjectId = "unknown"
  let sentryRepo = "unknown"

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

    const github = getEnvGitHubCredentials()
    if (!github) {
      return NextResponse.json({ error: "GitHub credentials not configured" }, { status: 400 })
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

    const repo = slugifyRepoName(project, projectId)
    sentryRepo = repo
    const { repoId, gitUrl } = await ensureRepo(github.owner, repo, github.token)
    const envVars = getProjectEnvVars(project)

    await deployViaGitTree(github.owner, repo, files, github.token)

    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
          [`git_connection.${repoId}`]: {
            username: github.owner,
            repo_id: String(repoId),
            git_url: gitUrl,
            git_token: github.token,
            repo_name: repo,
            project_id: projectId,
            deployed_at: new Date(),
            env_vars: envVars,
          },
        },
      },
    )

    await callCompanionHealth()
    const companion = await callCompanionDeploy(repoId)
    const liveUrl = companion.url

    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.githubOwner": github.owner,
          "projects.$.githubRepo": repo,
          "projects.$.githubRepoId": repoId,
          "projects.$.githubUrl": gitUrl,
          "projects.$.cloudflareUrl": liveUrl,
          "projects.$.deploymentMode": "api",
          "projects.$.deploymentRuntime": {
            mode: "api",
            domain: liveUrl ? liveUrl.replace(/^https?:\/\//, "") : null,
            url: liveUrl,
            status: "deployed",
            health: "healthy",
            message: companion.message,
            projectName: companion.projectName,
            username: companion.username,
            repoId: companion.repoId || String(repoId),
            lastHealthCheckAt: new Date(),
            lastDeployAt: new Date(),
            lastDeployError: null,
          },
          "projects.$.lastDeployLogsSummary": summarizeLogs([companion.message || "Companion Server deployment complete"]),
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
      githubUrl: gitUrl,
      cloudflareUrl: liveUrl,
      filesCount: files.length,
      message: companion.message || "Deployment complete",
      repoId: String(repoId),
      deploymentMode: "api",
      running: true,
      health_ok: true,
      health: { ok: true, htmlOk: true },
      domain: liveUrl ? liveUrl.replace(/^https?:\/\//, "") : null,
      projectName: companion.projectName,
      username: companion.username,
    })
  } catch (error: any) {
    captureDeployFailure({
      projectId: sentryProjectId,
      repo: sentryRepo,
      error: error?.message || "Deploy failed",
      stage: "companion-api",
      response: error?.response,
    })
    return NextResponse.json({ error: error?.message || "Deploy failed" }, { status: 500 })
  }
}
