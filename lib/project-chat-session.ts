import {
  getOwnedProject,
  getStoredProjectId,
  normalizeProjectId,
  ownedProjectMutationFilter,
} from "@/lib/project-id"

export const PROJECT_CHAT_SESSIONS_COLLECTION = "project_chat_sessions"

export interface ProjectChatSession {
  _id: string
  userId: string
  projectId: string
  id: string
  title: string
  messages: unknown[]
  model?: string
  createdAt: string
  updatedAt: string
}

export { normalizeProjectId, getOwnedProject } from "@/lib/project-id"

export function buildProjectChatSessionId(userId: string, projectId: string) {
  return `${userId}:${normalizeProjectId(projectId)}`
}

export function buildChatSessionId(projectId: string) {
  return `project_${projectId}`
}

export function toChatSessionSummary(session: ProjectChatSession | null | undefined) {
  if (!session) return null
  return {
    id: session.id,
    title: session.title || "Syra Chat",
    messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    model: session.model,
  }
}

export async function loadProjectChatSession(
  db: any,
  userId: string,
  projectId: string,
): Promise<ProjectChatSession | null> {
  const normalizedProjectId = normalizeProjectId(projectId)

  const stored = await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).findOne({
    userId,
    projectId: normalizedProjectId,
  })

  if (stored) {
    return stored as ProjectChatSession
  }

  // Legacy fallback: session embedded on the project document.
  const project = await getOwnedProject(db, userId, normalizedProjectId)
  const legacy = project?.chatSession as Partial<ProjectChatSession> & {
    messages?: unknown[]
  } | undefined

  if (!legacy || !Array.isArray(legacy.messages) || legacy.messages.length === 0) {
    return null
  }

  const now = new Date().toISOString()
  const migrated: ProjectChatSession = {
    _id: buildProjectChatSessionId(userId, normalizedProjectId),
    userId,
    projectId: normalizedProjectId,
    id: legacy.id || buildChatSessionId(normalizedProjectId),
    title: legacy.title || "Syra Chat",
    messages: legacy.messages,
    model: legacy.model,
    createdAt: typeof legacy.createdAt === "string" ? legacy.createdAt : now,
    updatedAt: typeof legacy.updatedAt === "string" ? legacy.updatedAt : now,
  }

  await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).updateOne(
    { userId, projectId: normalizedProjectId },
    { $set: migrated },
    { upsert: true },
  )

  return migrated
}

export async function loadProjectChatSummariesForUser(db: any, userId: string) {
  const sessions = await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).find({ userId }).toArray()
  return new Map<string, ReturnType<typeof toChatSessionSummary>>(
    (sessions as ProjectChatSession[]).map((session) => [
      normalizeProjectId(session.projectId),
      toChatSessionSummary(session),
    ]),
  )
}

export async function saveProjectChatSession(
  db: any,
  userId: string,
  projectId: string,
  payload: { messages?: unknown[]; title?: string; model?: string },
): Promise<ProjectChatSession> {
  const normalizedProjectId = normalizeProjectId(projectId)
  const existing = await loadProjectChatSession(db, userId, normalizedProjectId)
  const now = new Date().toISOString()

  const chatSession: ProjectChatSession = {
    _id: buildProjectChatSessionId(userId, normalizedProjectId),
    userId,
    projectId: normalizedProjectId,
    id: existing?.id ?? buildChatSessionId(normalizedProjectId),
    title:
      typeof payload.title === "string" && payload.title.trim()
        ? payload.title.trim()
        : existing?.title ?? "Syra Chat",
    messages: payload.messages !== undefined ? payload.messages : (existing?.messages ?? []),
    model: typeof payload.model === "string" ? payload.model : existing?.model,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }

  await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).updateOne(
    { userId, projectId: normalizedProjectId },
    { $set: chatSession },
    { upsert: true },
  )

  // Best-effort lightweight summary on the project doc for older list views.
  try {
    const project = await getOwnedProject(db, userId, normalizedProjectId)
    if (project) {
      await db.collection("users").updateOne(
        ownedProjectMutationFilter(userId, project),
        {
          $set: {
            "projects.$.chatSession": {
              id: chatSession.id,
              title: chatSession.title,
              messageCount: chatSession.messages.length,
              updatedAt: chatSession.updatedAt,
              createdAt: chatSession.createdAt,
            },
            "projects.$.updatedAt": now,
          },
        },
      )
    }
  } catch (err) {
    console.warn("[project-chat-session] Failed to update project summary:", err)
  }

  return chatSession
}

export async function deleteProjectChatSession(db: any, userId: string, projectId: string) {
  const normalizedProjectId = normalizeProjectId(projectId)
  await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).deleteOne({
    userId,
    projectId: normalizedProjectId,
  })

  try {
    const project = await getOwnedProject(db, userId, normalizedProjectId)
    if (project) {
      await db.collection("users").updateOne(
        ownedProjectMutationFilter(userId, project),
        {
          $set: {
            "projects.$.chatSession": null,
            "projects.$.updatedAt": new Date().toISOString(),
          },
        },
      )
    }
  } catch (err) {
    console.warn("[project-chat-session] Failed to clear project summary:", err)
  }
}
