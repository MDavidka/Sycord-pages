/**
 * Syte workspace lifecycle for Sycord projects (Torso DB).
 *
 * Per https://sycord.site/api/ the platform calls POST /api/create_project first
 * to obtain a workspace UUID before execute_command, write_file, start_preview,
 * or issue_deploy. Preview uses start_preview only — deploy is separate.
 */

import {
  getStoredProjectId,
  getOwnedProject,
  ownedProjectUpdateFilter,
} from "@/lib/project-id"
import { toDeployAppName } from "@/lib/deploy/coolify-client"
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

/** Stable Syte workspace id aligned with production hostname (e.g. testervan-b474ea). */
export function resolveCanonicalSyteUuid(project: any, projectId: string): string {
  const name =
    project?.businessName ||
    project?.name ||
    `sycord-${projectId.slice(0, 8)}`
  return toDeployAppName(name, projectId)
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

function buildCreateProjectPayload(
  project: any,
  projectId: string,
  options?: { domain?: string },
): Parameters<typeof syteCreateProject>[0] {
  const name =
    project?.businessName ||
    project?.name ||
    `sycord-${projectId.slice(0, 8)}`

  const domain =
    options?.domain?.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "") ||
    (typeof project?.domain === "string"
      ? project.domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
      : "")

  const githubUrl =
    typeof project?.githubUrl === "string" && project.githubUrl.trim()
      ? project.githubUrl.trim()
      : ""
  const gitUrl = githubUrl
    ? githubUrl.endsWith(".git")
      ? githubUrl
      : `${githubUrl}.git`
    : undefined

  const branch =
    (typeof project?.githubBranch === "string" && project.githubBranch.trim()) || "main"

  return {
    name,
    uuid: resolveCanonicalSyteUuid(project, projectId),
    deploy: false,
    env_vars: getProjectEnvVars(project),
    ...(domain ? { domain } : {}),
    ...(gitUrl ? { git_url: gitUrl, branch } : {}),
  }
}

/** Load project doc from Torso. */
export async function loadOwnedProjectDoc(
  db: { collection: (name: string) => any },
  userId: string,
  projectId: string,
) {
  return getOwnedProject(db, userId, projectId)
}

async function findExistingSyteUuid(
  project: any,
  projectId: string,
): Promise<string | null> {
  const candidates = [
    getStoredSyteUuid(project),
    resolveCanonicalSyteUuid(project, projectId),
  ].filter((value, index, list): value is string => {
    if (!value) return false
    return list.indexOf(value) === index
  })

  for (const candidate of candidates) {
    const existing = await syteWorkspaceGet(candidate)
    if (existing.ok) return candidate
  }

  return null
}

/**
 * POST /api/create_project — ensures workspace exists on Syte using saved Torso details.
 * Persists the returned UUID on the Sycord project document.
 */
export async function createSyteWorkspaceForProject(
  db: { collection: (name: string) => any },
  userId: string,
  projectId: string,
  project: any,
  options?: { domain?: string },
): Promise<SyteResult<SyteWorkspaceInfo>> {
  // Fast path: if a UUID is already stored (saved by syteProjectConnect at project creation),
  // trust it directly. The new /sycord/api/project_connect API and the old /api/workspace_get
  // live in different namespaces on the Syte server, so calling workspace_get on a
  // project_connect UUID always returns 404 and incorrectly falls through to re-create.
  const storedUuid = getStoredSyteUuid(project)
  if (storedUuid) {
    return {
      ok: true,
      status: 200,
      data: { uuid: storedUuid, status: "existing" },
      error: null,
      endpoint: "",
    }
  }

  // No stored UUID — try the legacy find-or-create path.
  const existingUuid = await findExistingSyteUuid(project, projectId)
  if (existingUuid) {
    if (getStoredSyteUuid(project) !== existingUuid) {
      const storedProjectId = getStoredProjectId(project)
      await db.collection("users").updateOne(ownedProjectUpdateFilter(userId, storedProjectId), {
        $set: {
          "projects.$.syteWorkspaceUuid": existingUuid,
          "projects.$.deploymentMode": "syte",
          "projects.$.updatedAt": new Date(),
        },
      })
    }
    return {
      ok: true,
      status: 200,
      data: { uuid: existingUuid, status: "existing" },
      error: null,
      endpoint: "",
    }
  }

  const payload = buildCreateProjectPayload(project, projectId, options)
  const created = await syteCreateProject(payload)

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
  if (payload.domain) {
    $set["projects.$.domain"] = payload.domain
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
  projectId?: string,
): Promise<{ uuid: string } | { error: string; needsCreate: true }> {
  // Trust a stored UUID directly — it was saved by our own code (syteProjectConnect).
  // Do not call syteWorkspaceGet: workspaces created via the new /sycord/api/ live in
  // a different namespace than the old /api/workspace_get, causing spurious 404s.
  const stored = getStoredSyteUuid(project)
  if (stored) {
    return { uuid: stored }
  }

  // Try the canonical UUID via the legacy workspace_get as a fallback.
  if (projectId) {
    const canonical = resolveCanonicalSyteUuid(project, projectId)
    const existing = await syteWorkspaceGet(canonical)
    if (existing.ok) return { uuid: canonical }
  }

  return {
    error:
      "No Syte workspace UUID yet. Open Preview — the platform creates the workspace automatically.",
    needsCreate: true,
  }
}
