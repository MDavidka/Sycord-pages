import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import {
  runAIWebsiteBuilder,
  type BuilderOptions,
  type EnvVarRequirement,
  type ProjectContext,
} from "@/lib/ai-website-builder"
import type { ModelSelection } from "@/lib/ai-provider"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { classifySentryIssuesSequentially } from "@/lib/sentry-ai"
import { createUnclassifiedSentryIssue, extractAiGenerationIssues, type SentryIssue } from "@/lib/sentry-log-parser"

interface GeneratedFile {
  path: string
  content: string
}

// Host-project record fields we care about. The DB doc may have extra
// fields; we only read the ones the builder needs.
interface ProjectDoc {
  _id: ObjectId
  businessName?: string
  businessDescription?: string
  profileImage?: string
  category?: string
  subdomain?: string
  style?: string
  envVars?: { key: string; value?: string; integration?: string | null }[]
  integrations?: { name: string; provider?: string }[]
}

// Anything inside `.sycord/` is debug-only. Lockfiles and other non-source
// JSON we never plan to emit are skipped here as well so deployments stay lean.
function isDeployableFilePath(filePath: string) {
  if (!filePath || filePath.startsWith(".sycord/")) return false
  if (/^\.env(?:\.|$)/.test(filePath) || /\/\.env(?:\.|$)/.test(filePath)) return false
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
  const envFile = files.find((file) => /^\.env(?:\.|$)/.test(file.path) || /\/\.env(?:\.|$)/.test(file.path))
  if (envFile) {
    throw new Error(`Generated env file is not allowed: ${envFile.path}`)
  }

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
        "projects.$.deploymentMode": readDeploymentMode(files),
        "projects.$.updatedAt": new Date(),
      },
    },
  )

  if (result.matchedCount === 0) {
    throw new Error("Project not found")
  }

  return { saved: normalizedPages.length, files: deployable }
}

function readDeploymentMode(files: GeneratedFile[]): "next-server" {
  const manifestFile = files.find((file) => file.path === "lib/generated-manifest.ts")
  if (manifestFile) {
    const match = manifestFile.content.match(/generatedManifest\s*=\s*({[\s\S]*?})\s+as const/)
    if (match) {
      try {
        const manifest = JSON.parse(match[1]) as { deploymentMode?: unknown }
        if (manifest.deploymentMode === "next-server") return "next-server"
      } catch {
        // Fall through to file detection.
      }
    }
  }
  return "next-server"
}

// Validate the model JSON the client sends. Anything malformed is dropped
// (the builder's own fallbacks pick a reasonable model).
function parseModelSelection(value: unknown): ModelSelection | undefined {
  if (!value || typeof value !== "object") return undefined
  const v = value as Record<string, unknown>
  const id = typeof v.id === "string" ? v.id.trim() : ""
  const provider = typeof v.provider === "string" ? v.provider.trim() : ""
  if (!id || !provider) return undefined
  const allowedProviders = new Set(["xAI", "OpenRouter", "Google", "DeepSeek"])
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

// Load the project for a user and return both the raw doc (for env-merge)
// and the builder's ProjectContext view (branding + existing env keys).
async function loadProjectContext(
  userId: string,
  projectId: string,
): Promise<{ doc: ProjectDoc | null; context: ProjectContext | undefined }> {
  if (!ObjectId.isValid(projectId)) return { doc: null, context: undefined }
  const client = await clientPromise
  const db = client.db()
  const userDoc = await db.collection("users").findOne({ id: userId })
  if (!userDoc || !Array.isArray(userDoc.projects)) return { doc: null, context: undefined }
  const project = userDoc.projects.find(
    (p: { _id?: ObjectId }) => p._id?.toString() === projectId,
  ) as ProjectDoc | undefined
  if (!project) return { doc: null, context: undefined }
  const envVars = Array.isArray(project.envVars) ? project.envVars : []
  const envVarKeys = envVars
    .map((e) => e.key)
    .filter((k): k is string => typeof k === "string" && k.length > 0)
  // Connected integration IDs = the set of `integration` fields from
  // envVars (that's how the Sycord dashboard tracks "Connected"). This is
  // the whitelist the builder uses to decide which integration code is
  // allowed to be generated.
  const connectedIntegrationIds = Array.from(
    new Set(
      envVars
        .map((e) => (typeof e.integration === "string" ? e.integration : null))
        .filter((id): id is string => !!id && id.length > 0),
    ),
  )
  const context: ProjectContext = {
    name: project.businessName,
    description: project.businessDescription,
    category: project.category,
    logoUrl: project.profileImage,
    subdomain: project.subdomain,
    envVarKeys,
    envVars,
    integrations: Array.isArray(project.integrations) ? project.integrations : [],
    connectedIntegrationIds,
  }
  return { doc: project, context }
}

// Merge the builder's required env vars into the project's stored envVars
// array. We NEVER overwrite existing values. Missing keys get appended —
// with the value from server env (process.env.X) if available, otherwise
// an empty string that the user must fill in via the env settings UI.
async function mergeRequiredEnvVars(
  userId: string,
  projectId: string,
  doc: ProjectDoc | null,
  required: EnvVarRequirement[],
): Promise<number> {
  if (!doc || required.length === 0) return 0
  const existing = new Set((doc.envVars ?? []).map((e) => e.key))
  const toAdd = required
    .filter((r) => r.required && !existing.has(r.key))
    .map((r) => {
      const serverValue = process.env[r.key]
      return {
        key: r.key,
        value: typeof serverValue === "string" && serverValue.length > 0 ? serverValue : "",
        integration: r.integration ?? null,
        addedAt: new Date(),
        source: "ai-builder",
        purpose: r.purpose,
      }
    })
  if (toAdd.length === 0) return 0
  const client = await clientPromise
  const db = client.db()
  await db.collection("users").updateOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    {
      $push: {
        "projects.$.envVars": { $each: toAdd },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    },
  )
  return toAdd.length
}

async function saveAiGenerationSentryIssues(userId: string, projectId: string, extractedIssues: ReturnType<typeof extractAiGenerationIssues>) {
  if (!ObjectId.isValid(projectId) || extractedIssues.length === 0) return
  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    { projection: { "projects.$": 1 } },
  )
  const project = Array.isArray(user?.projects) ? user.projects[0] : null
  const existingHashes = new Set(
    Array.isArray(project?.sentryIssues)
      ? project.sentryIssues.map((issue: { logHash?: string }) => issue.logHash).filter(Boolean)
      : [],
  )
  const newIssues = extractedIssues
    .filter((issue) => !existingHashes.has(issue.logHash))
    .map((issue) => createUnclassifiedSentryIssue({ projectId, ...issue }))

  if (newIssues.length === 0) return
  const classified = await classifySentryIssuesSequentially(newIssues as SentryIssue[])
  await db.collection("users").updateOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    {
      $push: {
        "projects.$.sentryIssues": { $each: classified },
      },
      $set: {
        "projects.$.updatedAt": new Date(),
      },
    } as any,
  )
}

