// Syte Deployment API client — full workspace access at sycord.site
//
// Docs: https://sycord.site/api/  |  ai.json: https://sycord.site/api/ai.json
// Auth: X-API-Key or Authorization: Bearer (token prefix syte_)
// Env:  DEPLOYER_API_URL (default https://sycord.site) + DEPLOYER_API_KEY

const DEFAULT_SYTE_BASE = "https://sycord.site"

export type SyteResult<T = unknown> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
  endpoint: string
}

export type SyteConfig = {
  apiKey: string
  baseUrl: string
  /** Workspace routes: /api/create_project, /api/start_preview, etc. */
  workspaceBase: string
  /** Docs/meta routes: /api/health, /api/tokens, /api/ai.json */
  docsBase: string
}

export class SyteConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "SyteConfigError"
  }
}

export function getSyteConfig(): SyteConfig {
  const apiKey = process.env.DEPLOYER_API_KEY || ""
  let baseUrl = (process.env.DEPLOYER_API_URL || DEFAULT_SYTE_BASE).replace(/\/+$/, "")
  // Allow DEPLOYER_API_URL=https://sycord.site/api — normalize to host root
  baseUrl = baseUrl.replace(/\/api\/?$/, "")

  if (!apiKey) {
    throw new SyteConfigError(
      "DEPLOYER_API_KEY is not set. Create a token at https://sycord.site/api/ (prefix syte_).",
    )
  }

  return {
    apiKey,
    baseUrl,
    workspaceBase: `${baseUrl}/api`,
    docsBase: `${baseUrl}/api`,
  }
}

export function isSyteConfigured(): boolean {
  return Boolean(process.env.DEPLOYER_API_KEY)
}

/** True when DEPLOYER_API_URL targets the Syte platform (not a self-hosted Coolify). */
export function isSytePlatform(): boolean {
  const url = (process.env.DEPLOYER_API_URL || DEFAULT_SYTE_BASE).toLowerCase()
  if (!process.env.DEPLOYER_API_URL) return true
  return url.includes("sycord.site") || url.includes("syte")
}

/** Prefer Syte workspace when the deployer key is set and URL is the Syte host. */
export function useSyteWorkspace(): boolean {
  return isSyteConfigured() && isSytePlatform()
}

function normalizeSytePath(path: string): string {
  // Paths are relative to workspaceBase (/api) — strip redundant api/ prefix if present.
  return path.replace(/^\/+/, "").replace(/^api\//, "")
}

function buildUrl(base: string, path: string, query?: Record<string, unknown>): string {
  const clean = normalizeSytePath(path)
  const url = new URL(`${base.replace(/\/+$/, "")}/${clean}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function extractError(status: number, body: unknown, endpoint?: string): string {
  if (status === 404 && endpoint && !endpoint.includes("/api/")) {
    return (
      `Endpoint not found (404) at ${endpoint}. ` +
      `Syte workspace routes live under /api/ (e.g. ${endpoint.replace(/\/([^/]+)$/, "/api/$1")}). ` +
      `See https://sycord.site/api/ai.json`
    )
  }
  if (body && typeof body === "object") {
    const obj = body as Record<string, any>
    const detail = obj.detail
    if (detail && typeof detail === "object") {
      return detail.message || detail.error || JSON.stringify(detail).slice(0, 300)
    }
    return (
      obj.error ||
      obj.message ||
      obj.code ||
      `Request failed with status ${status}`
    )
  }
  if (typeof body === "string" && body.trim()) {
    return body.trim().slice(0, 500)
  }
  return endpoint
    ? `Request failed with status ${status} (${endpoint})`
    : `Request failed with status ${status}`
}

async function syteRequest<T = unknown>(
  method: string,
  path: string,
  options?: { query?: Record<string, unknown>; body?: unknown; base?: "workspace" | "docs" },
): Promise<SyteResult<T>> {
  const config = getSyteConfig()
  const base = options?.base === "docs" ? config.docsBase : config.workspaceBase
  const endpoint = buildUrl(base, path, options?.query)

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
    }
    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json"
    }
    const normalizedPath = normalizeSytePath(path)
    const isPublicDocs =
      options?.base === "docs" &&
      (normalizedPath === "health" || normalizedPath === "tokens")
    if (!isPublicDocs) {
      headers["X-API-Key"] = config.apiKey
      headers.Authorization = `Bearer ${config.apiKey}`
    }

    const res = await fetch(endpoint, {
      method,
      headers,
      body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    })

    const data = (await parseBody(res)) as T | null
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: extractError(res.status, data, endpoint),
        endpoint,
      }
    }

    return { ok: true, status: res.status, data, error: null, endpoint }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || "Network error reaching Syte API",
      endpoint,
    }
  }
}

