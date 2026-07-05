/**
 * Syte live preview orchestration (https://sycord.site/api/).
 * Used by /api/workspace/preview and the Syra preview pane.
 */

import {
  pickSytePreviewUrl,
  describeSytePreviewUrlSource,
  sytePreviewStatus,
  syteSetDomain,
  syteStartPreview,
  syteSyncProjectFiles,
  syteExecuteCommand,
  type SytePreviewFields,
} from "@/lib/deploy/syte-client"
import {
  createSyteWorkspaceForProject,
  requireSyteWorkspaceUuid,
} from "@/lib/deploy/syte-workspace"
import { getStoredProjectId, ownedProjectUpdateFilter } from "@/lib/project-id"
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

const DEBUG_PREFIX = "[PreviewDebug]"

function logSytePreview(phase: string, data: Record<string, unknown>) {
  console.warn(DEBUG_PREFIX, { scope: "syte-preview", phase, ...data })
}

function logPreviewUrlFromStatus(
  uuid: string,
  status: SytePreviewFields | null | undefined,
  extra?: Record<string, unknown>,
) {
  const picked = describeSytePreviewUrlSource(status)
  logSytePreview("preview_url_picked", {
    uuid,
    previewUrl: picked.url,
    urlSource: picked.source,
    previewReady: Boolean(status?.preview_ready),
    previewRunning: Boolean(status?.preview_running),
    ...extra,
  })
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
  await db.collection("users").updateOne(ownedProjectUpdateFilter(userId, storedProjectId), {
    $set: {
      "projects.$.domain": normalized,
      "projects.$.updatedAt": new Date(),
    },
  })
  return normalized
}

/**
 * Ensure workspace exists, sync files, optionally issue set_domain, start_preview,
 * and poll until preview_ready (or timeout).
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
  const issueDomain = options?.issueDomain !== false
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

    // Run npm install after syncing files so the dev server can resolve
    // all dependencies (Vite + React + HeroUI etc.) before start_preview.
    // Per Syte docs: "Run npm install via execute_command before first preview."
    // We pass --no-audit --no-fund --prefer-offline to keep it fast.
    const install = await syteExecuteCommand(
      uuid,
      "npm install --no-audit --no-fund --prefer-offline",
      { cwd: "app", timeout: 300 },
    )
    if (!install.ok) {
      // Warn but continue — some deps may already be cached from the scaffold
      console.warn(`[syte-preview] npm install warning for ${uuid}: ${install.error}`)
    }
  }

  const domainToIssue =
    (typeof options?.domain === "string" && options.domain.trim()) ||
    (typeof project?.domain === "string" && project.domain.trim()) ||
    null

  let domainIssued = false
  if (issueDomain && domainToIssue) {
    const normalized = normalizeDomain(domainToIssue)
    const setDomain = await syteSetDomain(uuid, normalized)
    if (setDomain.ok) {
      domainIssued = true
      await persistProjectDomain(db, userId, project, normalized)
    }
  }

  const started = await syteStartPreview(uuid)
  if (!started.ok) {
    logSytePreview("start_preview_failed", {
      uuid,
      error: started.error || "start_preview failed",
    })
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
  logPreviewUrlFromStatus(uuid, startData, { stage: "after_start_preview" })
  let previewReady = Boolean(startData.preview_ready)
  let previewRunning = Boolean(startData.preview_running)
  let lastStatus: SytePreviewFields | null = startData

  if (previewReady && previewUrl) {
    logSytePreview("preview_ready", { uuid, previewUrl, previewReady, previewRunning })
    return { ok: true, uuid, previewUrl, previewReady, previewRunning, domainIssued, status: lastStatus }
  }

  logSytePreview("polling_for_ready", { uuid, previewUrl, previewReady, previewRunning, maxWaitMs })

  const deadline = Date.now() + maxWaitMs
  while (Date.now() < deadline) {
    await sleep(pollMs)
    const status = await sytePreviewStatus(uuid)
    if (!status.ok) {
      logSytePreview("preview_status_failed", {
        uuid,
        error: status.error || "preview_status failed",
        previewUrl,
      })
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
      logPreviewUrlFromStatus(uuid, lastStatus, { stage: "poll_ready" })
      logSytePreview("preview_ready", { uuid, previewUrl, previewReady, previewRunning })
      return { ok: true, uuid, previewUrl, previewReady, previewRunning, domainIssued, status: lastStatus }
    }
  }

  if (previewUrl) {
    logPreviewUrlFromStatus(uuid, lastStatus, { stage: "poll_timeout_with_url" })
    logSytePreview("preview_not_ready_yet", {
      uuid,
      previewUrl,
      previewReady: false,
      previewRunning,
      error: "Preview started but not marked ready yet — showing URL anyway",
    })
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

  logSytePreview("preview_timeout_no_url", {
    uuid,
    previewRunning,
    error: "Preview timed out waiting for preview_ready",
  })
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
