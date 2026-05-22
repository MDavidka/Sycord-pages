import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import {
  runAIWebsiteBuilder,
  type BuilderOptions,
  type ProjectContext,
  type ProgressEvent,
} from "@/lib/ai-website-builder"
import type { ModelSelection } from "@/lib/ai-provider"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

function parseModelSelection(value: unknown): ModelSelection | undefined {
  if (!value || typeof value !== "object") return undefined
  const v = value as Record<string, unknown>
  const id = typeof v.id === "string" ? v.id.trim() : ""
  const provider = typeof v.provider === "string" ? v.provider.trim() : ""
  if (!id || !provider) return undefined
  const allowed = new Set(["xAI", "OpenRouter", "Google", "DeepSeek", "Anthropic", "OpenAI"])
  if (!allowed.has(provider)) return undefined
  return { id, provider, name: typeof v.name === "string" ? v.name : undefined }
}

async function loadProjectContext(userId: string, projectId: string): Promise<ProjectContext | undefined> {
  if (!ObjectId.isValid(projectId)) return undefined
  const client = await clientPromise
  const db = client.db()
  const userDoc = await db.collection("users").findOne({ id: userId })
  if (!userDoc || !Array.isArray(userDoc.projects)) return undefined
  const project = userDoc.projects.find(
    (p: { _id?: ObjectId }) => p._id?.toString() === projectId,
  ) as Record<string, unknown> | undefined
  if (!project) return undefined
  const envVars = (Array.isArray(project.envVars) ? project.envVars : []) as Array<{ key: string; value?: string; integration?: string | null }>
  const envVarKeys = envVars.map((e) => e.key).filter((k): k is string => typeof k === "string" && k.length > 0)
  const connectedIntegrationIds = Array.from(
    new Set(envVars.map((e) => (typeof e.integration === "string" && e.integration.length > 0 ? e.integration : null)).filter((id): id is string => !!id)),
  )
  return {
    name: typeof project.businessName === "string" ? project.businessName : undefined,
    description: typeof project.businessDescription === "string" ? project.businessDescription : undefined,
    category: typeof project.category === "string" ? project.category : undefined,
    logoUrl: typeof project.profileImage === "string" ? project.profileImage : undefined,
    subdomain: typeof project.subdomain === "string" ? project.subdomain : undefined,
    envVarKeys,
    envVars,
    integrations: Array.isArray(project.integrations) ? (project.integrations as Array<{ name: string; provider?: string }>) : [],
    connectedIntegrationIds,
  }
}

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as {
    prompt?: string
    projectId?: string
    model?: unknown
    quality?: unknown
  }

  const prompt = body.prompt?.trim()
  if (!prompt) {
    return new Response("Prompt is required", { status: 400 })
  }

  const projectId = typeof body.projectId === "string" ? body.projectId : undefined
  const projectContext = projectId ? await loadProjectContext(session.user.id, projectId) : undefined

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        if (isClosed) return
        try {
          controller.enqueue(encoder.encode(sseEncode(event, data)))
        } catch {
          isClosed = true
        }
      }

      const onProgress = (evt: ProgressEvent) => {
        enqueue("progress", evt)
      }

      try {
        const opts: BuilderOptions = {
          model: parseModelSelection(body.model),
          quality: body.quality === "fast" || body.quality === "best" ? body.quality : "best",
          projectId,
          project: projectContext,
          onProgress,
        }

        const result = await runAIWebsiteBuilder(prompt, opts)

        enqueue("result", {
          message: `Generated ${result.manifest.pages.length} pages, ${result.files.length} files`,
          manifest: result.manifest,
          files: result.files,
          build: result.build,
          warnings: result.warnings,
          qualityScore: result.qualityScore,
          needsDatabase: result.needsDatabase,
          databaseProvider: result.databaseProvider,
          integrations: result.integrations,
          requiredEnvVars: result.requiredEnvVars,
          missingEnvVars: result.missingEnvVars,
          unconnectedIntegrations: result.unconnectedIntegrations,
          deploymentMode: result.deploymentMode,
        })

        // Save to MongoDB if projectId provided
        if (projectId) {
          try {
            const deployable = result.files.filter(
              (f) => typeof f.path === "string" && typeof f.content === "string" && !f.path.startsWith(".sycord/") && !/^\.env(?:\.|$)/.test(f.path),
            )
            const normalizedPages = deployable.map((file) => ({
              name: file.path.replace(/^\/+/, "").slice(0, 255),
              content: file.content,
              usedFor: "ai-builder",
              createdAt: new Date(),
              updatedAt: new Date(),
            }))
            const client = await clientPromise
            const db = client.db()
            await db.collection("users").updateOne(
              { id: session.user.id, "projects._id": new ObjectId(projectId) },
              {
                $set: {
                  "projects.$.pages": normalizedPages,
                  "projects.$.deploymentMode": "api",
                  "projects.$.updatedAt": new Date(),
                },
              },
            )
            enqueue("saved", { savedPages: normalizedPages.length })
          } catch {
            enqueue("error", { message: "Failed to save files to project" })
          }
        }
      } catch (error) {
        enqueue("error", {
          message: error instanceof Error ? error.message : "Builder failed",
        })
      } finally {
        try {
          controller.close()
        } catch {
          // stream already closed
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
