/**
 * Syte live preview orchestration (https://sycord.site/api/).
 * Used by /api/workspace/preview and the Syra preview pane.
 */

import {
  pickSytePreviewUrl,
  sytePreviewStatus,
  syteSetDomain,
  syteStartPreview,
  syteSyncProjectFiles,
  syteExecuteCommand,
  syteListFiles,
  type SytePreviewFields,
} from "@/lib/deploy/syte-client"
import {
  createSyteWorkspaceForProject,
  requireSyteWorkspaceUuid,
} from "@/lib/deploy/syte-workspace"
import { getStoredProjectId, ownedProjectMutationFilter } from "@/lib/project-id"
import { projectFiles, type WorkspaceFile } from "@/lib/workspace/sandbox"

export type SytePreviewResult = {
  ok: boolean
  uuid?: string
  previewUrl?: string | null
  previewReady?: boolean
  previewRunning?: boolean
  domainIssued?: boolean
  error?: string
  status?: SytePreviewFields | null
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function normalizeDomain(domain: string): string {
  return domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
}

async function persistProjectDomain(
  db: { collection: (name: string) => any },
  userId: string,
  project: any,
  domain: string,
) {
  const storedProjectId = getStoredProjectId(project)
  const normalized = normalizeDomain(domain)
  await db.collection("users").updateOne(ownedProjectMutationFilter(userId, project), {
    $set: {
      "projects.$.domain": normalized,
      "projects.$.updatedAt": new Date(),
    },
  })
  return normalized
}

/**
 * Check whether node_modules already exists in the workspace.
 * If it does, we skip npm install to avoid blocking preview for 2-5 min
 * on every HMR refresh / mobile preview restart.
 */
async function needsNpmInstall(uuid: string): Promise<boolean> {
  try {
    const result = await syteListFiles(uuid, "app/node_modules")
    // If the directory lists at least one entry, deps are already installed.
    const files = (result.data as any)?.files ?? (result.data as any)?.entries ?? []
    return !result.ok || (Array.isArray(files) && files.length === 0)
  } catch {
    return true
  }
}

/**
 * Ensure workspace exists, sync files, optionally issue set_domain, start_preview,
 * and poll until preview_ready (or timeout).
 *
 * issueDomain defaults to FALSE — set_domain before start_preview overwrites
 * preview_url with the production domain, causing the iframe to show a blank
 * deployed site instead of the live dev server. Only pass issueDomain=true
 * when explicitly setting a custom domain for production.
 */
export async function ensureSyteLivePreview(
  db: { collection: (name: string) => any },
  userId: string,
  projectId: string,
  project: any,
  options?: {
    syncFiles?: boolean
    issueDomain?: boolean
    pollMs?: number
    maxWaitMs?: number
    domain?: string | null
    /** In-memory files from the Syra client — preferred over MongoDB pages when set. */
    clientFiles?: WorkspaceFile[] | null
  },
): Promise<SytePreviewResult> {
  const syncFiles = options?.syncFiles !== false
  // Default issueDomain to FALSE — prevents set_domain from overwriting preview_url
  // with the production domain before start_preview returns the dev-server URL.
  const issueDomain = options?.issueDomain === true
  const pollMs = options?.pollMs ?? 1500
  const maxWaitMs = options?.maxWaitMs ?? 90_000

  // Always ensure via createSyteWorkspaceForProject — validates existing UUID or recreates stale ones.
  const ensured = await createSyteWorkspaceForProject(db, userId, projectId, project, {
    domain:
      typeof options?.domain === "string" && options.domain.trim()
        ? options.domain
        : undefined,
  })
  if (!ensured.ok || !ensured.data?.uuid) {
    return { ok: false, error: ensured.error || "Failed to create Syte workspace" }
  }
  const uuid = ensured.data.uuid

  if (syncFiles) {
    const clientFiles = Array.isArray(options?.clientFiles) ? options.clientFiles : []
    const files = clientFiles.length > 0 ? clientFiles : projectFiles(project)
    if (files.length === 0) {
      return {
        ok: false,
        uuid,
        error: "No project files to sync. Ask Syra to build your app, then open Preview again.",
      }
    }
    const sync = await syteSyncProjectFiles(uuid, files)
    if (sync.errors.length > 0) {
      return {
        ok: false,
        uuid,
        error: `File sync failed: ${sync.errors.slice(0, 2).join("; ")}`,
      }
    }
    if (sync.synced === 0) {
      return {
        ok: false,
        uuid,
        error: "File sync wrote 0 files to Syte workspace.",
      }
    }

    // Only run npm install when node_modules is absent (first sync or cleared workspace).
    // Skipping on subsequent HMR refreshes avoids 2-5 min blocking install on mobile.
    const shouldInstall = await needsNpmInstall(uuid)
    if (shouldInstall) {
      const install = await syteExecuteCommand(
        uuid,
        "npm install --no-audit --no-fund --prefer-offline",
        { cwd: "app", timeout: 300 },
      )
      if (!install.ok) {
        console.warn(`[syte-preview] npm install warning for ${uuid}: ${install.error}`)
      }
    }
  }

  let domainIssued = false
  if (issueDomain) {
    const domainToIssue =
      (typeof options?.domain === "string" && options.domain.trim()) ||
      (typeof project?.domain === "string" && project.domain.trim()) ||
      null
    if (domainToIssue) {
      const normalized = normalizeDomain(domainToIssue)
      const setDomain = await syteSetDomain(uuid, normalized)
      if (setDomain.ok) {
        domainIssued = true
        await persistProjectDomain(db, userId, project, normalized)
      }
    }
  }

  const started = await syteStartPreview(uuid)
  if (!started.ok) {
    return {
      ok: false,
      uuid,
      domainIssued,
      error: started.error || "start_preview failed",
      status: (started.data as SytePreviewFields) || null,
    }
  }

  const startData = (started.data || {}) as SytePreviewFields
  let previewUrl = pickSytePreviewUrl(startData)
  let previewReady = Boolean(startData.preview_ready)
  let previewRunning = Boolean(startData.preview_running)
  let lastStatus: SytePreviewFields | null = startData

  if (previewReady && previewUrl) {
    return { ok: true, uuid, previewUrl, previewReady, previewRunning, domainIssued, status: lastStatus }
  }

  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    await sleep(pollMs)
    const status = await sytePreviewStatus(uuid)
    if (!status.ok) {
      return {
        ok: false,
        uuid,
        domainIssued,
        error: status.error || "preview_status failed",
        previewUrl,
        status: lastStatus,
      }
    }

    lastStatus = (status.data || {}) as SytePreviewFields
    previewReady = Boolean(lastStatus.preview_ready)
    previewRunning = Boolean(lastStatus.preview_running)
    previewUrl = pickSytePreviewUrl(lastStatus) || previewUrl

    if (previewReady && previewUrl) {
      return { ok: true, uuid, previewUrl, previewReady, previewRunning, domainIssued, status: lastStatus }
    }
  }

  if (previewUrl) {
    return {
      ok: true,
      uuid,
      previewUrl,
      previewReady: false,
      previewRunning,
      domainIssued,
      status: lastStatus,
      error: "Preview started but not marked ready yet — showing URL anyway",
    }
  }

  return {
    ok: false,
    uuid,
    domainIssued,
    error: "Preview timed out waiting for preview_ready",
    status: lastStatus,
  }
}

export async function setSyteProjectDomain(
  db: { collection: (name: string) => any },
  userId: string,
  project: any,
  domain: string,
  projectId?: string,
): Promise<{ ok: boolean; uuid?: string; error?: string }> {
  const resolved = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in resolved) {
    return { ok: false, error: resolved.error }
  }

  const normalized = normalizeDomain(domain)
  const result = await syteSetDomain(resolved.uuid, normalized)
  if (!result.ok) {
    return { ok: false, error: result.error || "set_domain failed" }
  }

  await persistProjectDomain(db, userId, project, normalized)
  return { ok: true, uuid: resolved.uuid }
}
