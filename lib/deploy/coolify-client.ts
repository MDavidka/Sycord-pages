// Coolify API client — Sycord deploy platform (replaces Dokploy).
//
// Auth: Bearer token via DEPLOYER_API_KEY
// Base: DEPLOYER_API_URL + /api/v1
// Docs: https://coolify.io/docs/api-reference/authorization

const API_VERSION_PATH = "/api/v1"

export type CoolifyResult<T = unknown> = {
  ok: boolean
  status: number
  data: T | null
  error: string | null
  endpoint: string
}

export type CoolifyConfig = {
  apiKey: string
  baseUrl: string
  apiBase: string
  serverUuid?: string
  projectUuid?: string
  githubAppUuid?: string
}

export class CoolifyConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "CoolifyConfigError"
  }
}

export function getCoolifyConfig(): CoolifyConfig {
  const apiKey = process.env.DEPLOYER_API_KEY || ""
  const baseUrl = (process.env.DEPLOYER_API_URL || "").replace(/\/+$/, "")
  const serverUuid = process.env.DEPLOYER_SERVER_UUID || undefined
  const projectUuid = process.env.DEPLOYER_PROJECT_UUID || undefined
  const githubAppUuid = process.env.DEPLOYER_GITHUB_APP_UUID || undefined

  if (!apiKey) {
    throw new CoolifyConfigError(
      "DEPLOYER_API_KEY is not set. Add your Coolify API token to the environment.",
    )
  }
  if (!baseUrl) {
    throw new CoolifyConfigError(
      "DEPLOYER_API_URL is not set. Example: https://coolify.your-domain.com",
    )
  }

  return {
    apiKey,
    baseUrl,
    apiBase: `${baseUrl}${API_VERSION_PATH}`,
    serverUuid,
    projectUuid,
    githubAppUuid,
  }
}

export function isCoolifyConfigured(): boolean {
  return Boolean(process.env.DEPLOYER_API_KEY && process.env.DEPLOYER_API_URL)
}

/** Stable slug + short hash suffix for public URLs. */
export function toDeployAppName(name: string, projectId: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
  const suffix = projectId.replace(/[^a-z0-9]/gi, "").slice(-6).toLowerCase()
  return `${slug || "app"}-${suffix}`
}

function buildUrl(apiBase: string, path: string, query?: Record<string, unknown>): string {
  const cleanPath = path.startsWith("/") ? path.slice(1) : path
  const url = new URL(`${apiBase}/${cleanPath}`)
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

function extractError(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const obj = body as Record<string, any>
    return (
      obj.message ||
      obj.error ||
      (Array.isArray(obj.errors) ? obj.errors.join("; ") : null) ||
      `Request failed with status ${status}`
    )
  }
  if (typeof body === "string" && body.trim()) return body.trim().slice(0, 400)
  return `Request failed with status ${status}`
}

type RequestOptions = {
  method: "GET" | "POST" | "PATCH" | "DELETE"
  path: string
  query?: Record<string, unknown>
  body?: Record<string, unknown> | unknown[]
  config?: CoolifyConfig
  timeoutMs?: number
}

export async function coolifyRequest<T = unknown>(opts: RequestOptions): Promise<CoolifyResult<T>> {
  let config: CoolifyConfig
  try {
    config = opts.config || getCoolifyConfig()
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || "Coolify is not configured",
      endpoint: opts.path,
    }
  }

  const endpoint = buildUrl(config.apiBase, opts.path, opts.query)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000)

  try {
    const res = await fetch(endpoint, {
      method: opts.method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        Accept: "application/json",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    })
    const data = await parseBody(res)
    if (!res.ok) {
      return { ok: false, status: res.status, data: data as T, error: extractError(res.status, data), endpoint }
    }
    return { ok: true, status: res.status, data: data as T, error: null, endpoint }
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.name === "AbortError" ? "Coolify request timed out" : err?.message || "Network error",
      endpoint,
    }
  } finally {
    clearTimeout(timer)
  }
}

export function unwrap(data: unknown): unknown {
  if (!data || typeof data !== "object") return data
  const obj = data as Record<string, unknown>
  if ("data" in obj && obj.data !== undefined) return obj.data
  return data
}

export function extractUuid(data: unknown): string | null {
  const core = unwrap(data)
  if (!core || typeof core !== "object") return null
  const obj = core as Record<string, unknown>
  const uuid = obj.uuid ?? obj.application_uuid ?? obj.deployment_uuid ?? obj.id
  return typeof uuid === "string" ? uuid : null
}

