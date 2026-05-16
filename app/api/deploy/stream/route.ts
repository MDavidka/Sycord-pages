import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import * as Sentry from "@sentry/nextjs"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { deployViaGitTree, ensureRepo, getEnvGitHubCredentials } from "@/lib/deploy/github"
import {
  callRunnerDeployStream,
  createErrorEvent,
  createLogEvent,
  createResultEvent,
  createStageEvent,
  getProjectEnvVars,
  getRunnerToken,
  getRunnerUrl,
  normalizeRunnerDeployResponse,
  parseSseChunk,
  prepareProjectDeployFiles,
  redactSecrets,
  toSseChunk,
  validateNextServerDeployFiles,
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
  if (!session?.user?.id) {
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
  const user = await db.collection("users").findOne({ id: session.user.id })
  const project = user?.projects?.find((item: any) => item._id.toString() === projectId)
  if (!project) {
    return new Response(JSON.stringify({ error: "Project not found" }), { status: 404 })
  }

  const files = prepareProjectDeployFiles(project)
  const validationErrors = validateNextServerDeployFiles(files)
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
      let finalResult: any = null
      let finalError: {
        error: string
        stage?: string
        logs?: string[]
        localHealth?: unknown
        publicHealth?: unknown
      } | null = null
      const logSummary: string[] = []

      try {
        write("message", createStageEvent("queued", "running", "Queued for deployment"))
        write("message", createStageEvent("github", "running", "Preparing GitHub repository"))
        write("message", createLogEvent("github", `Repository ${repo} ready`))
        write("message", createStageEvent("preparing", "running", "Preparing project files"))
        write("message", createLogEvent("sycord", `Prepared ${files.length} files for next-server runtime`))
        write("message", createStageEvent("vm-connect", "running", "Connecting to VM runner"))

        // Get runner configuration from project or env vars
        const runnerConfig = {
          runnerUrl: getRunnerUrl(project),
          runnerToken: getRunnerToken(project),
        }

        const runnerResponse = await callRunnerDeployStream(projectId, {
          files,
          subdomain: repo,
          deployment_mode: "next-server",
          ...(Object.keys(envVars).length > 0 ? { env_vars: envVars } : {}),
        }, runnerConfig)

        if (!runnerResponse.ok || !runnerResponse.body) {
          const errorText = await runnerResponse.text().catch(() => "")
          throw new Error(errorText || `Runner stream failed with HTTP ${runnerResponse.status}`)
        }

        write("message", createStageEvent("vm-connect", "success", "VM stream connected"))

        const reader = runnerResponse.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split("\n\n")
          buffer = parts.pop() || ""

          for (const part of parts) {
            for (const event of parseSseChunk(`${part}\n\n`)) {
              const payload = event.data || {}

              if (event.event === "stage") {
                const mappedStage =
                  payload.stage === "starting" ? "starting-server" :
                  payload.stage === "starting-server" ? "starting-server" :
                  payload.stage === "configuring-proxy" ? "configuring-proxy" :
                  payload.stage === "health-check" ? "health-check" :
                  payload.stage === "writing-files" ? "writing-files" :
                  payload.stage === "preparing-files" ? "preparing-files" :
                  payload.stage === "allocating-port" ? "allocating-port" :
                  payload.stage === "installing" ? "installing" :
                  payload.stage === "building" ? "building" :
                  payload.stage === "preparing" ? "preparing" :
                  payload.stage === "complete" ? "complete" :
                  payload.stage === "failed" ? "failed" :
                  "preparing"
                write(
                  "message",
                  createStageEvent(
                    mappedStage as any,
                    payload.status === "error" ? "error" : payload.status === "success" ? "success" : "running",
                    payload.message || payload.stage || "Runner update",
                  ),
                )
              } else if (event.event === "log") {
                const source =
                  payload.source === "install" ? "install" :
                  payload.source === "build" ? "build" :
                  payload.source === "runtime" ? "runtime" :
                  payload.source === "proxy" ? "proxy" :
                  payload.source === "health" ? "health" :
                  payload.source === "runner" ? "runner" :
                  "vm"
                const line = redactSecrets(String(payload.line || ""))
                if (line) {
                  logSummary.push(line)
                  write("message", createLogEvent(source as any, line))
                }
              } else if (event.event === "result") {
                finalResult = payload
              } else if (event.event === "error") {
                finalError = {
                  error: redactSecrets(String(payload.error || "Runner deployment failed")),
                  stage: payload.stage ? String(payload.stage) : undefined,
                  logs: Array.isArray(payload.logs) ? payload.logs.map((line: string) => redactSecrets(line)) : undefined,
                  localHealth: payload.localHealth,
                  publicHealth: payload.publicHealth,
                }
              }
            }
          }
        }

        if (finalError) {
          throw Object.assign(new Error(finalError.error), { meta: finalError })
        }

        const normalized = normalizeRunnerDeployResponse(finalResult)
        if (!normalized.success || !normalized.running || !normalized.build.ok || !normalized.health.ok || !normalized.health.htmlOk || !normalized.url || !normalized.domain) {
          const error = normalized.error || normalized.build.error || normalized.health.error || "Runner deployment failed"
          throw Object.assign(new Error(error), {
            meta: {
              error,
              stage: normalized.publicHealth && (!normalized.publicHealth.ok || !normalized.publicHealth.htmlOk)
                ? "public-health-check"
                : normalized.build.ok ? "health-check" : "building",
              logs: summarizeLogs([
                ...normalized.logs.deploy,
                ...normalized.logs.build,
                ...normalized.logs.error,
              ]),
              localHealth: normalized.localHealth,
              publicHealth: normalized.publicHealth,
            },
          })
        }

        write("message", createStageEvent("github", "running", "Pushing source to GitHub"))
        await deployViaGitTree(github.owner, repo, files, github.token)
        write("message", createLogEvent("github", `Updated ${gitUrl}`))
        write("message", createStageEvent("saving", "running", "Saving deployment result"))

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
                url: normalized.url,
                port: normalized.port,
                processName: normalized.processName,
                status: "running",
                health: "healthy",
                localHealth: normalized.localHealth || null,
                publicHealth: normalized.publicHealth || null,
                warning: normalized.warning || null,
                lastHealthCheckAt: new Date(),
                lastDeployAt: new Date(),
                lastDeployError: null,
              },
              "projects.$.lastDeployLogsSummary": summarizeLogs(logSummary),
              "projects.$.lastFailedStage": null,
              "projects.$.lastDeployError": null,
              "projects.$.lastDeployWarning": normalized.warning || null,
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

        write("message", createStageEvent("saving", "success", "Deployment result saved"))
        write("message", createStageEvent("complete", "success", normalized.warning || "Deployment finished"))
        write(
          "message",
          createResultEvent({
            url: normalized.url,
            domain: normalized.domain,
            port: normalized.port,
            health: normalized.health,
            localHealth: normalized.localHealth,
            publicHealth: normalized.publicHealth,
            warning: normalized.warning || undefined,
          }),
        )
      } catch (error: any) {
        const meta = error?.meta || {}
        const message = redactSecrets(error?.message || "Deployment failed")
        Sentry.captureException(error, {
          tags: {
            area: "deploy-stream",
            project_id: projectId,
            repo,
            stage: meta.stage || "unknown",
          },
        })

        await db.collection("users").updateOne(
          { id: session.user.id, "projects._id": new ObjectId(projectId) },
          {
            $set: {
              "projects.$.deploymentMode": "next-server",
              "projects.$.deploymentRuntime": {
                mode: "next-server",
                domain: null,
                port: null,
                processName: null,
                status: "failed",
                health: "unhealthy",
                localHealth: meta.localHealth || null,
                publicHealth: meta.publicHealth || null,
                lastHealthCheckAt: new Date(),
                lastDeployAt: new Date(),
                lastDeployError: message,
              },
              "projects.$.lastDeployLogsSummary": summarizeLogs(logSummary.concat(meta.logs || [])),
              "projects.$.lastFailedStage": meta.stage || "failed",
              "projects.$.lastDeployError": message,
            },
            $unset: {
              "projects.$.cloudflareUrl": "",
            },
          },
        )

        write("message", createStageEvent("failed", "error", message))
        write("message", createErrorEvent(message, meta.stage, meta.logs))
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
