import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import type {
  ProjectLoadResult,
  ProjectMemory,
  BuildHistoryEntry,
  GeneratedFile,
  Intent,
} from "@/lib/ai/types"
import { buildProjectMemory, contentHash } from "@/lib/ai/memory"
import { memoryCache, cacheKey } from "@/lib/ai/cache"

const HISTORY_MAX = 50

export async function loadProjectForUser(userId: string, projectId: string): Promise<ProjectLoadResult> {
  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne(
    { id: userId, projects: { $elemMatch: { _id: new ObjectId(projectId) } } },
    { projection: { projects: 1 } },
  )
  if (!user?.projects?.[0]) {
    throw new Error(`Project ${projectId} not found for user ${userId}`)
  }
  const project = user.projects[0]
  const pages = (project.pages || []).map((p: any) => ({
    name: p.name,
    content: p.content || p.code || "",
    usedFor: p.usedFor || "",
    updatedAt: p.updatedAt ? new Date(p.updatedAt).toISOString() : new Date().toISOString(),
  }))
  const aiMemory = project.aiMemory || null
  const buildHistory = (project.buildHistory || []).slice(0, HISTORY_MAX)
  const aiRevision = project.aiRevision || 0
  const lastBuildError = project.lastBuildError || null
  const lastDeployError = project.lastDeployError || null
  const deploymentRuntime = project.deploymentRuntime || null
  const pageHashes = pages.map((p: { name: string; content: string; updatedAt: string }) => contentHash(p.name + p.content + p.updatedAt)).join("|")
  const revisionHash = contentHash(pageHashes + aiRevision)
  return {
    projectId,
    userId,
    project,
    pages,
    aiMemory,
    buildHistory,
    aiRevision,
    lastBuildError,
    lastDeployError,
    deploymentRuntime,
    revisionHash,
  }
}

export async function saveGeneratedSnapshot(
  userId: string,
  projectId: string,
  input: {
    files: GeneratedFile[]
    deleteFiles?: string[]
    moveFiles?: Array<{ from: string; to: string }>
    mode: Intent
    prompt: string
    model: string
    provider: string
    duration: number
    diagnostics: string[]
    cacheHits: number
    repairPasses: number
  },
): Promise<{ pages: Array<{ name: string; content: string; usedFor: string }> }> {
  const client = await clientPromise
  const db = client.db()
  const now = new Date()
  const filesToSave = input.files.filter(f => f.action === "upsert")
  const filesToDelete = [...(input.deleteFiles || []), ...input.files.filter(f => f.action === "delete").map(f => f.name)]
  const filesToMove = input.moveFiles || []
  const savedPages: Array<{ name: string; content: string; usedFor: string }> = []
  for (const file of filesToSave) {
    const updateResult = await db.collection("users").updateOne(
      {
        id: userId,
        projects: { $elemMatch: { _id: new ObjectId(projectId), "pages.name": file.name } },
      },
      {
        $set: {
          "projects.$[proj].pages.$[pg].content": file.content,
          "projects.$[proj].pages.$[pg].usedFor": file.usedFor,
          "projects.$[proj].pages.$[pg].updatedAt": now,
        },
      },
      { arrayFilters: [{ "proj._id": new ObjectId(projectId) }, { "pg.name": file.name }] },
    )
    if (updateResult.matchedCount === 0) {
      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        { $push: { "projects.$.pages": { name: file.name, content: file.content, usedFor: file.usedFor, createdAt: now, updatedAt: now } } as any },
      )
    }
    savedPages.push({ name: file.name, content: file.content, usedFor: file.usedFor })
  }
  for (const name of filesToDelete) {
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $pull: { "projects.$.pages": { name } } as any },
    )
  }
  for (const move of filesToMove) {
    const src = savedPages.find(p => p.name === move.from)
    if (src) {
      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        { $pull: { "projects.$.pages": { name: move.from } } as any },
      )
      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        { $push: { "projects.$.pages": { name: move.to, content: src.content, usedFor: src.usedFor, createdAt: now, updatedAt: now } } as any },
      )
      savedPages.push({ name: move.to, content: src.content, usedFor: src.usedFor })
    }
  }
  const currentPages = savedPages.length > 0 ? savedPages : []
  const memory = buildProjectMemory(
    currentPages.map(p => ({ name: p.name, content: p.content, usedFor: p.usedFor, action: "upsert" as const })),
    contentHash(currentPages.map(p => p.name + p.content).join("|")),
    null,
    [input.prompt],
    input.diagnostics,
  )
  await db.collection("users").updateOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    {
      $set: {
        "projects.$.aiMemory": memory,
        "projects.$.aiRevision": { $inc: 1 },
        "projects.$.lastBuildError": input.diagnostics.length > 0 ? input.diagnostics.join("\n") : null,
      },
    } as any,
  )
  const cacheKeyStr = cacheKey(userId, projectId, "memory", memory.revision)
  memoryCache.set(cacheKeyStr, memory, 5 * 60 * 1000)
  return { pages: savedPages }
}

export async function saveBuildHistory(
  userId: string,
  projectId: string,
  entry: BuildHistoryEntry,
): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne({ id: userId })
    if (!user) return
    const proj = user.projects?.find((p: any) => p._id.toString() === projectId)
    if (!proj) return
    const h = (proj.buildHistory || []) as BuildHistoryEntry[]
    h.unshift(entry)
    if (h.length > HISTORY_MAX) h.length = HISTORY_MAX
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $set: { "projects.$.buildHistory": h } },
    )
  } catch {
    // Non-critical failure
  }
}

export async function saveAiMemory(
  userId: string,
  projectId: string,
  memory: ProjectMemory,
): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db()
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $set: { "projects.$.aiMemory": memory } },
    )
    const cacheKeyStr = cacheKey(userId, projectId, "memory", memory.revision)
    memoryCache.set(cacheKeyStr, memory, 5 * 60 * 1000)
  } catch {
    // Non-critical failure
  }
}

export async function saveBuildError(
  userId: string,
  projectId: string,
  error: string,
): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db()
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $set: { "projects.$.lastBuildError": error } },
    )
  } catch {
    // Non-critical failure
  }
}
