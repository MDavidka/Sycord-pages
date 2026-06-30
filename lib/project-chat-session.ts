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

export function buildProjectChatSessionId(userId: string, projectId: string) {
  return `${userId}:${projectId}`
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

export async function getOwnedProject(db: any, userId: string, projectId: string) {
  const user = await db.collection("users").findOne(
    { id: userId, "projects._id": projectId },
    { projection: { "projects.$": 1 } },
  )
  return user?.projects?.[0] ?? null
}

export async function loadProjectChatSession(
  db: any,
  userId: string,
  projectId: string,
): Promise<ProjectChatSession | null> {
  const stored = await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).findOne({
    userId,
    projectId,
  })

  if (stored) {
    return stored as ProjectChatSession
  }

  // Legacy fallback: session embedded on the project document.
  const user = await db.collection("users").findOne(
    { id: userId, "projects._id": projectId },
    { projection: { "projects.$": 1 } },
  )
  const legacy = user?.projects?.[0]?.chatSession as Partial<ProjectChatSession> & {
    messages?: unknown[]
  } | undefined

  if (!legacy || !Array.isArray(legacy.messages) || legacy.messages.length === 0) {
    return null
  }

  const now = new Date().toISOString()
  const migrated: ProjectChatSession = {
    _id: buildProjectChatSessionId(userId, projectId),
    userId,
    projectId,
    id: legacy.id || buildChatSessionId(projectId),
    title: legacy.title || "Syra Chat",
    messages: legacy.messages,
    model: legacy.model,
    createdAt: typeof legacy.createdAt === "string" ? legacy.createdAt : now,
    updatedAt: typeof legacy.updatedAt === "string" ? legacy.updatedAt : now,
  }

  await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).updateOne(
    { userId, projectId },
    { $set: migrated },
    { upsert: true },
  )

  return migrated
}

export async function loadProjectChatSummariesForUser(db: any, userId: string) {
  const sessions = await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).find({ userId }).toArray()
  return new Map<string, ReturnType<typeof toChatSessionSummary>>(
    (sessions as ProjectChatSession[]).map((session) => [session.projectId, toChatSessionSummary(session)]),
  )
}

export async function saveProjectChatSession(
  db: any,
  userId: string,
  projectId: string,
  payload: { messages?: unknown[]; title?: string; model?: string },
): Promise<ProjectChatSession> {
  const existing = await loadProjectChatSession(db, userId, projectId)
  const now = new Date().toISOString()

  const chatSession: ProjectChatSession = {
    _id: buildProjectChatSessionId(userId, projectId),
    userId,
    projectId,
    id: existing?.id ?? buildChatSessionId(projectId),
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
    { userId, projectId },
    { $set: chatSession },
    { upsert: true },
  )

  // Best-effort lightweight summary on the project doc for older list views.
  try {
    await db.collection("users").updateOne(
      { id: userId, "projects._id": projectId },
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
  } catch (err) {
    console.warn("[project-chat-session] Failed to update project summary:", err)
  }

  return chatSession
}

export async function deleteProjectChatSession(db: any, userId: string, projectId: string) {
  await db.collection(PROJECT_CHAT_SESSIONS_COLLECTION).deleteOne({ userId, projectId })

  try {
    await db.collection("users").updateOne(
      { id: userId, "projects._id": projectId },
      {
        $set: {
          "projects.$.chatSession": null,
          "projects.$.updatedAt": new Date().toISOString(),
        },
      },
    )
  } catch (err) {
    console.warn("[project-chat-session] Failed to clear project summary:", err)
  }
}
