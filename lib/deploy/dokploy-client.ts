// ---------------------------------------------------------------------------
// Dokploy API client — the "version" container deployment platform.
//
// Talks to a Dokploy instance over its tRPC-flavoured REST API. Every endpoint
// is namespaced (e.g. `docker.getContainers`, `application.deploy`) and
// authenticated with an `x-api-key` header.
//
// Docs:
//   https://docs.dokploy.com/docs/api/docker
//   https://docs.dokploy.com/docs/api/application
//
// Configure via env (see .env.example):
//   DOKPLOY_API_URL   -> base API url   (default: https://sycord.site/api)
//   DOKPLOY_API_KEY   -> x-api-key token
//   DOKPLOY_SERVER_ID -> optional default serverId forwarded to every call
// ---------------------------------------------------------------------------

const DEFAULT_DOKPLOY_API_URL = process.env.DOKPLOY_API_URL || "https://sycord.site/api"

export type DokployResult<T = unknown> = {
  ok: boolean
  status: number
  /** Parsed response body when the request succeeded. */
  data: T | null
  /** Human-readable error when `ok` is false. */
  error: string | null
  /** The fully-qualified endpoint that was called (handy for debugging). */
  endpoint: string
}

export type DokployConfig = {
  apiUrl: string
  apiKey: string
  serverId?: string
  /** Dokploy environmentId an application is created under (required to create). */
  environmentId?: string
}

export class DokployConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DokployConfigError"
  }
}

/** Reads + validates Dokploy config from the environment. Throws if no key. */
export function getDokployConfig(): DokployConfig {
  const apiUrl = (process.env.DOKPLOY_API_URL || DEFAULT_DOKPLOY_API_URL).replace(/\/+$/, "")
  const apiKey = process.env.DOKPLOY_API_KEY || ""
  const serverId = process.env.DOKPLOY_SERVER_ID || undefined
  const environmentId = process.env.DOKPLOY_ENVIRONMENT_ID || undefined

  if (!apiKey) {
    throw new DokployConfigError(
      "DOKPLOY_API_KEY is not set. Add it to your environment to use the Dokploy deployer.",
    )
  }

  return { apiUrl, apiKey, serverId, environmentId }
}

/** Whether the Dokploy client has the minimum config to run. */
export function isDokployConfigured(): boolean {
  return Boolean(process.env.DOKPLOY_API_KEY)
}

function buildUrl(apiUrl: string, endpoint: string, query?: Record<string, unknown>): string {
  const url = new URL(`${apiUrl}/${endpoint}`)
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
    // Dokploy/tRPC error shapes seen in the wild.
    return (
      obj.error?.message ||
      obj.error?.json?.message ||
      obj.message ||
      obj.error ||
      `Request failed with status ${status}`
    )
  }
  if (typeof body === "string" && body.trim()) return body
  return `Request failed with status ${status}`
}

type RequestOptions = {
  method: "GET" | "POST"
  endpoint: string
  query?: Record<string, unknown>
  body?: Record<string, unknown>
  /** Override the env config (mainly for testing). */
  config?: DokployConfig
  /** Abort the request after this many ms (default 30s). */
  timeoutMs?: number
}

