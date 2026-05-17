import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import * as Sentry from "@sentry/nextjs"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { deployViaGitTree, ensureRepo, getEnvGitHubCredentials } from "@/lib/deploy/github"
import {
  callCompanionDeploy,
  callCompanionHealth,
  createErrorEvent,
  createLogEvent,
  createResultEvent,
  createStageEvent,
  getProjectEnvVars,
  prepareProjectDeployFiles,
  redactSecrets,
  toSseChunk,
  validateApiDeployFiles,
} from "@/lib/deploy/runner-client"

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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { projectId } = await request.json().catch(() => ({}))
  if (!projectId) {
    return new Response(JSON.stringify({ error: "Missing projectId" }), { status: 400 })
  }

  const github = getEnvGitHubCredentials()
  if (!github) {
    return new Response(JSON.stringify({ error: "GitHub credentials not configured" }), { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne({ id: userId })
  const project = user?.projects?.find((item: any) => item._id.toString() === projectId)
  if (!project) {
    return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
  }

  const files = prepareProjectDeployFiles(project)
  const validationErrors = validateApiDeployFiles(files)
  if (validationErrors.length > 0) {
    return new Response(JSON.stringify({ success: false, error: validationErrors.join("; ") }), { status: 400 })
  }

  const repo = slugifyRepoName(project, projectId)
  const { repoId, gitUrl } = await ensureRepo(github.owner, repo, github.token)
  const envVars = getProjectEnvVars(project)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: string, data: unknown) => controller.enqueue(encoder.encode(toSseChunk(event, data)))
      const logSummary: string[] = []

      const log = (source: "sycord" | "github" | "api", line: string) => {
        const safeLine = redactSecrets(line)
        logSummary.push(`[${source}] ${safeLine}`)
        write("message", createLogEvent(source, safeLine))
      }

      try {
        write("message", createStageEvent("queued", "running", "Queued for API deployment"))
        write("message", createStageEvent("github", "running", "Preparing GitHub repository"))
        log("github", `Repository ${repo} ready`)

        write("message", createStageEvent("preparing-files", "running", "Preparing project files"))
        log("sycord", `Prepared ${files.length} files for Companion Server deployment`)

        write("message", createStageEvent("github", "running", "Pushing source to GitHub"))
        await deployViaGitTree(github.owner, repo, files, github.token)
        log("github", `Updated ${gitUrl}`)

        write("message", createStageEvent("saving", "running", "Saving repository credentials for Companion Server"))
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
        log("sycord", `Registered numeric repository ID ${repoId}`)

        write("message", createStageEvent("health-check", "running", "Checking Companion Server health"))
        await callCompanionHealth()
        log("api", "Companion Server is reachable")

        write("message", createStageEvent("deploy-api", "running", "Triggering Companion Server deployment API"))
        const companion = await callCompanionDeploy(repoId)
        const liveUrl = companion.url || ""
        const domain = liveUrl ? liveUrl.replace(/^https?:\/\//, "") : ""
        log("api", companion.message || "Companion Server deployment complete")

        write("message", createStageEvent("saving", "running", "Saving deployment result"))
        await db.collection("users").updateOne(
          { id: userId, "projects._id": new ObjectId(projectId) },
          {
            $set: {
              "projects.$.githubOwner": github.owner,
              "projects.$.githubRepo": repo,
              "projects.$.githubRepoId": repoId,
              "projects.$.githubUrl": gitUrl,
              "projects.$.cloudflareUrl": liveUrl || null,
              "projects.$.deploymentMode": "api",
              "projects.$.deploymentRuntime": {
                mode: "api",
                domain: domain || null,
                url: liveUrl || null,
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
              "projects.$.lastDeployLogsSummary": summarizeLogs(logSummary),
              "projects.$.lastFailedStage": null,
              "projects.$.lastDeployError": null,
              "projects.$.lastDeployWarning": null,
              "projects.$.deployedAt": new Date(),
            },
          },
        )

        write("message", createStageEvent("saving", "success", "Deployment result saved"))
        write("message", createStageEvent("complete", "success", companion.message || "Deployment finished"))
        write(
          "message",
          createResultEvent({
            url: liveUrl,
            domain,
            repoId: String(repoId),
            health: { ok: true, htmlOk: true },
          }),
        )
      } catch (error: any) {
        const message = redactSecrets(error?.message || "Deployment failed")
        Sentry.captureException(error, {
          tags: {
            area: "deploy-stream",
            project_id: projectId,
            repo,
            stage: "companion-api",
          },
          extra: {
            response: error?.response,
          },
        })

        await db.collection("users").updateOne(
          { id: userId, "projects._id": new ObjectId(projectId) },
          {
            $set: {
              "projects.$.deploymentMode": "api",
              "projects.$.deploymentRuntime": {
                mode: "api",
                domain: null,
                url: null,
                status: "failed",
                health: "unhealthy",
                lastHealthCheckAt: new Date(),
                lastDeployAt: new Date(),
                lastDeployError: message,
              },
              "projects.$.lastDeployLogsSummary": summarizeLogs(logSummary),
              "projects.$.lastFailedStage": "companion-api",
              "projects.$.lastDeployError": message,
            },
            $unset: {
              "projects.$.cloudflareUrl": "",
            },
          },
        )

        write("message", createStageEvent("failed", "error", message))
        write("message", createErrorEvent(message, "companion-api", summarizeLogs(logSummary)))
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
