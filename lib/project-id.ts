/**
 * Shared helpers for resolving a user's project by id from URL params.
 *
 * Projects may store `_id` as a string (new projects) or a MongoDB ObjectId
 * (legacy). Direct queries like `{ "projects._id": id }` fail when the types
 * do not match, so we load the user doc and compare via `.toString()`.
 *
 * Collaboration: invitees store a lightweight stub with `isCollaborator: true`.
 * Reads and writes are redirected to the original owner's live project.
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

function findProjectInArray(projects: any[] | undefined, projectId: string): any | null {
  if (!Array.isArray(projects)) return null
  return (
    projects.find(
      (project: any) =>
        projectIdsMatch(project?._id, projectId) || projectIdsMatch(project?.id, projectId),
    ) ?? null
  )
}

/**
 * Load a single project stub/entry from a user's embedded projects array.
 * Uses positional projection when the driver supports it so we avoid cloning
 * every sibling project into the returned document.
 */
async function loadLocalProjectEntry(
  db: { collection: (name: string) => any },
  userId: string,
  projectId: string,
): Promise<any | null> {
  const normalizedProjectId = normalizeProjectId(projectId)
  if (!normalizedProjectId) return null

  // Prefer positional projection (projects.$) when $elemMatch can locate the row.
  // Fall back to a full projects projection + in-memory match for legacy id types.
  try {
    const positioned = await db.collection("users").findOne(
      {
        id: userId,
        projects: { $elemMatch: { _id: normalizedProjectId } },
      },
      { projection: { "projects.$": 1 } },
    )
    const hit = positioned?.projects?.[0]
    if (hit) return hit
  } catch {
    // Some adapters may not support $elemMatch + positional projection together.
  }

  const user = await db.collection("users").findOne(
    { id: userId },
    { projection: { projects: 1 } },
  )
  return findProjectInArray(user?.projects, normalizedProjectId)
}

/**
 * Canonical owner user id for mutations. Collaborator stubs redirect writes
 * to `originalOwnerUserId` / `__canonicalOwnerUserId`.
 */
export function getProjectOwnerUserId(project: any, requestingUserId: string): string {
  if (project?.__canonicalOwnerUserId) return String(project.__canonicalOwnerUserId)
  if (project?.isCollaborator && project?.originalOwnerUserId) {
    return String(project.originalOwnerUserId)
  }
  return requestingUserId
}

/**
 * Resolve a project the requesting user can access.
 * Collaborator stubs are replaced with the owner's live project document.
 */
export async function getOwnedProject(
  db: { collection: (name: string) => any },
  userId: string,
  projectId: string,
): Promise<any | null> {
  const normalizedProjectId = normalizeProjectId(projectId)
  if (!normalizedProjectId) return null

  const local = await loadLocalProjectEntry(db, userId, normalizedProjectId)
  if (!local) return null

  if (local.isCollaborator && local.originalOwnerUserId && local.originalProjectId) {
    const ownerUserId = String(local.originalOwnerUserId)
    const originalProjectId = String(local.originalProjectId)
    const live = await loadLocalProjectEntry(db, ownerUserId, originalProjectId)
    if (!live) return null

    return {
      ...live,
      // Preserve collaborator access metadata for ACL / UI.
      isCollaborator: true,
      originalProjectId,
      originalOwnerUserId: ownerUserId,
      originalOwnerName: local.originalOwnerName,
      collaboratorSince: local.collaboratorSince,
      // Local stub id (what the collaborator has in their URL / list).
      accessProjectId: local._id,
      __canonicalOwnerUserId: ownerUserId,
      __accessUserId: userId,
    }
  }

  return local
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

/**
 * Build an update filter that writes to the canonical owner document,
 * even when `requestingUserId` is a collaborator.
 */
export function ownedProjectMutationFilter(requestingUserId: string, project: any) {
  const ownerUserId = getProjectOwnerUserId(project, requestingUserId)
  return ownedProjectUpdateFilter(ownerUserId, getStoredProjectId(project))
}
