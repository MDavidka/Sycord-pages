// Unified chat-completion helper with timeout, retry, and abort support.
// Added for the Syra pipeline refactoring.

export type ChatRole = "system" | "user" | "assistant"

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ModelSelection {
  id: string
  provider: string
  name?: string
}

export interface CallModelOptions {
  model: ModelSelection
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  timeoutMs?: number
  signal?: AbortSignal
  maxRetries?: number
}

export interface CallModelResult {
  ok: true
  content: string
  raw: unknown
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
}

export interface CallModelError {
  ok: false
  status: number
  message: string
  details?: string
}

const DEFAULT_TIMEOUT = 120_000 // 2 minutes
const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])
const MAX_RETRIES = 2

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function jitter(baseMs: number): number {
  return Math.floor(baseMs * (0.5 + Math.random()))
}

function delayForRetry(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 30000)
  return jitter(base)
}

// Separated because it's used independently from retry logic
async function callModelOnce(
  opts: CallModelOptions,
): Promise<CallModelResult | CallModelError> {
  const { model, messages, temperature = 0.1, timeoutMs = DEFAULT_TIMEOUT, signal } = opts

  if (model.provider === "Google") {
    return callGoogle({ model, messages, temperature, timeoutMs, signal })
  }
  if (model.provider === "Anthropic") {
    return callAnthropic({ model, messages, temperature, timeoutMs, signal })
  }
  return callOpenAICompatible({ model, messages, temperature, timeoutMs, signal })
}

export async function callModel(
  opts: CallModelOptions,
): Promise<CallModelResult | CallModelError> {
  const maxRetries = opts.maxRetries ?? MAX_RETRIES

  let lastError: CallModelError | null = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      await sleep(delayForRetry(attempt - 1))
    }

    const result = await callModelOnce(opts)

    if (result.ok) return result

    lastError = result
    if (!RETRYABLE_STATUSES.has(result.status)) break
  }

  return lastError ?? { ok: false, status: 500, message: "Max retries exceeded" }
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  if (signal) {
    signal.addEventListener("abort", () => controller.abort())
  }

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}

// ═══════ OpenAI Compatible providers ═══════
interface ProviderConfig {
  url: string
  apiKey: string | undefined
  headers?: Record<string, string>
}

function providerConfig(provider: string): ProviderConfig {
  if (provider === "xAI") {
    return {
      url: "https://api.x.ai/v1/chat/completions",
      apiKey: process.env.XAI_API_KEY,
    }
  }
  if (provider === "DeepSeek") {
    return {
      url: "https://api.deepseek.com/v1/chat/completions",
      apiKey: process.env.DEEPSEEK_API,
    }
  }
  if (provider === "OpenAI") {
    return {
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY,
    }
  }
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: process.env.OPENROUTER_API_KEY,
  }
}