export function extractDeploymentUuid(data: unknown): string | null {
  const core = unwrap(data)
  if (!core || typeof core !== "object") return null
  const obj = core as Record<string, unknown>
  if (typeof obj.deployment_uuid === "string") return obj.deployment_uuid
  const deployments = obj.deployments
  if (Array.isArray(deployments) && deployments[0]?.deployment_uuid) {
    return String(deployments[0].deployment_uuid)
  }
  return extractUuid(core)
}

export const coolify = {
  health: () => coolifyRequest({ method: "GET", path: "/healthcheck" }),
  version: () => coolifyRequest<string>({ method: "GET", path: "/version" }),

  listProjects: () => coolifyRequest({ method: "GET", path: "/projects" }),
  getProject: (uuid: string) => coolifyRequest({ method: "GET", path: `/projects/${uuid}` }),
  createProject: (name: string, description?: string) =>
    coolifyRequest({
      method: "POST",
      path: "/projects",
      body: { name, description: description || undefined },
    }),

  listServers: () => coolifyRequest({ method: "GET", path: "/servers" }),
  getServer: (uuid: string) => coolifyRequest({ method: "GET", path: `/servers/${uuid}` }),

  listApplications: () => coolifyRequest({ method: "GET", path: "/applications" }),
  getApplication: (uuid: string) => coolifyRequest({ method: "GET", path: `/applications/${uuid}` }),
  updateApplication: (uuid: string, body: Record<string, unknown>) =>
    coolifyRequest({ method: "PATCH", path: `/applications/${uuid}`, body }),

  createPublicApplication: (body: Record<string, unknown>) =>
    coolifyRequest({ method: "POST", path: "/applications/public", body }),

  createPrivateGithubApplication: (body: Record<string, unknown>) =>
    coolifyRequest({ method: "POST", path: "/applications/private-github-app", body }),

  bulkUpdateEnvs: (applicationUuid: string, envs: Array<Record<string, unknown>>) =>
    coolifyRequest({
      method: "PATCH",
      path: `/applications/${applicationUuid}/envs/bulk`,
      body: envs,
    }),

  startApplication: (uuid: string, opts?: { force?: boolean; instantDeploy?: boolean }) =>
    coolifyRequest({
      method: "GET",
      path: `/applications/${uuid}/start`,
      query: {
        force: opts?.force ? "true" : undefined,
        instant_deploy: opts?.instantDeploy ? "true" : undefined,
      },
    }),

  restartApplication: (uuid: string, opts?: { force?: boolean }) =>
    coolifyRequest({
      method: "GET",
      path: `/applications/${uuid}/restart`,
      query: { force: opts?.force ? "true" : undefined },
    }),

  stopApplication: (uuid: string) =>
    coolifyRequest({ method: "GET", path: `/applications/${uuid}/stop` }),

  deploy: (uuid: string, force = false) =>
    coolifyRequest({ method: "GET", path: "/deploy", query: { uuid, force: force ? "true" : "false" } }),

  listDeployments: () => coolifyRequest({ method: "GET", path: "/deployments" }),
  getDeployment: (uuid: string) => coolifyRequest({ method: "GET", path: `/deployments/${uuid}` }),
}

export type EnsureDeployStep = {
  step: string
  ok: boolean
  status: number
  endpoint: string
  error: string | null
}

export type EnsureDeployResult = {
  success: boolean
  projectUuid: string | null
  serverUuid: string | null
  applicationUuid: string | null
  deploymentUuid: string | null
  appName: string | null
  createdProject: boolean
  createdApplication: boolean
  error: string | null
  steps: EnsureDeployStep[]
  data: unknown
}

export type EnsureCoolifyDeployInput = {
  name: string
  appName?: string
  existingApplicationUuid?: string | null
  existingProjectUuid?: string | null
  serverUuid?: string | null
  environmentName?: string
  env?: Record<string, string> | null
  source?: {
    owner: string
    repository: string
    branch?: string
    gitUrl?: string
    githubAppUuid?: string | null
  }
  domain?: {
    host: string
    port?: number
    https?: boolean
  }
  buildPack?: "dockerfile" | "nixpacks" | "static"
  description?: string
}

function toStep(step: string, result: CoolifyResult): EnsureDeployStep {
  return {
    step,
    ok: result.ok,
    status: result.status,
    endpoint: result.endpoint,
    error: result.error,
  }
}

