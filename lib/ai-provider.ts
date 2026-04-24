// Unified chat-completion helper. Routes to the provider of the currently
// selected model so every AI step in the build pipeline (plan → style JSON →
// logic TS) runs on the same model the user picked from the dropdown.
//
// Supported providers:
//   - "xAI"        → https://api.x.ai/v1/chat/completions                     (XAI_API_KEY)
//   - "OpenRouter" → https://openrouter.ai/api/v1/chat/completions            (OPENROUTER_API_KEY)
//   - "Google"     → https://generativelanguage.googleapis.com/v1beta/...:generateContent
//                    (GOOGLE_AIAGENT_API)  —  Gemini 3.1 Pro Preview via
//                    Google Agent Studio (formerly Vertex AI).
//
// OpenAI-style providers share a schema; Google's Generative Language API
// uses a different request/response shape, handled separately below.

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
}

export interface CallModelResult {
  ok: true
  content: string
  raw: unknown
}

export interface CallModelError {
  ok: false
  status: number
  message: string
  details?: string
}

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
  // Default to OpenRouter for any other provider string.
  return {
    url: "https://openrouter.ai/api/v1/chat/completions",
    apiKey: process.env.OPENROUTER_API_KEY,
  }
}

export async function callModel(
  opts: CallModelOptions,
): Promise<CallModelResult | CallModelError> {
  if (opts.model.provider === "Google") {
    return callGoogle(opts)
  }
  return callOpenAICompatible(opts)
}

async function callOpenAICompatible(
  opts: CallModelOptions,
): Promise<CallModelResult | CallModelError> {
  const { model, messages, temperature = 0.1 } = opts
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
    response = await fetch(cfg.url, {
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
      }),
    })
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message: `Network error calling ${model.provider}`,
      details: err instanceof Error ? err.message : String(err),
    }
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    return {
      ok: false,
      status: response.status,
      message: `${model.provider} API error`,
      details: errText,
    }
  }

  const data = await response.json().catch(() => null) as { choices?: Array<{ message?: { content?: string } }> } | null
  const content = data?.choices?.[0]?.message?.content ?? ""
  return { ok: true, content, raw: data }
}

// Google Generative Language API (gemini-*) speaks a different shape than the
// OpenAI chat-completions schema:
//   - request:  { systemInstruction?: { parts }, contents: [{ role, parts }] }
//   - response: { candidates: [{ content: { parts: [{ text }] } }] }
// We fold the OpenAI "system" message into systemInstruction, and map
// user/assistant turns to "user"/"model" roles Google expects.
interface GooglePart { text: string }
interface GoogleContent { role?: "user" | "model"; parts: GooglePart[] }
interface GoogleResponse {
  candidates?: Array<{
    content?: { parts?: GooglePart[]; role?: string }
    finishReason?: string
  }>
  error?: { message?: string }
}

async function callGoogle(
  opts: CallModelOptions,
): Promise<CallModelResult | CallModelError> {
  const { model, messages, temperature = 0.1 } = opts
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
  // Google rejects requests with zero `contents`. If the caller only sent
  // system messages, relay them as a single user turn so the call still runs.
  if (contents.length === 0 && systemTurns.length > 0) {
    contents.push({
      role: "user",
      parts: [{ text: systemTurns.map((m) => m.content).join("\n\n") }],
    })
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.id)}:generateContent`

  let response: Response
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: { temperature },
      }),
    })
  } catch (err) {
    return {
      ok: false,
      status: 502,
      message: "Network error calling Google",
      details: err instanceof Error ? err.message : String(err),
    }
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "")
    return {
      ok: false,
      status: response.status,
      message: "Google API error",
      details: errText,
    }
  }

  const data = (await response.json().catch(() => null)) as GoogleResponse | null
  const content =
    data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? ""
  if (!content) {
    return {
      ok: false,
      status: 502,
      message: "Google API returned no content",
      details: data?.error?.message ?? JSON.stringify(data ?? {}),
    }
  }
  return { ok: true, content, raw: data }
}

// Extracts the first valid JSON payload from a model response. Handles fenced
// ```json blocks, stray prose, and picks the outermost [ ... ] or { ... }
// region as a fallback. Returns null if nothing parseable is found.
export function extractJson<T = unknown>(content: string): T | null {
  if (!content) return null
  const trimmed = content.trim()

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1]) as T
    } catch {
      // fall through
    }
  }

  const arrayBlock = trimmed.match(/\[\s*[\s\S]*\s*\]/)
  if (arrayBlock) {
    try {
      return JSON.parse(arrayBlock[0]) as T
    } catch {
      // fall through
    }
  }

  const objectBlock = trimmed.match(/\{\s*[\s\S]*\s*\}/)
  if (objectBlock) {
    try {
      return JSON.parse(objectBlock[0]) as T
    } catch {
      // fall through
    }
  }

  try {
    return JSON.parse(trimmed) as T
  } catch {
    return null
  }
}

