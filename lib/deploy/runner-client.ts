const DEFAULT_COMPANION_API_BASE = process.env.SYCORD_DEPLOY_API_BASE || "https://sycord.site"

export type DeploymentMode = "api"

export type DeployFile = {
  path: string
  content: string
}

export type ProjectEnvVar = {
  key?: string
  value?: string
}

export type CompanionDeployResponse = {
  success: boolean
  message: string | null
  projectName: string | null
  url: string | null
  username: string | null
  repoId: string | null
  raw: any
}

export type DeployStreamEvent =
  | {
      type: "stage"
      stage:
        | "queued"
        | "preparing"
        | "preparing-files"
        | "github"
        | "health-check"
        | "deploy-api"
        | "saving"
        | "complete"
        | "failed"
      status: "pending" | "running" | "success" | "error"
      message: string
      timestamp: string
    }
  | {
      type: "log"
      source: "sycord" | "api" | "health" | "github"
      line: string
      timestamp: string
    }
  | {
      type: "result"
      success: true
      url: string
      domain: string
      repoId?: string
      health: unknown
      warning?: string
      timestamp: string
    }
  | {
      type: "error"
      error: string
      stage?: string
      logs?: string[]
      timestamp: string
    }

function now() {
  return new Date().toISOString()
}

function stripLeadingSlash(input: string) {
  return input.replace(/^\/+/, "")
}

function toAbsoluteUrl(urlOrDomain: string | null | undefined) {
  if (!urlOrDomain) return null
  return /^https?:\/\//.test(urlOrDomain) ? urlOrDomain : `https://${urlOrDomain}`
}

function getCompanionApiBase() {
  return (process.env.SYCORD_DEPLOY_API_BASE || DEFAULT_COMPANION_API_BASE).replace(/\/+$/, "")
}

function assertNumericRepoId(repoId: string | number) {
  const value = String(repoId)
  if (!/^\d+$/.test(value)) {
    throw new Error("Companion Server repository IDs must be numeric strings")
  }
  return value
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

export function validateApiDeployFiles(files: DeployFile[]): string[] {
  const errors: string[] = []

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

export function normalizeCompanionDeployResponse(input: any, repoId?: string): CompanionDeployResponse {
  const url = toAbsoluteUrl(input?.url || input?.domain || input?.cloudflareUrl || null)
  return {
    success: input?.success === true,
    message: input?.message ? String(input.message) : null,
    projectName: input?.project || input?.projectName || input?.name || null,
    url,
    username: input?.username || null,
    repoId: input?.repo_id ? String(input.repo_id) : repoId || null,
    raw: input,
  }
}

export async function callCompanionHealth() {
  const response = await fetch(`${getCompanionApiBase()}/api/health`, { headers: { Accept: "application/json" } })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(json?.error || json?.message || `Companion Server health check failed with HTTP ${response.status}`)
  }
  return json
}

export async function callCompanionDeploy(repoId: string | number): Promise<CompanionDeployResponse> {
  const numericRepoId = assertNumericRepoId(repoId)
  const response = await fetch(`${getCompanionApiBase()}/api/deploy/${numericRepoId}`, {
    method: "POST",
    headers: { Accept: "application/json" },
  })
  const json = await response.json().catch(() => ({ success: false, error: "Invalid Companion Server response" }))
  const normalized = normalizeCompanionDeployResponse(json, numericRepoId)
  if (!response.ok || !normalized.success) {
    throw Object.assign(new Error(json?.error || json?.message || `Companion Server deployment failed with HTTP ${response.status}`), {
      response: json,
    })
  }
  return normalized
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
  repoId?: string | null
  health: unknown
  warning?: string
}): DeployStreamEvent {
  return {
    type: "result",
    success: true,
    url: result.url,
    domain: result.domain,
    repoId: result.repoId ?? undefined,
    health: result.health,
    warning: result.warning,
    timestamp: now(),
  }
}

export function toSseChunk(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

export function redactSecrets(input: string): string {
  return input
    .replace(/(token|secret|apikey|api_key|password)\s*[:=]\s*([^\s]+)/gi, "$1=[redacted]")
    .replace(/(TURSO_AUTH_TOKEN|GITHUB_TOKEN|GITHUB_API_TOKEN|DATABASE_URL)=([^\s]+)/g, "$1=[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]")
    .replace(/libsql:\/\/[^\s]+/gi, "[redacted-database-url]")
}
