// Vercel AI Gateway dynamic client & models bridge.
//
// Fetches live models, specifications, pricing, and capabilities from
// https://ai-gateway.vercel.sh/v1/models to keep model providers,
// names, in/out token costs, and context limits up to date.
//
// Serves Astro, builder chat completions, and the Omni Router with
// OpenAI-compatible SSE streaming using VERCEL_AI (or AI_GATEWAY_API_KEY).

export interface VercelGatewayPricing {
  input?: string
  output?: string
  input_cache_read?: string
  varies_by_provider?: boolean
  fast?: { input?: string; output?: string }
  regional?: Record<string, { input?: string; output?: string }>
}

export interface VercelGatewayModel {
  id: string
  object?: string
  created?: number
  released?: number
  owned_by: string
  name: string
  description?: string
  context_window?: number
  max_tokens?: number
  type?: string
  tags?: string[]
  modalities?: {
    input?: string[]
    output?: string[]
  }
  pricing?: VercelGatewayPricing
}

export interface NormalizedOmniModel {
  id: string
  name: string
  provider: string
  provider_display: string
  providerDisplay?: string
  icon: string
  input_cost: number
  output_cost: number
  inputCostDisplay: string
  outputCostDisplay: string
  swe_score: number
  image_support: boolean
  tools_support: boolean
  cache_support: boolean
  context_window: number
  max_tokens: number
  is_top: boolean
  is_global: boolean
  description: string
  is_active: boolean
  type: string
  tags: string[]
}

const GATEWAY_MODELS_URL = "https://ai-gateway.vercel.sh/v1/models"
const GATEWAY_CHAT_URL = "https://ai-gateway.vercel.sh/v1/chat/completions"

// In-memory cache for models to avoid redundant network roundtrips on every request
let cachedModels: NormalizedOmniModel[] | null = null
let cacheTimestamp = 0
const CACHE_TTL_MS = 10 * 60 * 1000 // 10 minutes

export function getVercelAiKey(): string {
  return (
    process.env.VERCEL_AI ||
    process.env.VERCEL_AI_KEY ||
    process.env.VERCEL_AI_GATEWAY_KEY ||
    process.env.AI_GATEWAY_API_KEY ||
    ""
  ).trim()
}

export function isVercelAiConfigured(): boolean {
  return !!getVercelAiKey()
}

function formatCost(costPerTokenStr?: string): { num: number; display: string } {
  if (!costPerTokenStr) return { num: 0, display: "0$" }
  const costPerToken = parseFloat(costPerTokenStr)
  if (isNaN(costPerToken) || costPerToken <= 0) return { num: 0, display: "0$" }
  // Price per 1M tokens in USD
  const costPerMillion = costPerToken * 1_000_000
  const formatted = costPerMillion < 0.01 
    ? `$${costPerMillion.toFixed(4)}` 
    : `$${costPerMillion.toFixed(2)}`
  return { num: costPerMillion, display: formatted }
}

function computeSweScore(modelId: string, ownedBy: string): number {
  const m = modelId.toLowerCase()
  if (m.includes("claude-3-7-sonnet") || m.includes("claude-3.7-sonnet")) return 70.3
  if (m.includes("claude-3-5-sonnet") || m.includes("claude-3.5-sonnet")) return 64.0
  if (m.includes("gpt-4.5") || m.includes("gpt-4o")) return 61.5
  if (m.includes("gemini-2.5-pro") || m.includes("gemini-2.0-pro")) return 62.4
  if (m.includes("gemini-2.5-flash") || m.includes("gemini-2.0-flash")) return 58.6
  if (m.includes("deepseek-r1") || m.includes("deepseek/deepseek-r1")) return 63.8
  if (m.includes("deepseek-v3") || m.includes("deepseek-chat")) return 59.2
  if (m.includes("glm-5.3") || m.includes("glm-5.2")) return 57.5
  if (m.includes("llama-3.3-70b")) return 55.8
  if (m.includes("qwen-3") || m.includes("qwen-2.5")) return 56.4
  if (ownedBy === "anthropic") return 58.0
  if (ownedBy === "openai") return 56.0
  if (ownedBy === "google") return 55.0
  return 50.0
}

