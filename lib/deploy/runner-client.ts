const DEFAULT_SYCORD_DOMAIN = process.env.SYCORD_BASE_DOMAIN || "sycord.site"

export type DeploymentMode = "ssh"

export type DeployFile = {
  path: string
  content: string
}

export type ProjectEnvVar = {
  key?: string
  value?: string
}

export type DeployStreamEvent =
  | {
      type: "stage"
      stage:
        | "queued"
        | "preparing"
        | "container-setup"
        | "upload"
        | "build"
        | "publish"
        | "health-check"
        | "complete"
        | "failed"
      status: "pending" | "running" | "success" | "error"
      message: string
      timestamp: string
    }
  | {
      type: "log"
      source: "ssh" | "build" | "publish" | "health"
      line: string
      timestamp: string
    }
  | {
      type: "result"
      success: true
      url: string
      domain: string
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
  health: unknown
  warning?: string
}): DeployStreamEvent {
  return {
    type: "result",
    success: true,
    url: result.url,
    domain: result.domain,
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
    .replace(/(token|secret|apikey|api_key|password|privatekey)\s*[:=]\s*([^\s]+)/gi, "$1=[redacted]")
    .replace(/(TURSO_AUTH_TOKEN|GITHUB_TOKEN|GITHUB_API_TOKEN|DATABASE_URL)=([^\s]+)/g, "$1=[redacted]")
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, "[redacted-database-url]")
    .replace(/libsql:\/\/[^\s]+/gi, "[redacted-database-url]")
    .replace(/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[^-]*-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/gi, "[redacted-ssh-key]")
}

export function getSycordDomain(): string {
  return DEFAULT_SYCORD_DOMAIN
}