/** Low-level request used by every typed method below. */
export async function dokployRequest<T = unknown>(opts: RequestOptions): Promise<DokployResult<T>> {
  let config: DokployConfig
  try {
    config = opts.config || getDokployConfig()
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.message || "Dokploy is not configured",
      endpoint: opts.endpoint,
    }
  }

  // Forward the default serverId for any endpoint that accepts it, unless the
  // caller already provided one explicitly.
  const query = { ...opts.query }
  const body = { ...opts.body }
  if (config.serverId) {
    if (opts.method === "GET" && query.serverId === undefined) query.serverId = config.serverId
    if (opts.method === "POST" && body.serverId === undefined) body.serverId = config.serverId
  }

  const url = buildUrl(config.apiUrl, opts.endpoint, opts.method === "GET" ? query : undefined)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000)

  try {
    const res = await fetch(url, {
      method: opts.method,
      headers: {
        "x-api-key": config.apiKey,
        Accept: "application/json",
        ...(opts.method === "POST" ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.method === "POST" ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    })

    const parsed = await parseBody(res)

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: null,
        error: extractError(res.status, parsed),
        endpoint: opts.endpoint,
      }
    }

    return { ok: true, status: res.status, data: parsed as T, error: null, endpoint: opts.endpoint }
  } catch (err: any) {
    const aborted = err?.name === "AbortError"
    return {
      ok: false,
      status: 0,
      data: null,
      error: aborted ? "Dokploy request timed out" : err?.message || "Dokploy request failed",
      endpoint: opts.endpoint,
    }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Docker container API — https://docs.dokploy.com/docs/api/docker
// ---------------------------------------------------------------------------

export type DockerContainer = {
  containerId: string
  name?: string
  image?: string
  state?: string
  status?: string
  [key: string]: unknown
}

type ServerScoped = { serverId?: string }

export const docker = {
  /** GET /docker.getContainers */
  getContainers(opts: ServerScoped = {}) {
    return dokployRequest<DockerContainer[]>({
      method: "GET",
      endpoint: "docker.getContainers",
      query: opts,
    })
  },

  /** POST /docker.restartContainer */
  restartContainer(containerId: string, opts: ServerScoped = {}) {
    return dokployRequest({
      method: "POST",
      endpoint: "docker.restartContainer",
      body: { containerId, ...opts },
    })
  },

  /** POST /docker.startContainer */
  startContainer(containerId: string, opts: ServerScoped = {}) {
    return dokployRequest({
      method: "POST",
      endpoint: "docker.startContainer",
      body: { containerId, ...opts },
    })
  },

  /** POST /docker.stopContainer */
  stopContainer(containerId: string, opts: ServerScoped = {}) {
    return dokployRequest({
      method: "POST",
      endpoint: "docker.stopContainer",
      body: { containerId, ...opts },
    })
  },

  /** POST /docker.killContainer */
  killContainer(containerId: string, opts: ServerScoped = {}) {
    return dokployRequest({
      method: "POST",
      endpoint: "docker.killContainer",
      body: { containerId, ...opts },
    })
  },

  /** POST /docker.removeContainer */
  removeContainer(containerId: string, opts: ServerScoped = {}) {
    return dokployRequest({
      method: "POST",
      endpoint: "docker.removeContainer",
      body: { containerId, ...opts },
    })
  },

  /** GET /docker.getConfig */
  getConfig(containerId: string, opts: ServerScoped = {}) {
    return dokployRequest({
      method: "GET",
      endpoint: "docker.getConfig",
      query: { containerId, ...opts },
    })
  },

  /** GET /docker.getContainersByAppNameMatch */
  getContainersByAppNameMatch(appName: string, opts: { appType?: string } & ServerScoped = {}) {
    return dokployRequest<DockerContainer[]>({
      method: "GET",
      endpoint: "docker.getContainersByAppNameMatch",
      query: { appName, ...opts },
    })
  },

  /** GET /docker.getContainersByAppLabel */
  getContainersByAppLabel(appName: string, type: string, opts: ServerScoped = {}) {
    return dokployRequest<DockerContainer[]>({
      method: "GET",
      endpoint: "docker.getContainersByAppLabel",
      query: { appName, type, ...opts },
    })
  },

  /** GET /docker.getStackContainersByAppName */
  getStackContainersByAppName(appName: string, opts: ServerScoped = {}) {
    return dokployRequest<DockerContainer[]>({
      method: "GET",
      endpoint: "docker.getStackContainersByAppName",
      query: { appName, ...opts },
    })
  },

  /** GET /docker.getServiceContainersByAppName */
  getServiceContainersByAppName(appName: string, opts: ServerScoped = {}) {
    return dokployRequest<DockerContainer[]>({
      method: "GET",
      endpoint: "docker.getServiceContainersByAppName",
      query: { appName, ...opts },
    })
  },
}

// ---------------------------------------------------------------------------
// Application API — https://docs.dokploy.com/docs/api/application
// (only the deploy-relevant surface is wrapped here)
// ---------------------------------------------------------------------------

export type DokployApplication = {
  applicationId: string
  name?: string
  appName?: string
  applicationStatus?: string
  environmentId?: string
  [key: string]: unknown
}

export const application = {
  /** POST /application.create */
  create(input: {
    name: string
    environmentId: string
    appName?: string
    description?: string | null
    serverId?: string | null
  }) {
    return dokployRequest<DokployApplication>({
      method: "POST",
      endpoint: "application.create",
      body: { ...input },
    })
  },

  /** GET /application.one */
  one(applicationId: string) {
    return dokployRequest<DokployApplication>({
      method: "GET",
      endpoint: "application.one",
      query: { applicationId },
    })
  },

  /** POST /application.deploy */
  deploy(applicationId: string, opts: { title?: string; description?: string } = {}) {
    return dokployRequest({
      method: "POST",
      endpoint: "application.deploy",
      body: { applicationId, ...opts },
    })
  },

  /** POST /application.redeploy */
  redeploy(applicationId: string, opts: { title?: string; description?: string } = {}) {
    return dokployRequest({
      method: "POST",
      endpoint: "application.redeploy",
      body: { applicationId, ...opts },
    })
  },

  /** POST /application.start */
  start(applicationId: string) {
    return dokployRequest({
      method: "POST",
      endpoint: "application.start",
      body: { applicationId },
    })
  },

  /** POST /application.stop */
  stop(applicationId: string) {
    return dokployRequest({
      method: "POST",
      endpoint: "application.stop",
      body: { applicationId },
    })
  },

  /** POST /application.reload */
  reload(applicationId: string, appName: string) {
    return dokployRequest({
      method: "POST",
      endpoint: "application.reload",
      body: { applicationId, appName },
    })
  },

  /** POST /application.saveEnvironment */
  saveEnvironment(input: {
    applicationId: string
    env: string | null
    buildArgs?: string | null
    buildSecrets?: string | null
    createEnvFile?: boolean
  }) {
    return dokployRequest({
      method: "POST",
      endpoint: "application.saveEnvironment",
      body: {
        buildArgs: null,
        buildSecrets: null,
        createEnvFile: true,
        ...input,
      },
    })
  },

  /** GET /application.readLogs */
  readLogs(applicationId: string, opts: { tail?: number; since?: string; search?: string } = {}) {
    return dokployRequest({
      method: "GET",
      endpoint: "application.readLogs",
      query: { applicationId, ...opts },
    })
  },

  /** GET /application.search */
  search(opts: {
    q?: string
    name?: string
    appName?: string
    projectId?: string
    environmentId?: string
    limit?: number
    offset?: number
  } = {}) {
    return dokployRequest<DokployApplication[]>({
      method: "GET",
      endpoint: "application.search",
      query: { ...opts },
    })
  },
}

/** Serialises an env-var record into the newline-delimited form Dokploy expects. */
export function toDokployEnvString(envVars: Record<string, string>): string {
  return Object.entries(envVars)
    .filter(([key]) => key)
    .map(([key, value]) => `${key}=${value}`)
    .join("\n")
}


// ---------------------------------------------------------------------------
// High-level orchestration: "make a container (if not yet made) and deploy".
//
// This is what the Syra AI builder's deploy() tool calls. It:
//   1. Uses an existing Dokploy applicationId when the project already has one.
//   2. Otherwise creates a fresh application (the "container") via
//      application.create.
//   3. Optionally syncs env vars.
//   4. Triggers a deployment via application.deploy.
// ---------------------------------------------------------------------------

export type EnsureDeployStep = {
  step: string
  ok: boolean
  status: number
  endpoint: string
  error: string | null
}

export type EnsureDeployResult = {
  success: boolean
  /** The Dokploy applicationId used or created. */
  applicationId: string | null
  appName: string | null
  /** True when a brand-new application was created during this call. */
  created: boolean
  /** First non-null error encountered. */
  error: string | null
  steps: EnsureDeployStep[]
  /** Raw payload from the final deploy call. */
  data: unknown
}

/** Best-effort extraction of an applicationId from Dokploy's create response. */
export function extractApplicationId(data: unknown): string | null {
  if (!data || typeof data !== "object") return null
  const obj = data as Record<string, any>
  return (
    obj.applicationId ||
    obj.id ||
    obj.result?.data?.json?.applicationId ||
    obj.result?.data?.json?.id ||
    obj.json?.applicationId ||
    obj.data?.applicationId ||
    obj.data?.id ||
    null
  )
}

function toStep(step: string, result: DokployResult): EnsureDeployStep {
  return {
    step,
    ok: result.ok,
    status: result.status,
    endpoint: result.endpoint,
    error: result.error,
  }
}

export type EnsureAndDeployInput = {
  /** Human-readable name for the Dokploy application. */
  name: string
  /** Stable slug used as appName + for the public URL. */
  appName?: string
  /** Pass when the project already has a Dokploy application. */
  existingApplicationId?: string | null
  /** Override the env-configured environmentId (required to create). */
  environmentId?: string
  /** Override the env-configured serverId. */
  serverId?: string | null
  /** Env vars to persist before deploying. */
  env?: Record<string, string> | null
  title?: string
  description?: string
}

export async function ensureAndDeployApplication(
  input: EnsureAndDeployInput,
): Promise<EnsureDeployResult> {
  const steps: EnsureDeployStep[] = []

  let config: DokployConfig
  try {
    config = getDokployConfig()
  } catch (err: any) {
    return {
      success: false,
      applicationId: input.existingApplicationId || null,
      appName: input.appName || null,
      created: false,
      error: err?.message || "Dokploy is not configured",
      steps,
      data: null,
    }
  }

  let applicationId = input.existingApplicationId || null
  let created = false

  // 1. Create the application/container if the project doesn't have one yet.
  if (!applicationId) {
    const environmentId = input.environmentId || config.environmentId
    if (!environmentId) {
      return {
        success: false,
        applicationId: null,
        appName: input.appName || null,
        created: false,
        error:
          "Cannot create a Dokploy application: no environmentId. Set DOKPLOY_ENVIRONMENT_ID or store one on the project.",
        steps,
        data: null,
      }
    }

    const createResult = await application.create({
      name: input.name,
      appName: input.appName,
      environmentId,
      serverId: input.serverId ?? config.serverId ?? null,
    })
    steps.push(toStep("create", createResult))

    if (!createResult.ok) {
      return {
        success: false,
        applicationId: null,
        appName: input.appName || null,
        created: false,
        error: createResult.error || "Failed to create Dokploy application",
        steps,
        data: null,
      }
    }

    applicationId = extractApplicationId(createResult.data)
    created = true

    if (!applicationId) {
      return {
        success: false,
        applicationId: null,
        appName: input.appName || null,
        created: true,
        error: "Created the application but could not determine its applicationId from the response.",
        steps,
        data: createResult.data,
      }
    }
  }

  // 2. Sync env vars (optional, best-effort but surfaced on failure).
  if (input.env && Object.keys(input.env).length > 0) {
    const envResult = await application.saveEnvironment({
      applicationId,
      env: toDokployEnvString(input.env),
      createEnvFile: true,
    })
    steps.push(toStep("saveEnvironment", envResult))
    if (!envResult.ok) {
      return {
        success: false,
        applicationId,
        appName: input.appName || null,
        created,
        error: envResult.error || "Failed to save environment variables",
        steps,
        data: null,
      }
    }
  }

  // 3. Trigger the deployment.
  const deployResult = await application.deploy(applicationId, {
    title: input.title,
    description: input.description,
  })
  steps.push(toStep("deploy", deployResult))

  if (!deployResult.ok) {
    return {
      success: false,
      applicationId,
      appName: input.appName || null,
      created,
      error: deployResult.error || "Failed to start deployment",
      steps,
      data: deployResult.data,
    }
  }

  return {
    success: true,
    applicationId,
    appName: input.appName || null,
    created,
    error: null,
    steps,
    data: deployResult.data,
  }
}
