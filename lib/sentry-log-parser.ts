import crypto from "crypto"

export type SentrySource = "vm-build" | "vm-deploy" | "ai-generation" | "website-runtime"

export interface SentryIssueInput {
  projectId: string
  source: SentrySource
  deploymentId?: string
  rawLog: string
  logHash: string
}

const ERROR_PATTERNS = [
  /Failed to compile/i,
  /Type error/i,
  /Module not found/i,
  /Cannot find module/i,
  /npm run build exited/i,
  /Build failed/i,
  /ReferenceError/i,
  /SyntaxError/i,
  /Error:/i,
]

export function hashLog(source: SentrySource, rawLog: string, deploymentId?: string) {
  return crypto.createHash("sha256").update(`${source}:${deploymentId ?? "none"}:${rawLog}`).digest("hex")
}

export function isLikelyFailureLog(rawLog: string) {
  return ERROR_PATTERNS.some((p) => p.test(rawLog))
}

export function redactSecrets(input: string) {
  return input
    .replace(/(OPENROUTER_API_KEY|TURSO_AUTH_TOKEN|GITHUB_TOKEN|GITHUB_API_TOKEN|GH_TOKEN)\s*[=:]\s*[^\s\n]+/gi, "$1=[REDACTED]")
    .replace(/(token|api[_-]?key|secret|password)\s*[=:]\s*[^\s\n]+/gi, "$1=[REDACTED]")
    .replace(/(mongodb(?:\+srv)?:\/\/)[^\s\n]+/gi, "$1[REDACTED]")
}
