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

export type SytePreviewUrlSource =
  | "preview_domain_url"
  | "preview_domain"
  | "preview_url"
  | "preview_direct_url"
  | "domain"
  | "url"
  | "none"

/** Same priority as pickSytePreviewUrl, but returns which field was used. */
export function describeSytePreviewUrlSource(
  data: SytePreviewFields | null | undefined,
): { url: string | null; source: SytePreviewUrlSource } {
  if (!data || typeof data !== "object") return { url: null, source: "none" }

  const domainUrl =
    typeof data.preview_domain_url === "string" ? data.preview_domain_url.trim() : ""
  if (domainUrl.startsWith("http")) return { url: domainUrl, source: "preview_domain_url" }

  const previewDomain =
    typeof data.preview_domain === "string" ? data.preview_domain.trim() : ""
  if (previewDomain) {
    return {
      url: `https://${previewDomain.replace(/^https?:\/\//, "")}`,
      source: "preview_domain",
    }
  }

  const previewUrl = typeof data.preview_url === "string" ? data.preview_url.trim() : ""
  const directUrl =
    typeof data.preview_direct_url === "string" ? data.preview_direct_url.trim() : ""

  if (previewUrl.startsWith("http") && previewUrl !== directUrl && !isDirectPreviewUrl(previewUrl)) {
    try {
      const hostname = new URL(previewUrl).hostname.toLowerCase()
      if (hostname.startsWith("preview")) {
        return { url: previewUrl, source: "preview_url" }
      }
    } catch {
      /* ignore */
    }
  }

  if (directUrl.startsWith("http")) return { url: directUrl, source: "preview_direct_url" }
  if (previewUrl.startsWith("http")) return { url: previewUrl, source: "preview_url" }

  const host = typeof data.domain === "string" ? data.domain.trim() : ""
  if (host) {
    return { url: `https://${host.replace(/^https?:\/\//, "")}`, source: "domain" }
  }

  const genericUrl = typeof data.url === "string" ? data.url.trim() : ""
  if (genericUrl.startsWith("http") && !isDirectPreviewUrl(genericUrl)) {
    return { url: genericUrl, source: "url" }
  }

  return { url: null, source: "none" }
}


export type SyteAgentStatusFields = {
  uuid?: string
  agent_status?: string
  agent_running?: boolean
  agent_port?: number
  agent_proxy_url?: string
  agent_model_profile?: 'syra-nano' | 'syra-base' | 'syra-havy' | string
  agent_backend?: {
    bridge_api_base?: string
  } | null
  last_error?: string
}

export type SyteAgentLogsResponse = {
  ok?: boolean
  logs?: string
  output?: string
}

export type SyteAgentTestResponse = {
  ok?: boolean
  checks?: {
    cli?: boolean
    backend?: boolean
    agent?: boolean
    communicate?: boolean
  }
  reply?: string
  error?: string
}

export type SyteAgentCommunicateResponse = {
  ok?: boolean
  reply?: string
  model?: string
  provider?: string
  model_profile?: string
  error?: string
}

export type SyteAgentChangeResponse = {
  ok?: boolean
  change_applied?: boolean
  reply?: string
  model?: string
  provider?: string
  model_profile?: string
  model_name?: string
  error?: string
}

export function getSyteInternalSecret(): string {
  return (
    process.env.SYRA_INTERNAL_SECRET ||
    process.env.CONTINUE_SYTE_INTERNAL_SECRET ||
    ''
  ).trim()
}

export function buildSyteAgentProxyHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  }
  const secret = getSyteInternalSecret()
  if (secret) {
    headers['X-Syra-Internal-Secret'] = secret
  }
  if (process.env.DEPLOYER_API_KEY) {
    headers['X-API-Key'] = process.env.DEPLOYER_API_KEY
    headers.Authorization = `Bearer ${process.env.DEPLOYER_API_KEY}`
  }
  return headers
}

export async function syteAgentStatus(uuid: string) {
  return syteWorkspaceRequest<SyteAgentStatusFields>('GET', 'agent_status', { query: { uuid } })
}

export async function syteAgentStart(uuid: string) {
  return syteWorkspaceRequest<SyteAgentStatusFields>('POST', 'agent_start', { body: { uuid } })
}

export async function syteAgentStop(uuid: string) {
  return syteWorkspaceRequest<SyteAgentStatusFields>('POST', 'agent_stop', { body: { uuid } })
}

export async function syteAgentRestart(uuid: string) {
  return syteWorkspaceRequest<SyteAgentStatusFields>('POST', 'agent_restart', { body: { uuid } })
}

