import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runAIWebsiteBuilder, type BuilderOptions } from "@/lib/ai-website-builder"
import type { ModelSelection } from "@/lib/ai-provider"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

interface GeneratedFile {
  path: string
  content: string
}

// Anything inside `.sycord/` is debug-only. Lockfiles and other non-source
// JSON we never plan to emit are skipped here as well so deployments stay
// lean. `package.json` and `tsconfig.json` are explicitly allowed because
// the static-export deployer needs both.
function isDeployableFilePath(filePath: string) {
  if (!filePath || filePath.startsWith(".sycord/")) return false
  if (filePath.endsWith(".json")) {
    return filePath === "package.json" || filePath === "tsconfig.json"
  }
  return true
}

interface SaveResult {
  saved: number
  files: GeneratedFile[]
}

async function saveGeneratedFilesToProject(
  userId: string,
  projectId: string,
  files: GeneratedFile[],
): Promise<SaveResult> {
  if (!ObjectId.isValid(projectId)) {
    throw new Error("Invalid project ID")
  }

  const deployable = files.filter(
    (file) =>
      typeof file.path === "string" &&
      typeof file.content === "string" &&
      isDeployableFilePath(file.path),
  )

  const normalizedPages = deployable.map((file) => {
    const safeName = file.path.replace(/^\/+/, "").slice(0, 255)
    return {
      name: safeName,
      content: file.content,
      usedFor: "ai-builder",
      createdAt: new Date(),
      updatedAt: new Date(),
    }
  })

  const client = await clientPromise
  const db = client.db()

  const result = await db.collection("users").updateOne(
    {
      id: userId,
      "projects._id": new ObjectId(projectId),
    },
    {
      $set: {
        "projects.$.pages": normalizedPages,
        "projects.$.updatedAt": new Date(),
      },
    },
  )

  if (result.matchedCount === 0) {
    throw new Error("Project not found")
  }

  return { saved: normalizedPages.length, files: deployable }
}

// Validate the model JSON the client sends. Anything malformed is dropped
// (the builder's own fallbacks pick a reasonable model).
function parseModelSelection(value: unknown): ModelSelection | undefined {
  if (!value || typeof value !== "object") return undefined
  const v = value as Record<string, unknown>
  const id = typeof v.id === "string" ? v.id.trim() : ""
  const provider = typeof v.provider === "string" ? v.provider.trim() : ""
  if (!id || !provider) return undefined
  const allowedProviders = new Set(["xAI", "OpenRouter", "Google"])
  if (!allowedProviders.has(provider)) return undefined
  return {
    id,
    provider,
    name: typeof v.name === "string" ? v.name : undefined,
  }
}

function parseQuality(value: unknown): BuilderOptions["quality"] {
  if (value === "fast" || value === "best") return value
  return undefined
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
      quality?: unknown
    }
    const prompt = body.prompt?.trim()

    if (!prompt) {
      return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
    }

    const opts: BuilderOptions = {
      model: parseModelSelection(body.model),
      quality: parseQuality(body.quality),
      projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    }

    const result = await runAIWebsiteBuilder(prompt, opts)

    let savedPages = 0
    let savedFileNames: string[] = []
    if (body.projectId) {
      const saved = await saveGeneratedFilesToProject(session.user.id, body.projectId, result.files)
      savedPages = saved.saved
      savedFileNames = saved.files.map((f) => f.path)
    }

    const routeSummary = result.manifest.pages.map((p) => p.path).join(", ")
    const buildOk = result.build.ok
    const message = buildOk
      ? `Generated ${result.manifest.pages.length} polished pages: ${routeSummary}`
      : `Generated ${result.manifest.pages.length} pages with ${result.build.errors.length} build issue(s): ${routeSummary}`

    return NextResponse.json({
      message,
      manifest: result.manifest,
      files: result.files,
      savedPages,
      savedFileNames,
      build: result.build,
      logs: result.logs,
      warnings: result.warnings,
      qualityScore: result.qualityScore,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message: "Builder failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
