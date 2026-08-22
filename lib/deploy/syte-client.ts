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

/**
 * Map a project page path to the Syte workspace path (files live under app/).
 * Rejects path traversal (`..`), null bytes, and absolute paths so callers
 * cannot escape the workspace root.
 */
export function toSyteWorkspacePath(relPath: string): string {
  if (typeof relPath !== "string") {
    throw new Error("Invalid path")
  }
  if (relPath.includes("\0")) {
    throw new Error("Invalid path: null byte")
  }

  // Collapse separators, strip leading slashes, posix-normalize
  let normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "")
  const segments = normalized.split("/").filter((s) => s.length > 0 && s !== ".")
  if (segments.some((s) => s === "..")) {
    throw new Error("Invalid path: traversal not allowed")
  }
  normalized = segments.join("/")

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
  let workspacePath: string
  try {
    workspacePath = toSyteWorkspacePath(path)
  } catch (err: any) {
    return { ok: false as const, status: 400, error: err?.message || "Invalid path", data: undefined }
  }
  return syteWorkspaceRequest<{ ok?: boolean; content?: string }>("POST", "read_file", {
    body: { uuid, path: workspacePath },
  })
}

export async function syteWriteFile(uuid: string, path: string, content: string) {
  let workspacePath: string
  try {
    workspacePath = toSyteWorkspacePath(path)
  } catch (err: any) {
    return { ok: false as const, status: 400, error: err?.message || "Invalid path", data: undefined }
  }
  return syteWorkspaceRequest("POST", "write_file", {
    body: { uuid, path: workspacePath, content },
  })
}

