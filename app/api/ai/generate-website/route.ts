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
// JSON we never plan to emit are skipped here as well so deployments stay
// lean. `package.json` and `tsconfig.json` are explicitly allowed because
// the static-export deployer needs both.
function isDeployableFilePath(filePath: string) {
  if (!filePath || filePath.startsWith(".sycord/")) return false
  const lower = filePath.toLowerCase()
  if (lower === ".env" || lower === ".env.local" || lower === ".env.production" || lower.startsWith(".env.")) return false
  if (filePath.endsWith(".json")) {
    return filePath === "package.json" || filePath === "tsconfig.json"
  }
  return true
}

interface SaveResult {
  saved: number
  files: GeneratedFile[]
}


function validateNoSecretFileContent(files: GeneratedFile[], projectEnvVars: ProjectDoc["envVars"] = []): void {
  const knownValues = new Set<string>()
  for (const ev of projectEnvVars ?? []) {
    if (typeof ev?.value === "string" && ev.value.trim().length > 0) knownValues.add(ev.value.trim())
  }
  for (const key of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]) {
    const v = process.env[key]
    if (typeof v === "string" && v.trim().length > 0) knownValues.add(v.trim())
  }

  for (const file of files) {
    const pathLower = file.path.toLowerCase()
    if (pathLower === ".env" || pathLower === ".env.local" || pathLower === ".env.production" || pathLower.startsWith(".env.")) {
      throw new Error(`Forbidden generated file: ${file.path}. Environment files are not allowed in generated output.`)
    }
    const content = file.content || ""
    if (/TURSO_AUTH_TOKEN\s*=/.test(content) || /TURSO_DATABASE_URL\s*=/.test(content)) {
      throw new Error(`Forbidden secret assignment found in ${file.path}. Secrets must only be injected at deploy time.`)
    }
    for (const value of knownValues) {
      if (value && content.includes(value)) {
        throw new Error(`Potential secret leak detected in ${file.path}.`)
      }
    }
  }
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

// Redact secret values out of files we return to the UI. The `.env` file
// is saved to MongoDB with real values (so the deployer can use them),
// but we never echo the values back to the browser.
function redactEnvFiles(files: GeneratedFile[]): GeneratedFile[] {
  return files.filter((f) => !/^\.env(\.|$)/i.test(f.path)).map((f) => {
    if (!/^\.env(\.|$)/i.test(f.path)) return f
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
    validateNoSecretFileContent(result.files, projectDoc?.envVars)

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

    // Redact any real secret values from files we send back to the UI.
    // MongoDB already has the real values stored under projects.$.pages.
    const safeFiles = redactEnvFiles(result.files)

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
      envVarsAdded,
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