async function syteWorkspaceRequest<T = unknown>(
  method: string,
  path: string,
  options?: { query?: Record<string, unknown>; body?: unknown },
): Promise<SyteResult<T>> {
  return syteRequest<T>(method, path, { ...options, base: "workspace" })
}

/** Map a project page path to the Syte workspace path (files live under app/). */
export function toSyteWorkspacePath(relPath: string): string {
  const normalized = relPath.replace(/^\/+/, "").replace(/\\/g, "/")
  if (!normalized) return "app"
  if (normalized === "app" || normalized.startsWith("app/")) return normalized
  return `app/${normalized}`
}

export async function syteServerInfo() {
  return syteWorkspaceRequest("GET", "server_info")
}

export async function syteWorkspaceGet(uuid: string) {
  return syteWorkspaceRequest("GET", "workspace_get", { query: { uuid } })
}

export async function syteListFiles(uuid: string, path = "") {
  return syteWorkspaceRequest("GET", "list_files", { query: { uuid, path: path || undefined } })
}

export async function syteReadFile(uuid: string, path: string) {
  return syteWorkspaceRequest<{ ok?: boolean; content?: string }>("POST", "read_file", {
    body: { uuid, path: toSyteWorkspacePath(path) },
  })
}

export async function syteWriteFile(uuid: string, path: string, content: string) {
  return syteWorkspaceRequest("POST", "write_file", {
    body: { uuid, path: toSyteWorkspacePath(path), content },
  })
}

export async function syteDeleteFile(uuid: string, path: string) {
  return syteWorkspaceRequest("POST", "delete_file", {
    body: { uuid, path: toSyteWorkspacePath(path) },
  })
}

export async function syteExecuteCommand(
  uuid: string,
  command: string,
  options?: { cwd?: string; timeout?: number; env?: Record<string, string> },
) {
  return syteWorkspaceRequest<{
    ok?: boolean
    exit_code?: number
    output?: string
    command?: string
  }>("POST", "execute_command", {
    body: {
      uuid,
      command,
      cwd: options?.cwd ?? "app",
      timeout: options?.timeout ?? 300,
      env: options?.env,
    },
  })
}

export async function syteExecuteCommands(
  uuid: string,
  commands: Array<{ command: string; cwd?: string; timeout?: number }>,
  stopOnFailure = true,
) {
  return syteWorkspaceRequest("POST", "execute_commands", {
    body: { uuid, commands, stop_on_failure: stopOnFailure },
  })
}

export async function syteCreateProject(input: {
  name: string
  uuid?: string
  git_url?: string
  git_provider?: string
  branch?: string
  start_command?: string
  domain?: string
  env_vars?: Record<string, string>
  deploy?: boolean
}) {
  return syteWorkspaceRequest<{
    ok?: boolean
    uuid?: string
    status?: string
    stream_url?: string
    url?: string
    execute_command?: { method?: string; path?: string; body?: Record<string, unknown> }
    issue_deploy?: { method?: string; path?: string; body?: Record<string, unknown> }
    next_steps?: string[]
    paths?: Record<string, unknown>
  }>("POST", "create_project", { body: input })
}

export async function syteIssueDeploy(uuid: string) {
  return syteWorkspaceRequest("POST", "issue_deploy", { body: { uuid } })
}

export async function syteGetLogs(uuid: string, lines = 200) {
  return syteWorkspaceRequest("GET", "get_logs", { query: { uuid, lines } })
}

export async function syteSetEnv(uuid: string, envVars: Record<string, string>, merge = true) {
  return syteWorkspaceRequest("POST", "set_env", {
    body: { uuid, env_vars: envVars, merge },
  })
}

export async function syteSetDomain(uuid: string, domain: string) {
  return syteWorkspaceRequest("POST", "set_domain", { body: { uuid, domain } })
}

export type SytePreviewFields = {
  preview_url?: string
  preview_domain?: string
  preview_domain_url?: string
  preview_direct_url?: string
  preview_ready?: boolean
  preview_running?: boolean
  preview_port?: number
  preview_stream_url?: string
  url?: string
  domain?: string
}