export function normalizeVercelGatewayModel(raw: VercelGatewayModel): NormalizedOmniModel {
  const inputPrice = formatCost(raw.pricing?.input)
  const outputPrice = formatCost(raw.pricing?.output)
  const provider = raw.owned_by || raw.id.split("/")[0] || "ai"
  const providerDisplay = provider.charAt(0).toUpperCase() + provider.slice(1)
  const tags = raw.tags || []
  const inputModalities = raw.modalities?.input || ["text"]

  return {
    id: raw.id,
    name: raw.name || raw.id,
    provider: provider,
    provider_display: providerDisplay,
    providerDisplay: providerDisplay,
    icon: provider,
    input_cost: inputPrice.num,
    output_cost: outputPrice.num,
    inputCostDisplay: inputPrice.display,
    outputCostDisplay: outputPrice.display,
    swe_score: computeSweScore(raw.id, provider),
    image_support: inputModalities.includes("image") || tags.includes("vision"),
    tools_support: tags.includes("tool-use") || tags.includes("tools"),
    cache_support: tags.includes("implicit-caching"),
    context_window: raw.context_window || 128000,
    max_tokens: raw.max_tokens || 16384,
    is_top: ["anthropic", "openai", "google", "deepseek", "meta", "zai"].includes(provider),
    is_global: true,
    description: raw.description || `${raw.name || raw.id} hosted via Vercel AI Gateway`,
    is_active: true,
    type: raw.type || "language",
    tags: tags,
  }
}

/**
 * Fetch and return all models from Vercel AI Gateway, categorized with live in/out pricing and specs.
 */
export async function fetchVercelGatewayModels(forceRefresh = false): Promise<NormalizedOmniModel[]> {
  const now = Date.now()
  if (!forceRefresh && cachedModels && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedModels
  }

  try {
    const res = await fetch(GATEWAY_MODELS_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 600 },
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch models: HTTP ${res.status}`)
    }

    const json = await res.json()
    const rawList: VercelGatewayModel[] = Array.isArray(json?.data)
      ? json.data
      : Array.isArray(json)
      ? json
      : []

    const normalized = rawList.map(normalizeVercelGatewayModel)
    cachedModels = normalized
    cacheTimestamp = now
    return normalized
  } catch (err) {
    console.error("[vercel-ai-gateway] Error fetching models:", err)
    if (cachedModels) return cachedModels
    return []
  }
}

export interface StreamVercelAiOptions {
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool"
    content?: string | null | any
    tool_calls?: any[]
    tool_call_id?: string
    name?: string
  }>
  model?: string
  temperature?: number
  max_tokens?: number
  tools?: any[]
  signal?: AbortSignal
}

/**
 * Streams chat completions through the Vercel AI Gateway using the VERCEL_AI environment variable.
 */
export async function streamVercelAiGateway(options: StreamVercelAiOptions): Promise<Response> {
  const apiKey = getVercelAiKey()
  const model = options.model || "anthropic/claude-3.5-sonnet"
  const encoder = new TextEncoder()

  const requestBody = {
    model,
    messages: options.messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.max_tokens ?? 16384,
    stream: true,
    ...(options.tools && Array.isArray(options.tools) && options.tools.length > 0
      ? { tools: options.tools, tool_choice: "auto" }
      : {}),
  }

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const enqueue = (chunk: Uint8Array) => {
        if (!closed) controller.enqueue(chunk)
      }
      const sendEvent = (data: string) => enqueue(encoder.encode(`data: ${data}\n\n`))
      const done = () => {
        if (closed) return
        sendEvent("[DONE]")
        closed = true
        controller.close()
      }

      try {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          "Accept-Encoding": "identity",
        }
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`
        }

        const res = await fetch(GATEWAY_CHAT_URL, {
          method: "POST",
          headers,
          body: JSON.stringify(requestBody),
          cache: "no-store",
          signal: options.signal
            ? AbortSignal.any([options.signal, AbortSignal.timeout(180_000)])
            : AbortSignal.timeout(180_000),
        })

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`)
          sendEvent(
            JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: { content: `\n\n[Vercel AI Gateway error] ${res.status}: ${errText}` },
                  finish_reason: "stop",
                },
              ],
            }),
          )
          done()
          return
        }

        if (!res.body) {
          throw new Error("No response body from Vercel AI Gateway")
        }

        // Byte-for-byte stream forwarding preserves SSE framing and reduces TTFB
        const reader = res.body.getReader()
        try {
          while (!options.signal?.aborted) {
            const { done: streamDone, value } = await reader.read()
            if (streamDone) break
            if (value && value.byteLength > 0) {
              enqueue(value)
            }
          }
        } finally {
          if (options.signal?.aborted) {
            await reader.cancel().catch(() => undefined)
          }
          reader.releaseLock()
        }
        done()
      } catch (err: any) {
        if (options.signal?.aborted) {
          if (!closed) {
            closed = true
            controller.close()
          }
          return
        }
        if (!closed) {
          sendEvent(
            JSON.stringify({
              id: `chatcmpl-${Date.now()}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model,
              choices: [
                {
                  index: 0,
                  delta: { content: `\n\n[Gateway error] ${err?.message || "Stream terminated unexpectedly"}` },
                  finish_reason: "stop",
                },
              ],
            }),
          )
          done()
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    },
  })
}