async function resolveDefaultServerUuid(config: CoolifyConfig): Promise<string | null> {
  if (config.serverUuid) return config.serverUuid
  const servers = await coolify.listServers()
  if (!servers.ok) return null
  const list = Array.isArray(servers.data) ? servers.data : []
  const localhost = list.find((s: any) => s?.is_reachable || s?.name === "localhost")
  return (localhost?.uuid || list[0]?.uuid || null) as string | null
}

async function resolveDefaultProjectUuid(
  config: CoolifyConfig,
  projectName: string,
  steps: EnsureDeployStep[],
): Promise<{ uuid: string | null; created: boolean; error: string | null }> {
  if (config.projectUuid) return { uuid: config.projectUuid, created: false, error: null }

  const existing = await coolify.listProjects()
  steps.push(toStep("projects.list", existing))
  if (existing.ok && Array.isArray(existing.data) && existing.data.length > 0) {
    const match = existing.data.find((p: any) => p?.name === projectName)
    return { uuid: (match?.uuid || existing.data[0]?.uuid || null) as string | null, created: false, error: null }
  }

  const created = await coolify.createProject(projectName)
  steps.push(toStep("projects.create", created))
  if (!created.ok) {
    return { uuid: null, created: false, error: created.error || "Failed to create Coolify project" }
  }
  return { uuid: extractUuid(created.data), created: true, error: null }
}

function envRecordToCoolifyBulk(env: Record<string, string>): Array<Record<string, unknown>> {
  return Object.entries(env).map(([key, value]) => ({
    key,
    value,
    is_preview: false,
    is_build_time: false,
    is_literal: false,
    is_multiline: false,
    is_shown_once: false,
  }))
}

