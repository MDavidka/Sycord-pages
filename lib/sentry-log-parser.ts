import crypto from "crypto"

export type SentryIssueSource = "vm-build" | "vm-deploy" | "ai-generation" | "website-runtime"
export type SentryIssueStatus = "new" | "skipped" | "marked" | "fixed"
export type SentryAIDecisionValue = "skip" | "mark"

export interface SentryIssue {
  id: string
  projectId: string
  source: SentryIssueSource
  deploymentId?: string
  rawLog: string
  logHash: string
  status: SentryIssueStatus
  aiDecision?: SentryAIDecisionValue
  errorName?: string
  description?: string
  fixSuggestion?: string
  affectedFile?: string
  createdAt: Date
  updatedAt: Date
}

export interface ExtractedSentryLog {
  source: SentryIssueSource
  rawLog: string
  deploymentId?: string
  logHash: string
}

const BUILD_FAILURE_PATTERNS = [
  /failed to compile/i,
  /type error/i,
  /module not found/i,
  /cannot find module/i,
  /npm run build exited/i,
  /build failed/i,
  /referenceerror/i,
  /syntaxerror/i,
  /\berror:/i,
]

const NON_ACTIONABLE_PATTERNS = [
  /\bnpm warn(?:ing)?\b/i,
  /\bdns\b/i,
  /\btunnel\b/i,
  /take a peek over at/i,
  /deployment complete/i,
  /compiled successfully/i,
  /build completed/i,
]

const SECRET_PATTERNS: Array<[RegExp, string]> = [
  [/\bTURSO_AUTH_TOKEN\s*=\s*([^\s"'`]+)/gi, "TURSO_AUTH_TOKEN=[REDACTED]"],
  [/\bOPENROUTER_API_KEY\s*=\s*([^\s"'`]+)/gi, "OPENROUTER_API_KEY=[REDACTED]"],
  [/\b(GITHUB_TOKEN|GITHUB_API_TOKEN)\s*=\s*([^\s"'`]+)/gi, "$1=[REDACTED]"],
  [/\b[A-Za-z0-9_]*(?:API[_-]?KEY|TOKEN|SECRET|PASSWORD)[A-Za-z0-9_]*\s*[:=]\s*["']?[^"'\s`]+["']?/gi, "[REDACTED_SECRET]"],
  [/Bearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, "Bearer [REDACTED]"],
  [/gh[pousr]_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]"],
  [/github_pat_[A-Za-z0-9_]{20,}/g, "[REDACTED_GITHUB_TOKEN]"],
  [/sk-or-v1-[A-Za-z0-9_-]{20,}/g, "[REDACTED_OPENROUTER_KEY]"],
  [/libsql:\/\/[^\s"'`]+/gi, "[REDACTED_DATABASE_URL]"],
  [/mongodb(?:\+srv)?:\/\/[^\s"'`]+/gi, "[REDACTED_DATABASE_URL]"],
  [/postgres(?:ql)?:\/\/[^\s"'`]+/gi, "[REDACTED_DATABASE_URL]"],
  [/mysql:\/\/[^\s"'`]+/gi, "[REDACTED_DATABASE_URL]"],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g, "[REDACTED_JWT]"],
]

export function redactSentryLog(log: string): string {
  let redacted = log
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, replacement)
  }
  return redacted
}

export function createSentryLogHash(projectId: string, source: SentryIssueSource, rawLog: string, deploymentId?: string) {
  const scope = deploymentId ? `${projectId}:${source}:${deploymentId}` : `${projectId}:${source}:${rawLog}`
  return crypto.createHash("sha256").update(scope).digest("hex")
}

export function isLikelyDeployFailure(log: string): boolean {
  return BUILD_FAILURE_PATTERNS.some((pattern) => pattern.test(log))
}

export function isLikelyNonActionableLog(log: string): boolean {
  return NON_ACTIONABLE_PATTERNS.some((pattern) => pattern.test(log))
}

export function normalizeVmLogInput(logs: unknown): string[] {
  if (!Array.isArray(logs)) return []
  return logs
    .map((line) => (typeof line === "string" ? line : JSON.stringify(line)))
    .filter((line) => line.trim().length > 0)
}

export function extractVmDeploymentIssue(input: {
  projectId: string
  logs: string[]
  deploymentId?: string
  source?: SentryIssueSource
}): ExtractedSentryLog | null {
  const combined = redactSentryLog(input.logs.join("\n").trim())
  if (!combined) return null
  if (!isLikelyDeployFailure(combined) && isLikelyNonActionableLog(combined)) return null
  if (!isLikelyDeployFailure(combined)) return null
  const source = input.source ?? "vm-deploy"
  return {
    source,
    deploymentId: input.deploymentId,
    rawLog: combined,
    logHash: createSentryLogHash(input.projectId, source, combined, input.deploymentId),
  }
}

export function extractAiGenerationIssues(input: {
  projectId: string
  buildErrors?: string[]
  warnings?: string[]
  logs?: Array<{ step?: string; detail?: string }>
  failedError?: string
}): ExtractedSentryLog[] {
  const issues: ExtractedSentryLog[] = []
  const push = (raw: string) => {
    const redacted = redactSentryLog(raw.trim())
    if (!redacted) return
    issues.push({
      source: "ai-generation",
      rawLog: redacted,
      logHash: createSentryLogHash(input.projectId, "ai-generation", redacted),
    })
  }

  if (input.failedError) {
    push(`AI generation failed:\n${input.failedError}`)
  }

  const buildErrors = input.buildErrors?.filter(Boolean) ?? []
  if (buildErrors.length) {
    push(`Builder validation errors:\n${buildErrors.map((error) => `- ${error}`).join("\n")}`)
  }

  const actionableWarnings = (input.warnings ?? []).filter((warning) =>
    /missing env|not connected|validation|failed|error|cannot|module|type/i.test(warning),
  )
  for (const warning of actionableWarnings) {
    push(`AI generation warning:\n${warning}`)
  }

  const validationLogs = (input.logs ?? []).filter((entry) =>
    /validate|repair|failed|error|missing env|not connected/i.test(`${entry.step ?? ""} ${entry.detail ?? ""}`),
  )
  for (const entry of validationLogs) {
    push(`AI builder log [${entry.step ?? "unknown"}]:\n${entry.detail ?? ""}`)
  }

  return issues
}

export function createUnclassifiedSentryIssue(input: {
  projectId: string
  source: SentryIssueSource
  rawLog: string
  logHash: string
  deploymentId?: string
}): SentryIssue {
  const now = new Date()
  return {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    source: input.source,
    deploymentId: input.deploymentId,
    rawLog: redactSentryLog(input.rawLog),
    logHash: input.logHash,
    status: "new",
    createdAt: now,
    updatedAt: now,
  }
}
