import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import type { GeneratedFile, BuildHistoryEntry, ProjectMemory, Diagnostic } from "./types"
import { computeContentHash } from "./cache"

export async function loadProjectForUser(userId: string, projectId: string) {
  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne(
    { id: userId, projects: { $elemMatch: { _id: new ObjectId(projectId) } } },
    { projection: { "projects.$": 1 } }
  )
  if (!user?.projects?.[0]) return null
  return user.projects[0] as Record<string, unknown> & {
    _id: ObjectId
    pages?: Array<{name: string; content: string; usedFor?: string; createdAt?: string; updatedAt?: string}>
    buildHistory?: Array<Record<string, unknown>>
    aiMemory?: ProjectMemory | null
    lastBuildError?: string | null
    lastBuildStatus?: string | null
    deploymentRuntime?: Record<string, unknown> | null
  }
}

export async function loadPages(userId: string, projectId: string): Promise<GeneratedFile[]> {
  const project = await loadProjectForUser(userId, projectId)
  if (!project) return []
  return (project.pages || []).map((p) => ({
    name: p.name,
    content: p.content || "",
    usedFor: p.usedFor || "",
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
    contentHash: computeContentHash(p.content || ""),
    size: (p.content || "").length,
  }))
}

export async function saveGeneratedSnapshot(
  userId: string,
  projectId: string,
  pages: GeneratedFile[],
) {
  const client = await clientPromise
  const db = client.db()

  const now = new Date()

  for (const page of pages) {
    const updateResult = await db.collection("users").updateOne(
      {
        id: userId,
        projects: {
          $elemMatch: {
            _id: new ObjectId(projectId),
            "pages.name": page.name,
          },
        },
      },
      {
        $set: {
          "projects.$[proj].pages.$[pg].content": page.content,
          "projects.$[proj].pages.$[pg].usedFor": page.usedFor || "",
          "projects.$[proj].pages.$[pg].updatedAt": now,
        },
      },
      {
        arrayFilters: [
          { "proj._id": new ObjectId(projectId) },
          { "pg.name": page.name },
        ],
      }
    )

    if (updateResult.matchedCount === 0) {
      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        {
          $push: {
            "projects.$.pages": {
              name: page.name,
              content: page.content,
              usedFor: page.usedFor || "",
              createdAt: now,
              updatedAt: now,
            },
          } as any,
        }
      )
    }
  }
}

export async function saveBuildHistory(
  userId: string,
  projectId: string,
  entry: BuildHistoryEntry,
) {
  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne({ id: userId })
    if (!user) return
    const proj = user.projects?.find((p: Record<string, unknown>) => p._id?.toString() === projectId)
    if (!proj) return

    const history = (proj.buildHistory || []) as Array<Record<string, unknown>>
    history.unshift(entry as unknown as Record<string, unknown>)
    if (history.length > 50) history.length = 50

    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $set: { "projects.$.buildHistory": history } }
    )
  } catch {
    // silently fail for history
  }
}

export async function saveAiMemory(
  userId: string,
  projectId: string,
  memory: ProjectMemory,
) {
  try {
    const client = await clientPromise
    const db = client.db()
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $set: { "projects.$.aiMemory": memory } }
    )
  } catch (err) {
    console.error("Failed to save AI memory:", err)
    throw err
  }
}

export async function saveBuildError(
  userId: string,
  projectId: string,
  error: string,
) {
  try {
    const client = await clientPromise
    const db = client.db()
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $set: { "projects.$.lastBuildError": error } }
    )
  } catch {
    // silent
  }
}

export async function clearBuildError(
  userId: string,
  projectId: string,
) {
  try {
    const client = await clientPromise
    const db = client.db()
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $unset: { "projects.$.lastBuildError": "" } }
    )
  } catch {
    // silent
  }
}

export async function loadAiMemory(userId: string, projectId: string): Promise<ProjectMemory | null> {
  const project = await loadProjectForUser(userId, projectId)
  return (project?.aiMemory as ProjectMemory) ?? null
}

export async function loadBuildHistory(userId: string, projectId: string): Promise<Array<Record<string, unknown>>> {
  const project = await loadProjectForUser(userId, projectId)
  return (project?.buildHistory as Array<Record<string, unknown>>) ?? []
}

export async function loadLastBuildError(userId: string, projectId: string): Promise<string | null> {
  const project = await loadProjectForUser(userId, projectId)
  return (project?.lastBuildError as string) ?? null
}

export async function loadDeploymentRuntime(userId: string, projectId: string): Promise<Record<string, unknown> | null> {
  const project = await loadProjectForUser(userId, projectId)
  return (project?.deploymentRuntime as Record<string, unknown>) ?? null
}
