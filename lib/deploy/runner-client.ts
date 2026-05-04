const DEFAULT_RUNNER_URL = process.env.VPS_SERVER_URL || "https://server.sycord.site"

export type DeploymentMode = "next-server"

export type DeployFile = {
  path: string
  content: string
}

export type ProjectEnvVar = {
  key?: string
  value?: string
}

export type RunnerDeployPayload = {
  projectId?: string
  repoUrl: string
  branch: string
  repoName?: string
  subdomain: string
  deployment_mode: DeploymentMode
  env_vars?: Record<string, string>
  files?: DeployFile[]
}

export type DeployStageStatus = "pending" | "running" | "success" | "error"

export type RunnerHealth = {
  ok: boolean
  htmlOk: boolean
  status?: number | null
  contentType?: string | null
  latencyMs?: number | null
  error?: string | null
  detail?: string | null
  url?: string | null
  protocol?: "https" | "http" | null
}

export type RunnerDeployResponse = {
  success: boolean
  domain: string | null
  url: string | null
  port: number | null
  running: boolean
  build: {
    ok: boolean
    logs: string[]
    error?: string | null
  }
  health: RunnerHealth
  localHealth?: RunnerHealth | null
  publicHealth?: RunnerHealth | null
  processName: string | null
  logs: {
    deploy: string[]
    build: string[]
    runtime: string[]
    error: string[]
    health: string[]
  }
  error?: string | null
  warning?: string | null
  raw: any
}

export type DeployStreamEvent =
  | {
      type: "stage"
      stage:
        | "queued"
        | "github"
        | "vm-connect"
        | "runner-git"
        | "installing"
        | "building"
        | "starting-server"
        | "configuring-proxy"
        | "public-health"
        | "saving"
        | "complete"
        | "failed"
      status: DeployStageStatus
      message: string
      timestamp: string
    }
  | {
      type: "log"
      source: "sycord" | "vm" | "runner" | "install" | "build" | "runtime" | "proxy" | "health" | "github"
      line: string
      timestamp: string
    }
  | {
      type: "result"
      success: true
      url: string
      domain: string
      port?: number
      health: unknown
      localHealth?: unknown
      publicHealth?: unknown
      warning?: string
      timestamp: string
    }
  | {
      type: "error"
      error: string
      stage?: string
      logs?: string[]
      localHealth?: unknown
      publicHealth?: unknown
      timestamp: string
    }

function now() {
  return new Date().toISOString()
}

function stripLeadingSlash(input: string) {
  return input.replace(/^\/+/, "")
}

export function prepareProjectDeployFiles(project: any): DeployFile[] {
  const pages = Array.isArray(project?.pages) ? project.pages : []
  return pages
    .filter((page: any) => typeof page?.name === "string" && typeof page?.content === "string")
    .map((page: any) => ({
      path: stripLeadingSlash(page.name),
      content: page.content,
    }))
}

