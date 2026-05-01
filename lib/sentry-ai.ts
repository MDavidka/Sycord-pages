import { callModel, extractJson, type ModelSelection } from "@/lib/ai-provider"
import { redactSecrets } from "@/lib/sentry-log-parser"

export type SentryAIDecision = {
  decision: "skip" | "mark"
  errorName: string
  description: string
  fixSuggestion: string
  affectedFile?: string
  confidence: number
}

const SENTRY_MODEL: ModelSelection = {
  id: "poolside/laguna-m.1:free",
  provider: "OpenRouter",
  name: "Laguna M1",
}

export async function classifySentryLog(rawLog: string): Promise<SentryAIDecision> {
  const safeLog = redactSecrets(rawLog).slice(0, 12000)
  const res = await callModel({
    model: SENTRY_MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: "You classify build/runtime logs. Return JSON only." },
      { role: "user", content: `Return JSON with keys decision,errorName,description,fixSuggestion,affectedFile,confidence. Rules: skip non-code issues (DNS/tunnel/npm warnings/success logs). mark real code/build/runtime issues. Log:\n${safeLog}` },
    ],
  })

  if (!res.ok) {
    return { decision: "skip", errorName: "Classifier unavailable", description: res.message, fixSuggestion: "Retry re-scan later.", confidence: 0 }
  }

  const parsed = extractJson<SentryAIDecision>(res.content)
  if (!parsed || (parsed.decision !== "skip" && parsed.decision !== "mark")) {
    return { decision: "skip", errorName: "Unparseable classifier response", description: "Could not parse model JSON", fixSuggestion: "Retry re-scan later.", confidence: 0 }
  }
  return parsed
}