/** Provision (if needed) and trigger a Coolify deployment. */
export async function ensureAndDeployCoolifyApplication(
  input: EnsureCoolifyDeployInput,
): Promise<EnsureDeployResult> {
  const steps: EnsureDeployStep[] = []
  let config: CoolifyConfig
  try {
    config = getCoolifyConfig()
  } catch (err: any) {
    return {
      success: false,
      projectUuid: null,
      serverUuid: null,
      applicationUuid: null,
      deploymentUuid: null,
      appName: input.appName || null,
      createdProject: false,
      createdApplication: false,
      error: err?.message || "Coolify is not configured",
      steps,
      data: null,
    }
  }

  const appName = input.appName || toDeployAppName(input.name, input.name)
  const environmentName = input.environmentName || "production"
  let projectUuid = input.existingProjectUuid || config.projectUuid || null
  let serverUuid = input.serverUuid || config.serverUuid || null
  let applicationUuid = input.existingApplicationUuid || null
  let createdProject = false
  let createdApplication = false

  if (!serverUuid) {
    serverUuid = await resolveDefaultServerUuid(config)
    if (!serverUuid) {
      return {
        success: false,
        projectUuid,
        serverUuid: null,
        applicationUuid: null,
        deploymentUuid: null,
        appName,
        createdProject,
        createdApplication,
        error: "Could not resolve a Coolify server UUID. Set DEPLOYER_SERVER_UUID.",
        steps,
        data: null,
      }
    }
  }

  if (!projectUuid) {
    const resolved = await resolveDefaultProjectUuid(config, input.name, steps)
    projectUuid = resolved.uuid
    createdProject = resolved.created
    if (!projectUuid) {
      return {
        success: false,
        projectUuid: null,
        serverUuid,
        applicationUuid: null,
        deploymentUuid: null,
        appName,
        createdProject,
        createdApplication,
        error: resolved.error || "Could not resolve Coolify project",
        steps,
        data: null,
      }
    }
  }

  const gitBranch = input.source?.branch || "main"
  const gitUrl =
    input.source?.gitUrl || `https://github.com/${input.source?.owner}/${input.source?.repository}.git`
  const domainHost = input.domain?.host
  const domainUrl = domainHost
    ? `${input.domain?.https === false ? "http" : "https"}://${domainHost}`
    : undefined
  const buildPack = input.buildPack || "dockerfile"
  const portsExposes = String(input.domain?.port ?? 3000)

  if (!applicationUuid) {
    const githubAppUuid = input.source?.githubAppUuid || config.githubAppUuid || null
    const createBody: Record<string, unknown> = {
      project_uuid: projectUuid,
      server_uuid: serverUuid,
      environment_name: environmentName,
      name: appName,
      description: input.description || `Sycord deploy for ${appName}`,
      git_repository: gitUrl,
      git_branch: gitBranch,
      build_pack: buildPack,
      ports_exposes: portsExposes,
      instant_deploy: false,
      ...(domainUrl ? { domains: domainUrl } : {}),
    }

    const createResult = githubAppUuid
      ? await coolify.createPrivateGithubApplication({
          ...createBody,
          github_app_uuid: githubAppUuid,
          git_repository: `${input.source?.owner}/${input.source?.repository}`,
        })
      : await coolify.createPublicApplication(createBody)

    steps.push(toStep(githubAppUuid ? "applications.private-github-app" : "applications.public", createResult))
    if (!createResult.ok) {
      return {
        success: false,
        projectUuid,
        serverUuid,
        applicationUuid: null,
        deploymentUuid: null,
        appName,
        createdProject,
        createdApplication,
        error: createResult.error || "Failed to create Coolify application",
        steps,
        data: createResult.data,
      }
    }

    applicationUuid = extractUuid(createResult.data)
    createdApplication = true
    if (!applicationUuid) {
      return {
        success: false,
        projectUuid,
        serverUuid,
        applicationUuid: null,
        deploymentUuid: null,
        appName,
        createdProject,
        createdApplication: true,
        error: "Created application but could not read UUID from response",
        steps,
        data: createResult.data,
      }
    }
  } else if (input.source) {
    const patch = await coolify.updateApplication(applicationUuid, {
      git_repository: gitUrl,
      git_branch: gitBranch,
      ...(domainUrl ? { domains: domainUrl } : {}),
      build_pack: buildPack,
      ports_exposes: portsExposes,
    })
    steps.push(toStep("applications.update", patch))
    if (!patch.ok) {
      return {
        success: false,
        projectUuid,
        serverUuid,
        applicationUuid,
        deploymentUuid: null,
        appName,
        createdProject,
        createdApplication,
        error: patch.error || "Failed to update Coolify application source",
        steps,
        data: patch.data,
      }
    }
  }

  if (input.env && Object.keys(input.env).length > 0 && applicationUuid) {
    const envResult = await coolify.bulkUpdateEnvs(applicationUuid, envRecordToCoolifyBulk(input.env))
    steps.push(toStep("applications.envs.bulk", envResult))
    if (!envResult.ok) {
      return {
        success: false,
        projectUuid,
        serverUuid,
        applicationUuid,
        deploymentUuid: null,
        appName,
        createdProject,
        createdApplication,
        error: envResult.error || "Failed to sync environment variables",
        steps,
        data: envResult.data,
      }
    }
  }

  const deployResult = await coolify.deploy(applicationUuid, false)
  steps.push(toStep("deploy", deployResult))
  if (!deployResult.ok) {
    const fallback = await coolify.restartApplication(applicationUuid, { force: false })
    steps.push(toStep("applications.restart", fallback))
    if (!fallback.ok) {
      return {
        success: false,
        projectUuid,
        serverUuid,
        applicationUuid,
        deploymentUuid: null,
        appName,
        createdProject,
        createdApplication,
        error: deployResult.error || fallback.error || "Failed to trigger deployment",
        steps,
        data: deployResult.data,
      }
    }
    const deploymentUuid = extractDeploymentUuid(fallback.data)
    return {
      success: true,
      projectUuid,
      serverUuid,
      applicationUuid,
      deploymentUuid,
      appName,
      createdProject,
      createdApplication,
      error: null,
      steps,
      data: fallback.data,
    }
  }

  const deploymentUuid = extractDeploymentUuid(deployResult.data)
  return {
    success: true,
    projectUuid,
    serverUuid,
    applicationUuid,
    deploymentUuid,
    appName,
    createdProject,
    createdApplication,
    error: null,
    steps,
    data: deployResult.data,
  }
}

export async function checkCoolifyHealth(): Promise<{
  reachable: boolean
  apiUrl: string
  hasKey: boolean
  version?: string
  latencyMs?: number
  error?: string
}> {
  const hasKey = Boolean(process.env.DEPLOYER_API_KEY)
  let apiUrl = process.env.DEPLOYER_API_URL || ""
  if (!hasKey || !apiUrl) {
    return { reachable: false, apiUrl, hasKey, error: "DEPLOYER_API_KEY or DEPLOYER_API_URL is not set" }
  }
  apiUrl = apiUrl.replace(/\/+$/, "")
  const started = Date.now()
  const health = await coolify.health()
  const latencyMs = Date.now() - started
  if (!health.ok) {
    return { reachable: false, apiUrl, hasKey, latencyMs, error: health.error || "Health check failed" }
  }
  const version = await coolify.version()
  return {
    reachable: true,
    apiUrl,
    hasKey,
    latencyMs,
    version: typeof version.data === "string" ? version.data : undefined,
    error: undefined,
  }
}