async function callOpenAICompatible(
  opts: Omit<CallModelOptions, "maxRetries"> & { timeoutMs: number; signal?: AbortSignal },
): Promise<CallModelResult | CallModelError> {
  const { model, messages, temperature = 0.1, timeoutMs, signal } = opts
  const cfg = providerConfig(model.provider)

  if (!cfg.apiKey) {
    return {
      ok: false,
      status: 500,
      message: `${model.provider} API key is not configured`,
    }
  }

  let response: Response
  try {
    response = await fetchWithTimeout(
      cfg.url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.apiKey}`,
          ...(cfg.headers ?? {}),
        },
        body: JSON.stringify({
          model: model.id,
          messages,
          temperature,
          max_tokens: opts.maxTokens ?? 8192,
        }),
      },
      timeoutMs,
      signal,
    )
  } catch (err) {
    const isAbort = (err as Error)?.name === "AbortError"
    return {
      ok: false,
      status: isAbort ? 408 : 502,
      message: isAbort ? `Request timed out for ${model.provider}` : `Network error calling ${model.provider}`,
      details: err instanceof Error ? err.message : String(err),
    }
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    return {
      ok: false,
      status: response.status,
      message: `${model.provider} API error (${response.status})`,
      details: errText.slice(0, 500),
    }
  }

  const data = await response.json().catch(() => null) as {
    choices?: Array<{ message?: { content?: string } }>
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
  } | null
  const content = data?.choices?.[0]?.message?.content ?? ""
  return {
    ok: true,
    content,
    raw: data,
    usage: data?.usage ? {
      promptTokens: data.usage.prompt_tokens,
      completionTokens: data.usage.completion_tokens,
      totalTokens: data.usage.total_tokens,
    } : undefined,
  }
}

// ═══════ Google / Vertex AI ═══════
interface GooglePart { text: string }
interface GoogleContent { role?: "user" | "model"; parts: GooglePart[] }
interface GoogleResponse {
  candidates?: Array<{
    content?: { parts?: GooglePart[]; role?: string }
    finishReason?: string
  }>
  error?: { message?: string }
}

function googleModelCandidates(modelId: string): string[] {
  const normalized = modelId.trim()
  const aliases: Record<string, string[]> = {
    "gemini-3.1-flash-preview": ["gemini-3.1-flash-preview", "gemini-2.5-flash", "gemini-2.0-flash-001"],
    "gemini-3.1-pro-preview": ["gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-1.5-pro-002"],
  }
  return aliases[normalized] ?? [normalized]
}

async function callGoogle(
  opts: Omit<CallModelOptions, "maxRetries"> & { timeoutMs: number; signal?: AbortSignal },
): Promise<CallModelResult | CallModelError> {
  const { model, messages, temperature = 0.1, timeoutMs, signal } = opts
  const apiKey = process.env.GOOGLE_AIAGENT_API
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message: "Google Agent Studio API key is not configured (GOOGLE_AIAGENT_API).",
    }
  }

  const systemTurns = messages.filter((m) => m.role === "system")
  const nonSystem = messages.filter((m) => m.role !== "system")
  const systemInstruction: GoogleContent | undefined = systemTurns.length
    ? { parts: systemTurns.map((m) => ({ text: m.content })) }
    : undefined
  const contents: GoogleContent[] = nonSystem.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }))

  if (contents.length === 0 && systemTurns.length > 0) {
    contents.push({
      role: "user",
      parts: [{ text: systemTurns.map((m) => m.content).join("\n\n") }],
    })
  }

  const candidates = googleModelCandidates(model.id)
  const errors: string[] = []

  for (const candidate of candidates) {
    const url =
      `https://aiplatform.googleapis.com/v1beta1/publishers/google/models/${encodeURIComponent(candidate)}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`

    let response: Response
    try {
      response = await fetchWithTimeout(
        url,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction,
            contents,
            generationConfig: { temperature },
          }),
        },
        timeoutMs,
        signal,
      )
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return { ok: false, status: 408, message: "Request timed out calling Vertex AI" }
      }
      return {
        ok: false,
        status: 502,
        message: "Network error calling Vertex AI",
        details: err instanceof Error ? err.message : String(err),
      }
    }

    if (!response.ok) {
      const errText = await response.text().catch(() => "")
      errors.push(`${candidate}: ${response.status} ${errText.slice(0, 200)}`)
      continue
    }

    const data = (await response.json().catch(() => null)) as GoogleResponse | null
    const content =
      data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
    if (!content) {
      errors.push(`${candidate}: empty content (${data?.error?.message ?? "no candidate text"})`)
      continue
    }
    return { ok: true, content, raw: data }
  }

  return {
    ok: false,
    status: 502,
    message: "Vertex AI API error",
    details: errors.join("\n"),
  }
}

// ═══════ Anthropic ═══════
async function callAnthropic(
  opts: Omit<CallModelOptions, "maxRetries"> & { timeoutMs: number; signal?: AbortSignal },
): Promise<CallModelResult | CallModelError> {
  const { model, messages, temperature = 0.1, timeoutMs, signal } = opts
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message: "Anthropic API key is not configured (ANTHROPIC_API_KEY).",
    }
  }

  const systemMessages = messages.filter((m) => m.role === "system").map((m) => m.content)
  const nonSystem = messages.filter((m) => m.role !== "system")

  const body: Record<string, unknown> = {
    model: model.id,
    max_tokens: opts.maxTokens ?? 32768,
    temperature,
    messages: nonSystem.map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: [{ type: "text", text: m.content }],
    })),
  }

  if (systemMessages.length > 0) {
    body.system = systemMessages.join("\n\n")
  }

  let response: Response
  try {
    response = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      },
      timeoutMs,
      signal,
    )
  } catch (err) {
    const isAbort = (err as Error)?.name === "AbortError"
    return {
      ok: false,
      status: isAbort ? 408 : 502,
      message: isAbort ? "Request timed out calling Anthropic" : "Network error calling Anthropic",
      details: err instanceof Error ? err.message : String(err),
    }
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    return {
      ok: false,
      status: response.status,
      message: "Anthropic API error",
      details: errText.slice(0, 500),
    }
  }

  const data = (await response.json().catch(() => null)) as {
    content?: Array<{ type: string; text?: string }>
    error?: { message?: string }
  } | null

  const content = data?.content?.map((c) => c.text ?? "").join("") ?? ""
  return { ok: true, content, raw: data }
}

