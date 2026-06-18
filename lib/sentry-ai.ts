import { callModel, extractJson } from "@/lib/ai-provider"
import type { SentryIssue, SentryIssueStatus } from "@/lib/sentry-log-parser"
import { redactSentryLog } from "@/lib/sentry-log-parser"

export interface SentryAIDecision {
  decision: "skip" | "mark"
  errorName: string
  description: string
  fixSuggestion: string
  affectedFile?: string
  confidence: number
}

const SENTRY_MODEL = { id: "poolside/laguna-m.1:free", provider: "OpenRouter", name: "Laguna M.1" }

function coerceDecision(value: unknown, fallbackName: string): SentryAIDecision {
  const obj = value && typeof value === "object" ? value as Record<string, unknown> : {}
  const decision = obj.decision === "mark" ? "mark" : "skip"
  const errorName = typeof obj.errorName === "string" && obj.errorName.trim()
    ? obj.errorName.trim()
    : fallbackName
  const description = typeof obj.description === "string" && obj.description.trim()
    ? obj.description.trim()
    : decision === "mark"
      ? "A code, build, or runtime issue was detected in this log."
      : "This log does not look like an actionable code issue."
  const fixSuggestion = typeof obj.fixSuggestion === "string" && obj.fixSuggestion.trim()
    ? obj.fixSuggestion.trim()
    : decision === "mark"
      ? "Inspect the affected code path and fix the failing build or runtime error shown in the log."
      : "No code fix is needed."
  const confidenceRaw = typeof obj.confidence === "number" ? obj.confidence : Number(obj.confidence)
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0.5
  const affectedFile = typeof obj.affectedFile === "string" && obj.affectedFile.trim()
    ? obj.affectedFile.trim()
    : undefined

  return { decision, errorName, description, fixSuggestion, affectedFile, confidence }
}

function heuristicDecision(log: string): SentryAIDecision {
  if (/npm warn(?:ing)?|dns|tunnel|take a peek over at|deployment complete|compiled successfully/i.test(log)) {
    return {
      decision: "skip",
      errorName: "Non-actionable log",
      description: "This looks like normal infrastructure output, a warning, or successful deployment output.",
      fixSuggestion: "No code change is required.",
      confidence: 0.65,
    }
  }

  const fileMatch = log.match(/(?:\.\/|\/)?([A-Za-z0-9_\-./]+\.(?:ts|tsx|js|jsx|json|css|html|md))(?::\d+:\d+|:\d+)?/)
  const nameMatch = log.match(/(Type error|Module not found|Cannot find module|Failed to compile|Build failed|ReferenceError|SyntaxError|Error:\s*[^\n]+)/i)

  return {
    decision: "mark",
    errorName: nameMatch?.[1]?.replace(/\s+/g, " ").trim() || "Build or runtime error",
    description: "The log contains a build, code, or runtime failure that should be fixed.",
    fixSuggestion: "Use the error message and stack trace to fix the referenced module, type, syntax, or runtime issue.",
    affectedFile: fileMatch?.[1],
    confidence: 0.55,
  }
}

export function statusFromDecision(decision: SentryAIDecision["decision"]): SentryIssueStatus {
  return decision === "mark" ? "marked" : "skipped"
}

export async function classifySentryIssue(issue: SentryIssue): Promise<SentryAIDecision> {
  const rawLog = redactSentryLog(issue.rawLog).slice(0, 12000)
  const result = await callModel({
    model: SENTRY_MODEL,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: `You classify Sycord Sentry logs. Return JSON only.
type SentryAIDecision = {
  decision: "skip" | "mark"
  errorName: string
  description: string
  fixSuggestion: string
  affectedFile?: string
  confidence: number
}

[skip] = non-code issue, normal logs, DNS messages, tunnel logs, npm warnings, successful build output, irrelevant logs.
[mark] = real code/build/runtime issue that needs fixing.
For [mark], provide a clear error name, useful description, fix steps, and affected file if visible.
Never include secrets or token values in the response.`,
      },
      {
        role: "user",
        content: `Source: ${issue.source}
Deployment ID: ${issue.deploymentId ?? "none"}

Log:
${rawLog}`,
      },
    ],
  })

  if (!result.ok) return heuristicDecision(rawLog)
  return coerceDecision(extractJson<SentryAIDecision>(result.content), heuristicDecision(rawLog).errorName)
}

export async function classifySentryIssuesSequentially(issues: SentryIssue[]): Promise<SentryIssue[]> {
  const classified: SentryIssue[] = []
  for (const issue of issues) {
    if (issue.aiDecision) {
      classified.push(issue)
      continue
    }
    const decision = await classifySentryIssue(issue)
    classified.push({
      ...issue,
      status: statusFromDecision(decision.decision),
      aiDecision: decision.decision,
      errorName: decision.errorName,
      description: decision.description,
      fixSuggestion: decision.fixSuggestion,
      affectedFile: decision.affectedFile,
      updatedAt: new Date(),
    })
  }
  return classified
}