export function validateNextServerDeployFiles(files: DeployFile[]): string[] {
  const errors: string[] = []
  const fileMap = new Map(files.map((file) => [file.path, file.content]))

  if (!files.length) {
    errors.push("No files to deploy")
    return errors
  }

  for (const file of files) {
    if (!file.path || file.path.startsWith("/") || file.path.includes("..")) {
      errors.push(`Invalid deploy path: ${file.path || "(empty)"}`)
      continue
    }
    if (/^\.env(?:\.|$)/.test(file.path) || /\/\.env(?:\.|$)/.test(file.path)) {
      errors.push(`Env files must not be deployed: ${file.path}`)
    }
  }

  const nextConfig = fileMap.get("next.config.mjs") || ""
  if (!nextConfig) {
    errors.push("Missing next.config.mjs")
  } else if (/output\s*:\s*["']export["']/.test(nextConfig)) {
    errors.push('next.config.mjs must not contain output: "export"')
  }

  const packageJson = fileMap.get("package.json") || ""
  try {
    const pkg = JSON.parse(packageJson) as { scripts?: Record<string, string> }
    if (pkg.scripts?.build !== "next build") {
      errors.push('package.json must include `build: "next build"`')
    }
    if (!pkg.scripts?.start || !/next start\b/.test(pkg.scripts.start) || !/-H 0\.0\.0\.0/.test(pkg.scripts.start)) {
      errors.push('package.json must include `start: "next start -H 0.0.0.0"`')
    }
  } catch {
    errors.push("Missing or invalid package.json")
  }

  if (!fileMap.has("app/page.tsx")) {
    errors.push("Missing app/page.tsx")
  }
  if (!fileMap.has("app/layout.tsx")) {
    errors.push("Missing app/layout.tsx")
  }

  return errors
}

export function getProjectEnvVars(project: any): Record<string, string> {
  const envVars: Record<string, string> = {}
  const values = Array.isArray(project?.envVars) ? (project.envVars as ProjectEnvVar[]) : []
  for (const envVar of values) {
    if (envVar?.key && typeof envVar.value === "string" && envVar.value.length > 0) {
      envVars[envVar.key] = envVar.value
    }
  }
  return envVars
}

function toAbsoluteUrl(urlOrDomain: string | null | undefined) {
  if (!urlOrDomain) return null
  return /^https?:\/\//.test(urlOrDomain) ? urlOrDomain : `https://${urlOrDomain}`
}

function toStringArray(input: unknown): string[] {
  return Array.isArray(input) ? input.map((value) => String(value)) : []
}

function toNumberOrNull(input: unknown) {
  return typeof input === "number" && Number.isFinite(input) ? input : null
}

function normalizeHealth(input: any, topLevelFallback?: any): RunnerHealth {
  const source = input || {}
  const fallback = topLevelFallback || {}
  return {
    ok: source?.ok === true || fallback?.health_ok === true,
    htmlOk: source?.htmlOk === true || source?.html_ok === true || fallback?.html_ok === true,
    status: toNumberOrNull(source?.status ?? source?.statusCode),
    contentType: source?.contentType || source?.content_type || null,
    latencyMs: toNumberOrNull(source?.latencyMs ?? source?.latency_ms),
    error: source?.error || null,
    detail: source?.detail || null,
    url: source?.url || null,
    protocol: source?.protocol === "https" || source?.protocol === "http" ? source.protocol : null,
  }
}

export function normalizeRunnerDeployResponse(input: any): RunnerDeployResponse {
  const domain = input?.domain ? String(input.domain).replace(/^https?:\/\//, "") : null
  const localHealth = input?.localHealth ? normalizeHealth(input.localHealth) : null
  const publicHealth = input?.publicHealth ? normalizeHealth(input.publicHealth) : null
  const health = normalizeHealth(input?.health, input)
  const url = toAbsoluteUrl(input?.url || publicHealth?.url || input?.domain || input?.cloudflareUrl || null)
  const buildOk = input?.build?.ok === true || input?.build?.built === true || input?.build === true
  const runtimeLogs = toStringArray(input?.runtimeLogs ?? input?.logs?.runtime)
  const buildLogs = toStringArray(input?.buildLogs ?? input?.build?.logs)
  const deployLogs = toStringArray(input?.deployLogs ?? input?.logs)
  const errorLogs = toStringArray(input?.errorLogs ?? input?.logs?.error)
  const healthLogs = toStringArray(input?.healthLogs ?? input?.logs?.health)

  return {
    success: input?.success === true,
    domain,
    url,
    port: typeof input?.port === "number" ? input.port : null,
    running: input?.running === true,
    build: {
      ok: buildOk,
      logs: buildLogs,
      error: input?.build?.error || null,
    },
    health,
    localHealth,
    publicHealth,
    processName: input?.processName || input?.process_name || null,
    logs: {
      deploy: deployLogs,
      build: buildLogs,
      runtime: runtimeLogs,
      error: errorLogs,
      health: healthLogs,
    },
    error: input?.error || input?.message || health.error || publicHealth?.error || null,
    warning: input?.warning || null,
    raw: input,
  }
}

export function isSuccessfulRunnerDeployResponse(input: any): boolean {
  const normalized = normalizeRunnerDeployResponse(input)
  const publicHealthOk = normalized.publicHealth
    ? normalized.publicHealth.ok && normalized.publicHealth.htmlOk
    : true
  return (
    normalized.success &&
    normalized.build.ok &&
    normalized.running &&
    normalized.health.ok &&
    normalized.health.htmlOk &&
    publicHealthOk &&
    Boolean(normalized.domain)
  )
}

function getRunnerHeaders(extra?: HeadersInit): HeadersInit {
  const headers = new Headers(extra)
  headers.set("Content-Type", "application/json")
  if (process.env.VPS_RUNNER_TOKEN) {
    headers.set("Authorization", `Bearer ${process.env.VPS_RUNNER_TOKEN}`)
  }
  return headers
}

export async function callRunnerDeploy(projectId: string, payload: RunnerDeployPayload): Promise<RunnerDeployResponse> {
  const response = await fetch(`${DEFAULT_RUNNER_URL}/api/deploy/${projectId}`, {
    method: "POST",
    headers: getRunnerHeaders(),
    body: JSON.stringify(payload),
  })

  const json = await response.json().catch(() => ({ success: false, error: "Invalid runner response" }))
  const normalized = normalizeRunnerDeployResponse(json)
  if (!response.ok && !normalized.error) {
    normalized.error = `Runner request failed with HTTP ${response.status}`
  }
  return normalized
}

export async function callRunnerDeployStream(projectId: string, payload: RunnerDeployPayload): Promise<Response> {
  return fetch(`${DEFAULT_RUNNER_URL}/api/deploy/${projectId}/stream`, {
    method: "POST",
    headers: getRunnerHeaders({ Accept: "text/event-stream" }),
    body: JSON.stringify(payload),
  })
}

export function createStageEvent(
  stage: Extract<DeployStreamEvent, { type: "stage" }>["stage"],
  status: Extract<DeployStreamEvent, { type: "stage" }>["status"],
  message: string,
): DeployStreamEvent {
  return { type: "stage", stage, status, message, timestamp: now() }
}

export function createLogEvent(
  source: Extract<DeployStreamEvent, { type: "log" }>["source"],
  line: string,
): DeployStreamEvent {
  return { type: "log", source, line: redactSecrets(line), timestamp: now() }
}

export function createErrorEvent(error: string, stage?: string, logs?: string[]): DeployStreamEvent {
  return {
    type: "error",
    error: redactSecrets(error),
    stage,
    logs: logs?.map((line) => redactSecrets(line)),
    timestamp: now(),
  }
}

export function createResultEvent(result: {
  url: string
  domain: string
  port?: number | null
  health: unknown
  localHealth?: unknown
  publicHealth?: unknown
  warning?: string
}): DeployStreamEvent {
  return {
    type: "result",
    success: true,
    url: result.url,
    domain: result.domain,
    port: result.port ?? undefined,
    health: result.health,
    localHealth: result.localHealth,
    publicHealth: result.publicHealth,
    warning: result.warning,
    timestamp: now(),
  }
}

export function toSseChunk(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function parseSseChunk(chunk: string): Array<{ event: string; data: any }> {
  const events: Array<{ event: string; data: any }> = []
  const blocks = chunk.split("\n\n")
  for (const block of blocks) {
    if (!block.trim()) continue
    const lines = block.split("\n")
    const eventLine = lines.find((line) => line.startsWith("event:"))
    const dataLine = lines.find((line) => line.startsWith("data:"))
    if (!eventLine || !dataLine) continue
    const event = eventLine.slice(6).trim()
    const rawData = dataLine.slice(5).trim()
    try {
      events.push({ event, data: JSON.parse(rawData) })
    } catch {
      events.push({ event, data: { raw: rawData } })
    }
  }
  return events
}

export function redactSecrets(input: string): string {
  return input
    .replace(/(token|secret|apikey|api_key|password)\s*[:=]\s*([^\s]+)/gi, "$1=[redacted]")
    .replace(/(TURSO_AUTH_TOKEN|GITHUB_TOKEN|GITHUB_API_TOKEN|DATABASE_URL|VPS_RUNNER_TOKEN)=([^\s]+)/g, "$1=[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]")
    .replace(/libsql:\/\/[^\s]+/gi, "[redacted-database-url]")
}