export async function syteAgentSettings(
  uuid: string,
  modelProfile: 'syra-nano' | 'syra-base' | 'syra-havy',
) {
  return syteWorkspaceRequest<SyteAgentStatusFields>('POST', 'agent_settings', {
    body: { uuid, model_profile: modelProfile },
  })
}

export async function syteAgentLogs(uuid: string, lines = 200) {
  return syteWorkspaceRequest<SyteAgentLogsResponse>('GET', 'agent_logs', { query: { uuid, lines } })
}

export async function syteAgentTest(uuid: string) {
  return syteWorkspaceRequest<SyteAgentTestResponse>('POST', 'agent_test', { body: { uuid } })
}

export async function syteAgentCommunicate(
  uuid: string,
  message: string,
  modelProfile?: 'syra-nano' | 'syra-base' | 'syra-havy',
) {
  return syteWorkspaceRequest<SyteAgentCommunicateResponse>('POST', 'agent_communicate', {
    body: {
      uuid,
      message,
      ...(modelProfile ? { model_profile: modelProfile } : {}),
    },
  })
}

export async function syteAgentChange(
  uuid: string,
  message: string,
  modelName?: 'syra-nano' | 'syra-base' | 'syra-havy' | string,
) {
  return syteWorkspaceRequest<SyteAgentChangeResponse>('POST', 'agent_change', {
    body: {
      uuid,
      message,
      ...(modelName ? { model_name: modelName } : {}),
    },
  })
}

function buildSyteInternalHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }
  const secret = getSyteInternalSecret()
  if (secret) {
    headers['X-Syra-Internal-Secret'] = secret
  }
  if (process.env.DEPLOYER_API_KEY) {
    headers['X-API-Key'] = process.env.DEPLOYER_API_KEY
    headers.Authorization = `Bearer ${process.env.DEPLOYER_API_KEY}`
  }
  return headers
}

async function syteInternalRequest<T = unknown>(
  method: string,
  path: string,
  options?: { query?: Record<string, unknown>; body?: unknown },
): Promise<SyteResult<T>> {
  const config = getSyteConfig()
  const endpoint = buildUrl(`${config.baseUrl}/api/internal`, path, options?.query)
  const secret = getSyteInternalSecret()
  if (!secret) {
    return {
      ok: false,
      status: 503,
      data: null,
      error:
        'SYRA_INTERNAL_SECRET is not set. Configure the same value in Syte GUI → AI → Agent configuration.',
      endpoint,
    }
  }

  try {
    const res = await fetch(endpoint, {
      method,
      headers: buildSyteInternalHeaders(),
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
      error: err?.message || 'Network error reaching Syte internal agent API',
      endpoint,
    }
  }
}

export async function syteInternalAgentStatus(uuid: string) {
  return syteInternalRequest<SyteAgentStatusFields>('GET', `projects/${uuid}/agent`)
}

export async function syteInternalAgentStart(uuid: string) {
  return syteInternalRequest<SyteAgentStatusFields>('POST', `projects/${uuid}/agent/start`)
}

export async function syteInternalAgentStop(uuid: string) {
  return syteInternalRequest<SyteAgentStatusFields>('POST', `projects/${uuid}/agent/stop`)
}

export async function syteInternalAgentRestart(uuid: string) {
  return syteInternalRequest<SyteAgentStatusFields>('POST', `projects/${uuid}/agent/restart`)
}

export async function syteInternalAgentLogs(uuid: string, lines = 200) {
  return syteInternalRequest<SyteAgentLogsResponse>('GET', `projects/${uuid}/agent/logs`, {
    query: { lines },
  })
}

export async function syteInternalAgentTest(uuid: string) {
  return syteInternalRequest<SyteAgentTestResponse>('POST', `projects/${uuid}/agent/test`)
}

export async function syteInternalAgentCommunicate(
  uuid: string,
  message: string,
  modelProfile?: 'syra-nano' | 'syra-base' | 'syra-havy',
) {
  return syteInternalRequest<SyteAgentCommunicateResponse>('POST', `projects/${uuid}/agent/communicate`, {
    body: {
      message,
      ...(modelProfile ? { model_profile: modelProfile } : {}),
    },
  })
}

/** sycord.com code-change flow — preferred over raw proxy polling. */
export async function syteInternalAgentChange(
  uuid: string,
  message: string,
  modelName?: 'syra-nano' | 'syra-base' | 'syra-havy' | string,
) {
  return syteInternalRequest<SyteAgentChangeResponse>('POST', `projects/${uuid}/agent/change`, {
    body: {
      message,
      ...(modelName ? { model_name: modelName } : {}),
    },
  })
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