// Extract a runnable source code body out of a chatty model response.
//
// Real model output we've seen in the wild:
//   1. Clean: just the code.
//   2. Fenced with a language hint: ```typescript\n...\n```
//   3. Fenced then trailing prose: "```ts\n...\n```\n\nLet me know…"
//   4. Prose-then-fence: "Here is the code:\n\n```ts\n...\n```"
//   5. Unclosed / malformed fence: "```typescript\n...\n" (no closing fence).
//   6. No fence, prose prefix: "Here is the code:\n\nexport function …"
//
// The previous implementation failed case 2 when `lang="ts"` because \s* can't
// match `cript` in ```typescript — it silently returned the full messy blob
// (including prose and triple-backtick markers), which is exactly what lands
// in the generated .ts file and kills `vite build`.
//
// This version tries multiple strategies and, crucially, always strips any
// leading/trailing triple-backtick lines before returning.
export function extractCode(content: string, lang?: string): string {
  if (!content) return ""
  const trimmed = content.trim()

  // Strategy A: lang-specific fence. Accept ```ts, ```typescript, ```tsx when
  // lang=ts; accept ```js / ```javascript / ```jsx when lang=js. For other
  // langs just match the lang literally.
  const langAliases =
    lang === "ts" ? ["typescript", "tsx", "ts"]
    : lang === "js" ? ["javascript", "jsx", "js"]
    : lang ? [lang]
    : []
  for (const alias of langAliases) {
    const re = new RegExp(`\`\`\`${alias}\\b[\\t ]*\\n?([\\s\\S]*?)\\n?\`\`\``, "i")
    const m = trimmed.match(re)
    if (m?.[1]) return stripStrayFenceMarkers(m[1]).trim()
  }

  // Strategy B: any fenced block (first occurrence).
  const anyFence = trimmed.match(/```[a-zA-Z0-9]*\b[\t ]*\n?([\s\S]*?)\n?```/)
  if (anyFence?.[1]) return stripStrayFenceMarkers(anyFence[1]).trim()

  // Strategy C: unclosed fence — a ``` that never closes. Take everything
  // after the opening fence line.
  const openFence = trimmed.match(/^```[a-zA-Z0-9]*\b[\t ]*\n([\s\S]*)$/)
  if (openFence?.[1]) return stripStrayFenceMarkers(openFence[1]).trim()

  // Strategy D: no fence but prose prefix before an import/export/const/function.
  // Drop everything up to the first plausible code line.
  const codeStart = trimmed.search(
    /^(?:import\b|export\b|const\b|let\b|var\b|function\b|async\s+function\b|\/\/|\/\*)/m,
  )
  if (codeStart > 0) return stripStrayFenceMarkers(trimmed.slice(codeStart)).trim()

  // Strategy E: give up and scrub stray fence markers out of the raw content.
  return stripStrayFenceMarkers(trimmed).trim()
}

// Strip any lone ``` lines that slipped through — a ``` that is alone on a
// line is always markdown noise, never valid TS/JS syntax.
function stripStrayFenceMarkers(code: string): string {
  return code.replace(/^[\t ]*```[a-zA-Z0-9]*[\t ]*$/gm, "")
}
