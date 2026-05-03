import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import * as Sentry from "@sentry/nextjs"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import {
  callRunnerDeploy,
  getProjectEnvVars,
  isSuccessfulRunnerDeployResponse,
  normalizeRunnerDeployResponse,
  prepareProjectDeployFiles,
  validateNextServerDeployFiles,
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
  Sentry.captureException(new Error(`Runner deploy failed: ${input.error}`), {
    tags: {
      area: "deploy",
      project_id: input.projectId,
      repo: input.repo,
      stage: input.stage || "unknown",
      deployment_mode: "next-server",
    },
    extra: {
      response: input.response,
    },
  })
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId } = await request.json()
    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    }

    const github = getEnvGitHubCredentials()
    if (!github) {
      return NextResponse.json({ error: "GitHub credentials not configured" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne({ id: session.user.id })
    const project = user?.projects?.find((item: any) => item._id.toString() === projectId)

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const files = prepareProjectDeployFiles(project)
    const validationErrors = validateNextServerDeployFiles(files)
    if (validationErrors.length > 0) {
      return NextResponse.json({ success: false, error: validationErrors.join("; ") }, { status: 400 })
    }

    const repo = slugifyRepoName(project, projectId)
    const { repoId, gitUrl } = await ensureRepo(github.owner, repo, github.token)
    const envVars = getProjectEnvVars(project)

    const runner = await callRunnerDeploy(projectId, {
      files,
      subdomain: repo,
      deployment_mode: "next-server",
      ...(Object.keys(envVars).length > 0 ? { env_vars: envVars } : {}),
    })

    const normalized = normalizeRunnerDeployResponse(runner.raw)
    if (!isSuccessfulRunnerDeployResponse(normalized.raw)) {
      const error = normalized.error || normalized.build.error || normalized.health.error || "Runner deployment failed"
      captureDeployFailure({ projectId, repo, error, response: normalized.raw })
      await db.collection("users").updateOne(
        { id: session.user.id, "projects._id": new ObjectId(projectId) },
        {
          $set: {
            "projects.$.deploymentMode": "next-server",
            "projects.$.deploymentRuntime": {
              mode: "next-server",
              domain: normalized.domain,
              port: normalized.port,
              processName: normalized.processName,
              status: "failed",
              health: normalized.health.ok && normalized.health.htmlOk ? "healthy" : "unhealthy",
              lastHealthCheckAt: new Date(),
              lastDeployAt: new Date(),
              lastDeployError: error,
            },
            "projects.$.lastDeployLogsSummary": summarizeLogs([
              ...normalized.logs.deploy,
              ...normalized.logs.build,
              ...normalized.logs.error,
            ]),
            "projects.$.lastFailedStage": normalized.build.ok ? "health-check" : "building",
            "projects.$.lastDeployError": error,
          },
          $unset: {
            "projects.$.cloudflareUrl": "",
          },
        },
      )

      return NextResponse.json(
        {
          success: false,
          error,
          build: normalized.build,
          running: normalized.running,
          health: normalized.health,
          health_ok: normalized.health.ok,
          domain: normalized.domain,
          port: normalized.port,
          logs: normalized.logs,
          githubUrl: gitUrl,
          repoId: String(repoId),
          deploymentMode: "next-server",
        },
        { status: 502 },
      )
    }

    await deployViaGitTree(github.owner, repo, files, github.token)

    await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.githubOwner": github.owner,
          "projects.$.githubRepo": repo,
          "projects.$.githubRepoId": repoId,
          "projects.$.githubUrl": gitUrl,
          "projects.$.cloudflareUrl": normalized.url,
          "projects.$.deploymentMode": "next-server",
          "projects.$.deploymentRuntime": {
            mode: "next-server",
            domain: normalized.domain,
            port: normalized.port,
            processName: normalized.processName,
            status: "running",
            health: "healthy",
            lastHealthCheckAt: new Date(),
            lastDeployAt: new Date(),
            lastDeployError: null,
          },
          "projects.$.lastDeployLogsSummary": summarizeLogs([
            ...normalized.logs.deploy,
            ...normalized.logs.build,
            ...normalized.logs.health,
          ]),
          "projects.$.lastFailedStage": null,
          "projects.$.lastDeployError": null,
          "projects.$.deployedAt": new Date(),
        },
      },
    )

    await db.collection("users").updateOne(
      { id: session.user.id },
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

    return NextResponse.json({
      success: true,
      url: normalized.url,
      githubUrl: gitUrl,
      cloudflareUrl: normalized.url,
      filesCount: files.length,
      message: "Deployment complete",
      repoId: String(repoId),
      deploymentMode: "next-server",
      build: { ok: true },
      running: true,
      health_ok: true,
      health: normalized.health,
      domain: normalized.domain,
      port: normalized.port,
      processName: normalized.processName,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Deploy failed" }, { status: 500 })
  }
}