/** True when URL is a raw host:port preview (not the HTTPS preview domain). */
function isDirectPreviewUrl(url: string): boolean {
  try {
    const u = new URL(url.trim())
    if (u.protocol === "http:" && /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return true
    return u.hostname === "localhost" || u.hostname === "127.0.0.1"
  } catch {
    return false
  }
}

/**
 * Pick the HTTPS preview domain URL from Syte start_preview / preview_status.
 * Prefers preview_domain_url (e.g. https://previewk-mysite.sycord.site) and never
 * uses preview_direct_url (http://IP:port) when a preview domain is available.
 */
export function pickSytePreviewUrl(data: SytePreviewFields | null | undefined): string | null {
  if (!data || typeof data !== "object") return null

  const domainUrl =
    typeof data.preview_domain_url === "string" ? data.preview_domain_url.trim() : ""
  if (domainUrl.startsWith("http")) return domainUrl

  const previewDomain =
    typeof data.preview_domain === "string" ? data.preview_domain.trim() : ""
  if (previewDomain) {
    return `https://${previewDomain.replace(/^https?:\/\//, "")}`
  }

  const previewUrl = typeof data.preview_url === "string" ? data.preview_url.trim() : ""
  const directUrl =
    typeof data.preview_direct_url === "string" ? data.preview_direct_url.trim() : ""

  // preview_url is the domain URL when GUI zone is set; skip when it equals direct IP
  if (previewUrl.startsWith("http") && previewUrl !== directUrl && !isDirectPreviewUrl(previewUrl)) {
    return previewUrl
  }

  // Last resort only when Syte did not issue a preview domain (no wildcard GUI zone)
  if (directUrl.startsWith("http")) return directUrl
  if (previewUrl.startsWith("http")) return previewUrl

  const host = typeof data.domain === "string" ? data.domain.trim() : ""
  if (host) return `https://${host.replace(/^https?:\/\//, "")}`

  const genericUrl = typeof data.url === "string" ? data.url.trim() : ""
  if (genericUrl.startsWith("http") && !isDirectPreviewUrl(genericUrl)) return genericUrl

  return null
}

export async function syteStartPreview(uuid: string) {
  return syteWorkspaceRequest<SytePreviewFields>("POST", "start_preview", { body: { uuid } })
}

export async function syteStopPreview(uuid: string) {
  return syteWorkspaceRequest("POST", "stop_preview", { body: { uuid } })
}

export async function sytePreviewStatus(uuid: string) {
  return syteWorkspaceRequest<SytePreviewFields>("GET", "preview_status", { query: { uuid } })
}

/** Sync project pages into the Syte workspace (write_file per file). */
export async function syteSyncProjectFiles(
  uuid: string,
  files: Array<{ name: string; content: string }>,
): Promise<{ synced: number; errors: string[] }> {
  let synced = 0
  const errors: string[] = []

  for (const file of files) {
    if (!file.name || /^\.env(?:\.|$)/.test(file.name)) continue
    const result = await syteWriteFile(uuid, file.name, file.content ?? "")
    if (result.ok) {
      synced++
    } else {
      errors.push(`${file.name}: ${result.error}`)
    }
  }

  return { synced, errors }
}

/** @deprecated Use createSyteWorkspaceForProject from syte-workspace.ts */
export async function ensureSyteWorkspace(
  projectId: string,
  name: string,
): Promise<SyteResult<{ uuid: string }>> {
  const existing = await syteWorkspaceGet(projectId)
  if (existing.ok) {
    return { ...existing, data: { uuid: projectId } }
  }

  const created = await syteCreateProject({
    name: name || `project-${projectId.slice(0, 8)}`,
    deploy: false,
  })

  if (!created.ok) return created
  const uuid =
    (created.data as any)?.uuid ||
    (typeof created.data === "object" && created.data && "uuid" in created.data
      ? String((created.data as any).uuid)
      : projectId)

  return { ...created, data: { uuid } }
}

export async function checkSyteHealth(): Promise<{
  reachable: boolean
  apiUrl: string
  hasKey: boolean
  version?: string
  latencyMs?: number
  error?: string
}> {
  const hasKey = isSyteConfigured()
  const config = hasKey ? getSyteConfig() : null
  const apiUrl = config?.baseUrl || process.env.DEPLOYER_API_URL || DEFAULT_SYTE_BASE

  if (!hasKey) {
    return { reachable: false, apiUrl, hasKey, error: "DEPLOYER_API_KEY is not set" }
  }

  const start = Date.now()
  // /api/health is public; workspace routes are at site root (/create_project)
  const health = await syteRequest<{ status?: string; version?: string }>("GET", "health", {
    base: "docs",
  })
  const latencyMs = Date.now() - start

  if (!health.ok) {
    return {
      reachable: false,
      apiUrl,
      hasKey,
      latencyMs,
      error: health.error || "Syte API unreachable",
    }
  }

  const version =
    typeof health.data === "object" && health.data
      ? String((health.data as any).version || "")
      : undefined

  return { reachable: true, apiUrl, hasKey, version: version || undefined, latencyMs }
}