// Defensive redaction for legacy generated files. New builder output never
// emits `.env`; deploy env vars come from project settings/server env only.
function redactEnvFiles(files: GeneratedFile[]): GeneratedFile[] {
  return files.map((f) => {
    if (f.path !== ".env") return f
    const redacted = f.content
      .split("\n")
      .map((line) => {
        const m = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
        if (!m) return line
        const [, key, value] = m
        if (!value) return line
        return `${key}=***`
      })
      .join("\n")
    return { path: f.path, content: redacted }
  })
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: {
    prompt?: string
    projectId?: string
    model?: unknown
    quality?: unknown
  } = {}

  try {
    body = (await req.json().catch(() => ({}))) as {
      prompt?: string
      projectId?: string
      model?: unknown
      quality?: unknown
    }
    const prompt = body.prompt?.trim()

    if (!prompt) {
      return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
    }

    const projectId = typeof body.projectId === "string" ? body.projectId : undefined
    const { doc: projectDoc, context: projectContext } = projectId
      ? await loadProjectContext(session.user.id, projectId)
      : { doc: null, context: undefined }

    const opts: BuilderOptions = {
      model: parseModelSelection(body.model),
      quality: parseQuality(body.quality),
      projectId,
      project: projectContext,
    }

    const result = await runAIWebsiteBuilder(prompt, opts)

    let savedPages = 0
    let savedFileNames: string[] = []
    if (projectId) {
      const saved = await saveGeneratedFilesToProject(session.user.id, projectId, result.files)
      savedPages = saved.saved
      savedFileNames = saved.files.map((f) => f.path)
    }

    // Merge required env vars into the project record so the deploy route
    // can see them later.
    let envVarsAdded = 0
    if (projectId && projectDoc && result.requiredEnvVars.length > 0) {
      envVarsAdded = await mergeRequiredEnvVars(
        session.user.id,
        projectId,
        projectDoc,
        result.requiredEnvVars,
      )
    }

    const routeSummary = result.manifest.pages.map((p) => p.path).join(", ")
    const buildOk = result.build.ok
    const dbMsg = result.needsDatabase ? " (Turso database required)" : ""
    const message = buildOk
      ? `Generated ${result.manifest.pages.length} polished pages: ${routeSummary}${dbMsg}`
      : `Generated ${result.manifest.pages.length} pages with ${result.build.errors.length} build issue(s): ${routeSummary}${dbMsg}`

    // Redact any legacy secret file values from files we send back to the UI.
    const safeFiles = redactEnvFiles(result.files)

    if (projectId) {
      await saveAiGenerationSentryIssues(
        session.user.id,
        projectId,
        extractAiGenerationIssues({
          projectId,
          buildErrors: result.build.ok ? [] : result.build.errors,
          warnings: result.warnings,
          logs: result.logs,
        }),
      )
    }

    return NextResponse.json({
      message,
      manifest: result.manifest,
      files: safeFiles,
      savedPages,
      savedFileNames,
      build: result.build,
      logs: result.logs,
      warnings: result.warnings,
      qualityScore: result.qualityScore,
      needsDatabase: result.needsDatabase,
      databaseProvider: result.databaseProvider,
      integrations: result.integrations,
      requiredEnvVars: result.requiredEnvVars,
      missingEnvVars: result.missingEnvVars,
      unconnectedIntegrations: result.unconnectedIntegrations,
      deploymentMode: result.deploymentMode,
      envVarsAdded,
    })
  } catch (error) {
    const failedProjectId = typeof body.projectId === "string" ? body.projectId : undefined
    if (failedProjectId) {
      await saveAiGenerationSentryIssues(
        session.user.id,
        failedProjectId,
        extractAiGenerationIssues({
          projectId: failedProjectId,
          failedError: error instanceof Error ? error.stack || error.message : String(error),
        }),
      )
    }
    return NextResponse.json(
      {
        message: "Builder failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
