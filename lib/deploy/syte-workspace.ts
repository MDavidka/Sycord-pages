/**
 * Syte workspace lifecycle for Sycord projects.
 *
 * Per https://sycord.site/api/ the AI must call POST /api/create_project first
 * to obtain a workspace UUID before execute_command, write_file, or issue_deploy.
 */

import {
  getStoredProjectId,
  getOwnedProject,
  ownedProjectUpdateFilter,
} from "@/lib/project-id"
import {
  syteCreateProject,
  syteWorkspaceGet,
  type SyteResult,
} from "@/lib/deploy/syte-client"
import { getProjectEnvVars } from "@/lib/deploy/runner-client"

export type SyteWorkspaceInfo = {
  uuid: string
  status: "existing" | "created"
  executeCommandBody?: Record<string, unknown>
  issueDeployBody?: Record<string, unknown>
  nextSteps?: string[]
  paths?: Record<string, unknown>
}

export function getStoredSyteUuid(project: { syteWorkspaceUuid?: unknown } | null): string | null {
  const uuid = project?.syteWorkspaceUuid
  if (typeof uuid === "string" && uuid.trim().length > 0) return uuid.trim()
  return null
}

function parseCreateProjectResponse(data: unknown): Omit<SyteWorkspaceInfo, "status"> | null {
  if (!data || typeof data !== "object") return null
  const obj = data as Record<string, any>
  const uuid = typeof obj.uuid === "string" ? obj.uuid.trim() : ""
  if (!uuid) return null

  return {
    uuid,
    executeCommandBody:
      obj.execute_command?.body && typeof obj.execute_command.body === "object"
        ? obj.execute_command.body
        : { uuid, command: "npm install", cwd: "app", timeout: 300 },
    issueDeployBody:
      obj.issue_deploy?.body && typeof obj.issue_deploy.body === "object"
        ? obj.issue_deploy.body
        : { uuid },
    nextSteps: Array.isArray(obj.next_steps) ? obj.next_steps.map(String) : undefined,
    paths: typeof obj.paths === "object" ? obj.paths : undefined,
  }
}

/** Load project doc from MongoDB. */
export async function loadOwnedProjectDoc(
  db: { collection: (name: string) => any },
  userId: string,
  projectId: string,
) {
  return getOwnedProject(db, userId, projectId)
}

/**
 * POST /api/create_project — always the first workspace step.
 * Persists the returned UUID on the Sycord project document.
 */
export async function createSyteWorkspaceForProject(
  db: { collection: (name: string) => any },
  userId: string,
  projectId: string,
  project: any,
  options?: { domain?: string },
): Promise<SyteResult<SyteWorkspaceInfo>> {
  const stored = getStoredSyteUuid(project)
  if (stored) {
    const existing = await syteWorkspaceGet(stored)
    if (existing.ok) {
      return {
        ok: true,
        status: 200,
        data: { uuid: stored, status: "existing" },
        error: null,
        endpoint: existing.endpoint,
      }
    }
  }

  const name =
    project?.businessName ||
    project?.name ||
    `sycord-${projectId.slice(0, 8)}`

  const domain =
    options?.domain?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") ||
    (typeof project?.domain === "string" ? project.domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") : "")

  const created = await syteCreateProject({
    name,
    deploy: false,
    env_vars: getProjectEnvVars(project),
    ...(domain ? { domain } : {}),
  })

  if (!created.ok) {
    return {
      ...created,
      error:
        (created.error || "create_project failed") +
        (created.endpoint ? ` [${created.endpoint}]` : ""),
    } as SyteResult<SyteWorkspaceInfo>
  }

  const parsed = parseCreateProjectResponse(created.data)
  if (!parsed) {
    return {
      ok: false,
      status: created.status,
      data: null,
      error: "create_project succeeded but response had no uuid",
      endpoint: created.endpoint,
    }
  }

  const storedProjectId = getStoredProjectId(project)
  const $set: Record<string, unknown> = {
    "projects.$.syteWorkspaceUuid": parsed.uuid,
    "projects.$.deploymentMode": "syte",
    "projects.$.updatedAt": new Date(),
  }
  if (domain) {
    $set["projects.$.domain"] = domain
  }
  await db.collection("users").updateOne(
    ownedProjectUpdateFilter(userId, storedProjectId),
    { $set },
  )

  return {
    ok: true,
    status: created.status,
    data: { ...parsed, status: "created" },
    error: null,
    endpoint: created.endpoint,
  }
}

/**
 * Resolve the Syte workspace UUID for command execution.
 * Returns an error if createWorkspace has not been called yet.
 */
export async function requireSyteWorkspaceUuid(
  project: any,
): Promise<{ uuid: string } | { error: string; needsCreate: true }> {
  const uuid = getStoredSyteUuid(project)
  if (!uuid) {
    return {
      error:
        "No Syte workspace UUID yet. Call createWorkspace() first — it runs POST /api/create_project and returns the uuid required for execute_command.",
      needsCreate: true,
    }
  }

  const existing = await syteWorkspaceGet(uuid)
  if (!existing.ok) {
    return {
      error:
        `Syte workspace "${uuid}" not found (${existing.error || "404"}). Call createWorkspace() to create a new workspace.`,
      needsCreate: true,
    }
  }

  return { uuid }
}
