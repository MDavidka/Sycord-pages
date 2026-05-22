import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import {
  refineAIWebsite,
  type ProjectContext,
  type RefineOptions,
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      prompt?: string
      projectId?: string
      model?: unknown
      existingFiles?: Array<{ path: string; content: string }>
      existingManifest?: unknown
      conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>
    }

    const prompt = body.prompt?.trim()
    if (!prompt) {
      return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
    }

    if (!Array.isArray(body.existingFiles) || !body.existingManifest) {
      return NextResponse.json({ message: "existingFiles and existingManifest are required for refinement" }, { status: 400 })
    }

    const projectId = typeof body.projectId === "string" ? body.projectId : undefined
    const projectContext = projectId ? await loadProjectContext(session.user.id, projectId) : undefined

    const conversationHistory = Array.isArray(body.conversationHistory)
      ? body.conversationHistory.filter(
          (m) => m && typeof m.role === "string" && typeof m.content === "string",
        )
      : []

    const opts: RefineOptions = {
      model: parseModelSelection(body.model),
      projectId,
      project: projectContext,
      existingFiles: body.existingFiles,
      existingManifest: body.existingManifest as RefineOptions["existingManifest"],
      conversationHistory,
    }

    const result = await refineAIWebsite(prompt, opts)

    // Save to MongoDB if projectId provided
    let savedPages = 0
    if (projectId && result.files.length > 0) {
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
              "projects.$.updatedAt": new Date(),
            },
          },
        )
        savedPages = normalizedPages.length
      } catch {
        // save failed but refinement result is still valid
      }
    }

    return NextResponse.json({
      message: `Refined: ${result.changes.length} change(s) applied`,
      manifest: result.manifest,
      files: result.files,
      changes: result.changes,
      logs: result.logs,
      warnings: result.warnings,
      savedPages,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message: "Refinement failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