export async function syteDeleteFile(uuid: string, path: string) {
  let workspacePath: string
  try {
    workspacePath = toSyteWorkspacePath(path)
  } catch (err: any) {
    return { ok: false as const, status: 400, error: err?.message || "Invalid path", data: undefined }
  }
  return syteWorkspaceRequest("POST", "delete_file", {
    body: { uuid, path: workspacePath },
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

/**
 * Delete a Syte workspace (stops container + removes files).
 * Docs: POST /api/delete_project  { uuid }
 */
export async function syteDeleteProject(uuid: string) {
  return syteWorkspaceRequest<{ ok?: boolean; uuid?: string; status?: string }>(
    "POST",
    "delete_project",
    { body: { uuid } },
  )
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
 * Priority:
 *   1. preview_domain_url — always the dev-server subdomain HTTPS URL
 *   2. preview_domain    — construct HTTPS URL from the subdomain hostname
 *   3. preview_url       — only when it looks like a preview subdomain (starts with "preview")
 *                          Rejected when it is the base/production domain (e.g. sycord.site)
 *                          because set_domain before start_preview may overwrite this field
 *   4. preview_direct_url — last resort (HTTP; may trigger mixed-content warnings)
 */
export function pickSytePreviewUrl(data: SytePreviewFields | null | undefined): string | null {
  if (!data || typeof data !== "object") return null

  // 1. preview_domain_url — most reliable: always the dev-server subdomain URL
  const domainUrl =
    typeof data.preview_domain_url === "string" ? data.preview_domain_url.trim() : ""
  if (domainUrl.startsWith("http")) return domainUrl

  // 2. preview_domain — hostname of the dev-server subdomain
  const previewDomain =
    typeof data.preview_domain === "string" ? data.preview_domain.trim() : ""
  if (previewDomain) {
    return `https://${previewDomain.replace(/^https?:\/\//, "")}`
  }

  const previewUrl = typeof data.preview_url === "string" ? data.preview_url.trim() : ""
  const directUrl =
    typeof data.preview_direct_url === "string" ? data.preview_direct_url.trim() : ""

  // 3. preview_url — only if it looks like a preview subdomain.
  //    When set_domain is called before start_preview (e.g. with a base domain like
  //    sycord.site), Syte may update preview_url to the production domain. Reject it
  //    if it does not start with "preview" in the hostname.
  if (previewUrl.startsWith("http") && previewUrl !== directUrl && !isDirectPreviewUrl(previewUrl)) {
    try {
      const hostname = new URL(previewUrl).hostname.toLowerCase()
      if (hostname.startsWith("preview")) {
        return previewUrl
      }
      // Looks like a production/base domain — skip and fall through to direct URL
    } catch {
      // Invalid URL — skip
    }
  }

  // 4. Last resort: direct URL (http://IP:port) — may cause mixed-content warnings
  //    on HTTPS pages but is better than showing nothing.
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

/**
 * Fetch live agent runtime status + model.
 * GET /api/agent_status?uuid=
 * Docs: https://sycord.site/api/#agent/agent-status
 */
export async function syteAgentStatus(
  uuid: string,
): Promise<SyteResult<SyteAgentStatusResponse>> {
  return syteWorkspaceRequest<SyteAgentStatusResponse>("GET", "agent_status", {
    query: { uuid },
  })
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

  if (!created.ok) {
    return {
      ok: false,
      status: created.status,
      data: null,
      error: created.error,
      endpoint: created.endpoint,
    }
  }
  const rawUuid =
    (created.data as { uuid?: string } | null)?.uuid ||
    (typeof created.data === "object" && created.data && "uuid" in created.data
      ? String((created.data as { uuid?: unknown }).uuid ?? "")
      : "")
  const uuid = rawUuid || projectId

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

// ─── Sycord Deployer API (/sycord/api/) ───────────────────────────────────────
// New integration endpoint described at https://sycord.site/sycord/api/
// All functions use the /sycord/api/ path prefix (distinct from the workspace /api/ prefix).

/** Response shape from POST /sycord/api/project_connect */
export type SycordProjectConnectResponse = {
  ok: boolean
  uuid: string
  message?: string
  project?: {
    uuid?: string
    name?: string
    domain?: string
    url?: string
    stack?: string
    status?: string
    port?: number
    workspace_path?: string
    app_path?: string
    created_at?: string
  }
  persist?: {
    save_uuid?: boolean
    uuid?: string
    instruction?: string
  }
  next_steps?: Record<string, string>
}

/** Response shape from GET /sycord/api/container_get */
export type SycordContainerGetResponse = {
  ok: boolean
  uuid?: string
  container_name?: string
  exists?: boolean
  running?: boolean
  state?: string
  image?: string
  url?: string
  domain?: string
  host_port?: number
  status?: string
}

/** Response shape from POST /sycord/api/issue_deployment */
export type SycordIssueDeploymentResponse = {
  ok: boolean
  uuid?: string
  message?: string
  stream_url?: string
  status?: string
}

function buildSycordUrl(base: string, path: string, query?: Record<string, unknown>): string {
  // Build URL under the /sycord/api/ path
  const baseClean = base.replace(/\/+$/, "").replace(/\/sycord\/api\/?$/, "")
  const pathClean = path.replace(/^\/+/, "").replace(/^sycord\/api\//, "")
  const url = new URL(`${baseClean}/sycord/api/${pathClean}`)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue
      url.searchParams.set(key, String(value))
    }
  }
  return url.toString()
}

async function syteSycordRequest<T = unknown>(
  method: string,
  path: string,
  options?: { query?: Record<string, unknown>; body?: unknown },
): Promise<SyteResult<T>> {
  const config = getSyteConfig()
  const endpoint = buildSycordUrl(config.baseUrl, path, options?.query)

  try {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-API-Key": config.apiKey,
      Authorization: `Bearer ${config.apiKey}`,
    }
    if (options?.body !== undefined) {
      headers["Content-Type"] = "application/json"
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
      error: err?.message || "Network error reaching Sycord Deployer API",
      endpoint,
    }
  }
}

/**
 * Step 1 — Create a project on Syte and get the UUID.
 * POST /sycord/api/project_connect
 * Save the returned uuid as syteWorkspaceUuid in your database.
 */
export async function syteProjectConnect(input: {
  name: string
  stack?: "nextjs" | "python" | "javascript" | "html5"
  uuid?: string
  env_vars?: Record<string, string>
}): Promise<SyteResult<SycordProjectConnectResponse>> {
  return syteSycordRequest<SycordProjectConnectResponse>("POST", "project_connect", {
    body: {
      name: input.name,
      stack: input.stack ?? "nextjs",
      ...(input.uuid ? { uuid: input.uuid } : {}),
      ...(input.env_vars ? { env_vars: input.env_vars } : {}),
    },
  })
}

/**
 * Step 3 — Trigger a Docker build and deploy.
 * POST /sycord/api/issue_deployment
 */
export async function syteIssueDeployment(uuid: string): Promise<SyteResult<SycordIssueDeploymentResponse>> {
  return syteSycordRequest<SycordIssueDeploymentResponse>("POST", "issue_deployment", { body: { uuid } })
}

/**
 * Step 4 — Poll container status until running === true.
 * GET /sycord/api/container_get?uuid=
 */
export async function syteContainerGet(uuid: string): Promise<SyteResult<SycordContainerGetResponse>> {
  return syteSycordRequest<SycordContainerGetResponse>("GET", "container_get", { query: { uuid } })
}

/**
 * Step 5 (optional) — Set a custom domain.
 * POST /sycord/api/domain
 */
export async function syteSycordDomain(
  uuid: string,
  domain: string,
): Promise<SyteResult<{ ok: boolean; project?: { domain?: string; url?: string } }>> {
  return syteSycordRequest("POST", "domain", { body: { uuid, domain } })
}


// ─── Durable Syte agent API ──────────────────────────────────────────────────
// Docs: https://sycord.site/api/#agent
// Turns are saved to Turso. Poll GET /api/agent_session/{turso_session_id}
// — the old activity SSE stream is no longer the source of truth.

export type SyteAgentExecutionOptions = {
  /** Planning stays opt-in for ordinary Sycord Pages coding turns. */
  planMode?: "auto" | "always" | "off"
  /** Explicit plan mode remains available to callers that request it. */
  agentMode?: "build" | "plan"
}

export type SyteAgentChangeResponse = {
  ok?: boolean
  request_id?: string
  status?: string
  /** Durable Turso session UUID — fetch via GET /api/agent_session/{id} */
  turso_session_id?: string
  /** Relative path to the Turso session document (e.g. /api/agent_session/…) */
  session_url?: string
  /** @deprecated Prefer turso_session_id + polling agent_session */
  stream_url?: string
  change_applied?: boolean | null
}

/**
 * Submit one durable project-agent turn (async).
 * Returns request_id + turso_session_id immediately.
 * Poll GET /api/agent_session/{turso_session_id} until status != "open".
 */
export async function syteAgentChange(
  uuid: string,
  message: string,
  modelProfile?: string,
  execution: SyteAgentExecutionOptions = {},
): Promise<SyteResult<SyteAgentChangeResponse>> {
  const agentMode = execution.agentMode === "plan" ? "plan" : "build"
  const planMode = execution.planMode ?? (agentMode === "plan" ? "always" : "off")
  return syteWorkspaceRequest<SyteAgentChangeResponse>("POST", "agent_change", {
    body: {
      uuid,
      message,
      ...(modelProfile ? { model_profile: modelProfile } : {}),
      plan_mode: planMode,
      agent_mode: agentMode,
    },
  })
}

// ─── Turso agent sessions (durable turn records) ─────────────────────────────

export type SyteTursoSessionEvent = {
  id: number
  event_type: string
  role?: string
  title?: string
  detail?: string
  payload?: Record<string, unknown>
  source?: string
  created_at?: string
}

export type SyteTursoSessionSummary = {
  id: string
  session_number?: number
  model_profile?: string
  status?: "open" | "completed" | "failed" | "cancelled" | string
  created_at?: string
  updated_at?: string
  session_url?: string
}

export type SyteAgentSessionsResponse = {
  ok: boolean
  uuid?: string
  turso_configured?: boolean
  sessions: SyteTursoSessionSummary[]
}

export type SyteAgentSessionResponse = {
  ok: boolean
  id: string
  project_id?: string
  session_number?: number
  model_profile?: string
  status: "open" | "completed" | "failed" | "cancelled" | string
  created_at?: string
  updated_at?: string
  events: SyteTursoSessionEvent[]
}

/**
 * List durable Turso agent-session UUIDs for a project (newest first).
 * GET /api/agent_sessions?uuid=&limit=
 */
export async function syteAgentSessions(
  uuid: string,
  options?: { limit?: number },
): Promise<SyteResult<SyteAgentSessionsResponse>> {
  return syteWorkspaceRequest<SyteAgentSessionsResponse>("GET", "agent_sessions", {
    query: {
      uuid,
      limit: options?.limit ?? 50,
    },
  })
}

/**
 * Fetch a durable Turso agent session by UUID.
 * GET /api/agent_session/{session_id}?since_id=
 *
 * Poll with since_id while status === "open" to observe an in-progress turn.
 */
export async function syteAgentSession(
  sessionId: string,
  options?: { sinceId?: number },
): Promise<SyteResult<SyteAgentSessionResponse>> {
  const path = `agent_session/${encodeURIComponent(sessionId)}`
  return syteWorkspaceRequest<SyteAgentSessionResponse>("GET", path, {
    query: {
      since_id: options?.sinceId ?? 0,
    },
  })
}

// ─── Agent activity (local snapshot fallback) ────────────────────────────────

export type SyteAgentEvent = {
  id: number
  project_id?: string
  event_type: string
  role?: string
  title?: string
  detail?: string
  payload?: Record<string, unknown>
  source?: string
  created_at?: string
}

export type SyteAgentActivityResponse = {
  ok: boolean
  events: SyteAgentEvent[]
  count?: number
  sessions_url?: string
  uuid?: string
  since_id?: number
}

/**
 * Local SQLite activity snapshot (not durable across DB moves).
 * Prefer syteAgentSession / syteAgentSessions when Turso is configured.
 * GET /api/agent_activity?uuid=&since_id=&limit=&session=
 */
export async function syteAgentActivity(
  uuid: string,
  options?: { sinceId?: number; limit?: number; session?: string },
): Promise<SyteResult<SyteAgentActivityResponse>> {
  return syteWorkspaceRequest<SyteAgentActivityResponse>("GET", "agent_activity", {
    query: {
      uuid,
      since_id: options?.sinceId ?? 0,
      limit: options?.limit ?? 200,
      ...(options?.session ? { session: options.session } : {}),
    },
  })
}

export type SyteAgentStatusResponse = {
  ok: boolean
  agent_status?: string
  agent_runtime?: string
  agent_healthy?: boolean
  agent_running?: boolean
  agent_model?: Record<string, string>
  agent_capabilities?: string[]
  agent_conversation_id?: string
  agent_last_error?: string
  agent_backend?: {
    ok: boolean
    error?: string
    url?: string
    profile?: string
    provider?: string
  }
}

/**
 * Interrupt the current agent turn (cancel in-progress request).
 * Prefer this for the chat Stop button so the runtime stays warm.
 * POST /api/agent_interrupt
 * Docs: https://sycord.site/api/#agent
 */
export async function syteAgentInterrupt(
  uuid: string,
): Promise<SyteResult<{ ok?: boolean }>> {
  return syteWorkspaceRequest("POST", "agent_interrupt", { body: { uuid } })
}

/**
 * Stop the project agent runtime and mark the turn stopped.
 * POST /api/agent_stop
 */
export async function syteAgentStop(
  uuid: string,
): Promise<SyteResult<{ ok?: boolean }>> {
  return syteWorkspaceRequest("POST", "agent_stop", { body: { uuid } })
}

/**
 * Fetch a screenshot PNG bytes from Syte.
 * GET /api/projects/{uuid}/agent/screenshots/{id}?variant=thumb|full
 */
export async function syteAgentScreenshotImage(
  uuid: string,
  screenshotId: string,
  variant: "thumb" | "full" = "full",
): Promise<SyteResult<ArrayBuffer>> {
  const config = getSyteConfig()
  const endpoint =
    `${config.baseUrl}/api/projects/${encodeURIComponent(uuid)}/agent/screenshots/${encodeURIComponent(screenshotId)}` +
    `?variant=${variant}`
  try {
    const res = await fetch(endpoint, {
      headers: {
        Accept: "image/png,image/*,*/*",
        "X-API-Key": config.apiKey,
        Authorization: `Bearer ${config.apiKey}`,
      },
    })
    if (!res.ok) {
      const data = await parseBody(res)
      return {
        ok: false,
        status: res.status,
        data: null,
        error: extractError(res.status, data, endpoint),
        endpoint,
      }
    }
    const buf = await res.arrayBuffer()
    return { ok: true, status: res.status, data: buf, error: null, endpoint }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || "Network error fetching screenshot",
      endpoint,
    }
  }
}

// ─── Agent MCP addons + skills (https://sycord.site/api/#agent) ───────────────

export type SyteAgentMcpAddon = {
  id: string
  name: string
  status?: string
  tools?: unknown[]
  builtin?: boolean
  description?: string
  command?: string
  args?: string[]
  connected?: boolean
  enabled?: boolean
}

export type SyteAgentMcpListResponse = {
  ok?: boolean
  addons?: SyteAgentMcpAddon[]
}

export type SyteAgentSkill = {
  id: string
  name: string
  active?: boolean
  parameters?: Record<string, unknown>
  builtin?: boolean
  custom?: boolean
  content?: string
  description?: string
}

export type SyteAgentSkillsListResponse = {
  ok?: boolean
  skills?: SyteAgentSkill[]
}

/** GET /api/agent_mcp?uuid= — list built-in + registered MCP addons. */
export async function syteAgentMcpList(
  uuid: string,
): Promise<SyteResult<SyteAgentMcpListResponse>> {
  return syteWorkspaceRequest<SyteAgentMcpListResponse>("GET", "agent_mcp", {
    query: { uuid },
  })
}

/** POST /api/agent_mcp_connect — enable an MCP addon. */
export async function syteAgentMcpConnect(
  uuid: string,
  addon: string,
): Promise<SyteResult<{ ok?: boolean }>> {
  return syteWorkspaceRequest("POST", "agent_mcp_connect", {
    body: { uuid, addon },
  })
}

/** POST /api/agent_mcp_disconnect — disable an MCP addon (keep registration). */
export async function syteAgentMcpDisconnect(
  uuid: string,
  addon: string,
): Promise<SyteResult<{ ok?: boolean }>> {
  return syteWorkspaceRequest("POST", "agent_mcp_disconnect", {
    body: { uuid, addon },
  })
}

/** POST /api/agent_mcp_register — register a custom MCP stdio provider. */
export async function syteAgentMcpRegister(
  uuid: string,
  input: {
    name: string
    command: string
    args?: string[]
    env?: Record<string, string>
    description?: string
  },
): Promise<SyteResult<{ ok?: boolean; addon?: SyteAgentMcpAddon }>> {
  return syteWorkspaceRequest("POST", "agent_mcp_register", {
    body: {
      uuid,
      name: input.name,
      command: input.command,
      ...(input.args ? { args: input.args } : {}),
      ...(input.env ? { env: input.env } : {}),
      ...(input.description ? { description: input.description } : {}),
    },
  })
}

/** GET /api/agent_skills?uuid= — list built-in + custom skills. */
export async function syteAgentSkillsList(
  uuid: string,
): Promise<SyteResult<SyteAgentSkillsListResponse>> {
  return syteWorkspaceRequest<SyteAgentSkillsListResponse>("GET", "agent_skills", {
    query: { uuid },
  })
}

/** POST /api/agent_skills_enable — enable a skill (optional parameters). */
export async function syteAgentSkillsEnable(
  uuid: string,
  skillId: string,
  parameters?: Record<string, unknown>,
): Promise<SyteResult<{ ok?: boolean }>> {
  return syteWorkspaceRequest("POST", "agent_skills_enable", {
    body: {
      uuid,
      skill_id: skillId,
      ...(parameters ? { parameters } : {}),
    },
  })
}

/** POST /api/agent_skills_disable — disable a project skill. */
export async function syteAgentSkillsDisable(
  uuid: string,
  skillId: string,
): Promise<SyteResult<{ ok?: boolean }>> {
  return syteWorkspaceRequest("POST", "agent_skills_disable", {
    body: { uuid, skill_id: skillId },
  })
}

// ─── Agent interactive questions ─────────────────────────────────────────────
// Docs: https://sycord.site/api/#agent — ask_question / request_env widgets.
// Types: answer | input | slider | choice | multi_choice

export type SyteAgentQuestionAnswer =
  | string
  | number
  | string[]
  | Record<string, unknown>

export type SyteAgentQuestion = {
  id?: string
  question_id?: string
  question_type?: string
  type?: string
  prompt?: string
  question?: string
  options?: unknown
  min?: number
  max?: number
  min_value?: number
  max_value?: number
  step?: number
  default?: unknown
  default_value?: unknown
  value?: unknown
  placeholder?: string
  status?: string
  answer?: SyteAgentQuestionAnswer
}

export type SyteAgentQuestionsResponse = {
  ok?: boolean
  questions?: SyteAgentQuestion[]
}

/**
 * List interactive agent questions (pending/answered).
 * GET /api/agent_questions?uuid=&status=&limit=
 */
export async function syteAgentQuestions(
  uuid: string,
  options?: { status?: string; limit?: number },
): Promise<SyteResult<SyteAgentQuestionsResponse>> {
  return syteWorkspaceRequest<SyteAgentQuestionsResponse>("GET", "agent_questions", {
    query: {
      uuid,
      ...(options?.status ? { status: options.status } : {}),
      ...(options?.limit != null ? { limit: options.limit } : {}),
    },
  })
}

/**
 * Answer an ask_question / request_env prompt so the agent turn can continue.
 * POST /api/agent_answer_question
 * Body: { uuid, question_id, answer: str|number|string[]|object }
 */
export async function syteAgentAnswerQuestion(
  uuid: string,
  questionId: string,
  answer: SyteAgentQuestionAnswer,
): Promise<
  SyteResult<{ ok?: boolean; id?: string; status?: string; answer?: SyteAgentQuestionAnswer }>
> {
  return syteWorkspaceRequest("POST", "agent_answer_question", {
    body: {
      uuid,
      question_id: questionId,
      answer,
    },
  })
}
