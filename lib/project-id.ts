/**
 * Shared helpers for resolving a user's project by id from URL params.
 *
 * Projects may store `_id` as a string (new projects) or a MongoDB ObjectId
 * (legacy). Direct queries like `{ "projects._id": id }` fail when the types
 * do not match, so we load the user doc and compare via `.toString()`.
 */

export function normalizeProjectId(projectId: string): string {
  return String(projectId ?? "").trim()
}

export function projectIdsMatch(storedId: unknown, requestedId: string): boolean {
  const normalized = normalizeProjectId(requestedId)
  if (!normalized) return false
  if (storedId == null) return false
  return String(storedId) === normalized
}

export async function getOwnedProject(
  db: { collection: (name: string) => any },
  userId: string,
  projectId: string,
): Promise<any | null> {
  const normalizedProjectId = normalizeProjectId(projectId)
  if (!normalizedProjectId) return null

  const user = await db.collection("users").findOne(
    { id: userId },
    { projection: { projects: 1 } },
  )
  if (!user?.projects) return null

  return (
    user.projects.find(
      (project: any) =>
        projectIdsMatch(project?._id, normalizedProjectId) ||
        projectIdsMatch(project?.id, normalizedProjectId),
    ) ?? null
  )
}

/** The `_id` value stored on the project document (ObjectId or string). */
export function getStoredProjectId(project: { _id?: unknown }): unknown {
  return project?._id
}

/** Mongo filter for positional `$` updates on a user's projects array. */
export function ownedProjectUpdateFilter(userId: string, storedProjectId: unknown) {
  return {
    id: userId,
    "projects._id": storedProjectId,
  }
}
