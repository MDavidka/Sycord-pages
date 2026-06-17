import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import * as Sentry from "@sentry/nextjs"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import {
  createErrorEvent,
  createLogEvent,
  createResultEvent,
  createStageEvent,
  getProjectEnvVars,
  prepareProjectDeployFiles,
  redactSecrets,
  toSseChunk,
  validateApiDeployFiles,
  getSycordDomain,
} from "@/lib/deploy/runner-client"
import {
  bootstrapContainer,
  ensureContainer,
  getContainer,
  sshDeployFiles,
  publishSiteViaNginx,
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
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 })
  }

  const { projectId } = await request.json().catch(() => ({}))
  if (!projectId) {
    return new Response(JSON.stringify({ error: "Missing projectId" }), { status: 400 })
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

  const containerName = slugifyContainerName(project, projectId)
  const domain = getSycordDomain()
  const liveUrl = `https://${containerName}.${domain}`
  const envVars = getProjectEnvVars(project)
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const write = (event: string, data: unknown) => controller.enqueue(encoder.encode(toSseChunk(event, data)))
      const logSummary: string[] = []

      const log = (source: "ssh" | "build" | "publish", line: string) => {
        const safeLine = redactSecrets(line)
        logSummary.push(`[${source}] ${safeLine}`)
        write("message", createLogEvent(source, safeLine))
      }

      try {
        write("message", createStageEvent("queued", "running", "Queued for SSH deployment"))
        write("message", createStageEvent("preparing", "running", "Preparing container"))

        let container = await getContainer(projectId)
        if (!container) {
          write("message", createStageEvent("container-setup", "running", "Creating SSH container"))
          log("ssh", "Creating new container for project")
          container = await ensureContainer(project, projectId)
          const bootstrap = await bootstrapContainer(container)
          if (!bootstrap.success) {
            write("message", createStageEvent("failed", "error", bootstrap.error || "Container bootstrap failed"))
            write("message", createErrorEvent(bootstrap.error || "Container bootstrap failed", "container-setup"))
            controller.close()
            return
          }
          write("message", createStageEvent("container-setup", "success", "Container provisioned"))
          log("ssh", `Container ${container.containerName} ready at ${container.workspaceName}`)
        } else {
          log("ssh", `Reusing container ${container.containerName}`)
        }

        write("message", createStageEvent("upload", "running", `Uploading ${files.length} files via SSH`))
        log("ssh", `Deploying ${files.length} files`)

        await db.collection("containers").updateOne(
          { projectId },
          { $set: { lastDeployAt: new Date() } },
          { upsert: true },
        )

        const deployResult = await sshDeployFiles(container, files)

        for (const line of deployResult.logs) {
          log("ssh", line)
        }

        if (!deployResult.success) {
          write("message", createStageEvent("failed", "error", deployResult.error || "Deploy failed"))
          write("message", createErrorEvent(deployResult.error || "Deploy failed", "publish", summarizeLogs(logSummary)))

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
                "projects.$.lastDeployLogsSummary": summarizeLogs(logSummary),
                "projects.$.lastFailedStage": "publish",
                "projects.$.lastDeployError": deployResult.error,
                "projects.$.containerName": containerName,
              },
            },
          )
          controller.close()
          return
        }

        write("message", createStageEvent("publish", "success", "Files deployed and build started"))
        write("message", createStageEvent("publish", "running", "Configuring nginx and starting site via PM2"))
        log("publish", `Setting up nginx proxy for ${containerName}.${domain}`)

        const publish = await publishSiteViaNginx(containerName, container.workspaceName, domain)
        const finalUrl = publish.url
        if (!publish.success) {
          log("publish", `Publish warning: ${publish.error || "Unknown"}`)
        }
        log("publish", `Site published at ${finalUrl}`)
        write("message", createStageEvent("publish", "success", `Site live at ${finalUrl}`))
        write("message", createStageEvent("saving", "running", "Saving deployment result"))

        await db.collection("users").updateOne(
          { id: userId, "projects._id": new ObjectId(projectId) },
          {
            $set: {
              "projects.$.containerName": containerName,
              "projects.$.deploymentMode": "ssh",
              "projects.$.deploymentRuntime": {
                mode: "ssh",
                domain: finalUrl ? finalUrl.replace(/^https?:\/\//, "") : null,
                url: finalUrl,
                status: "deployed",
                health: "healthy",
                message: "Deployed via SSH",
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
        write("message", createStageEvent("complete", "success", "Deployment finished via SSH"))
        write(
          "message",
          createResultEvent({
            url: finalUrl,
            domain,
            health: { ok: true, htmlOk: true },
          }),
        )
      } catch (error: any) {
        const message = redactSecrets(error?.message || "Deployment failed")
        Sentry.captureException(error, {
          tags: {
            area: "deploy-stream",
            project_id: projectId,
            container: containerName,
            stage: "ssh-deploy",
          },
        })

        await db.collection("users").updateOne(
          { id: userId, "projects._id": new ObjectId(projectId) },
          {
            $set: {
              "projects.$.deploymentMode": "ssh",
              "projects.$.deploymentRuntime": {
                mode: "ssh",
                domain: null,
                url: null,
                status: "failed",
                health: "unhealthy",
                lastHealthCheckAt: new Date(),
                lastDeployAt: new Date(),
                lastDeployError: message,
              },
              "projects.$.lastDeployLogsSummary": summarizeLogs(logSummary),
              "projects.$.lastFailedStage": "ssh-deploy",
              "projects.$.lastDeployError": message,
            },
          },
        )

        write("message", createStageEvent("failed", "error", message))
        write("message", createErrorEvent(message, "ssh-deploy", summarizeLogs(logSummary)))
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