// ═══════ JSON / Code extraction utilities ═══════

export function extractJson<T = unknown>(content: string): T | null {
  if (!content) return null
  const trimmed = content.trim()

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    try { return cleanJsonPlaceholders(JSON.parse(fenced[1])) as T } catch {}
  }

  const firstArray = trimmed.indexOf("[")
  const firstObject = trimmed.indexOf("{")
  const startChar = firstArray >= 0 && (firstArray < firstObject || firstObject < 0) ? "[" : "{"
  const closeChar = startChar === "[" ? "]" : "}"
  const startIdx = trimmed.indexOf(startChar)
  if (startIdx >= 0) {
    let depth = 0
    let endIdx = -1
    let inString = false
    let escaped = false
    for (let i = startIdx; i < trimmed.length; i++) {
      const ch = trimmed[i]
      if (escaped) { escaped = false; continue }
      if (ch === "\\" && inString) { escaped = true; continue }
      if (ch === '"') { inString = !inString; continue }
      if (inString) continue
      if (ch === startChar) depth++
      else if (ch === closeChar) { depth--; if (depth === 0) { endIdx = i; break } }
    }
    if (endIdx > startIdx) {
      try { return cleanJsonPlaceholders(JSON.parse(trimmed.slice(startIdx, endIdx + 1))) as T } catch {}
    }
  }

  try { return cleanJsonPlaceholders(JSON.parse(trimmed)) as T } catch {}
  return null
}

function cleanJsonPlaceholders<T>(value: T): T {
  if (typeof value === "string") {
    return (value.replace(/^\[[a-zA-Z]+\]$/, "").trim() || value.replace(/^\[[a-zA-Z]+\]$/, "")) as unknown as T
  }
  if (Array.isArray(value)) {
    return value.map(cleanJsonPlaceholders) as unknown as T
  }
  if (value !== null && typeof value === "object") {
    const cleaned: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (typeof val === "string" && /^\[[a-zA-Z]+\]$/.test(val)) {
        cleaned[key] = ""
      } else {
        cleaned[key] = cleanJsonPlaceholders(val)
      }
    }
    return cleaned as unknown as T
  }
  return value
}

export function extractCode(content: string, lang?: string): string {
  if (!content) return ""

  const trimmed = content.trim()

  if (/^(?:"use (client|server|strict)"|import\b|export\b|const\b|let\b|var\b|function\b|interface\b|type\b|class\b|@tailwind|@layer|\/\/|\/\*|{|package\s*\{)/m.test(trimmed) &&
    !trimmed.match(/^```/) &&
    !trimmed.startsWith("Here") &&
    !trimmed.startsWith("This")) {
    return stripStrayFenceMarkers(trimmed).trim()
  }

  if (trimmed.startsWith("{") && trimmed.includes('"code"')) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      if (typeof parsed.code === "string" && parsed.code.length > 10) {
        return extractCode(parsed.code, lang)
      }
    } catch {}
  }

  const langAliases = lang === "ts" ? ["typescript", "tsx", "ts"]
    : lang === "js" ? ["javascript", "jsx", "js"]
    : lang ? [lang]
    : []

  for (const alias of langAliases) {
    const re = new RegExp(`\`\`\`${alias}\\b[\\t ]*\\n?([\\s\\S]*?)\\n?\`\`\``, "i")
    const m = trimmed.match(re)
    if (m?.[1]) return stripStrayFenceMarkers(m[1]).trim()
  }

  const anyFence = trimmed.match(/```[a-zA-Z0-9]*\b[\t ]*\n?([\s\S]*?)\n?```/)
  if (anyFence?.[1]) return stripStrayFenceMarkers(anyFence[1]).trim()

  const openFence = trimmed.match(/^```[a-zA-Z0-9]*\b[\t ]*\n([\s\S]*)$/)
  if (openFence?.[1]) return stripStrayFenceMarkers(openFence[1]).trim()

  return stripStrayFenceMarkers(trimmed).trim()
}

function stripStrayFenceMarkers(code: string): string {
  return code.replace(/^[\t ]*```[a-zA-Z0-9]*[\t ]*$/gm, "")
}

// Export DOMException type for Node.js compatibility
