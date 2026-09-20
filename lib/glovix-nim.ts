// NVIDIA NIM bridge for the Glovix / Astro builder.
//
// Glovix speaks the OpenAI chat-completions protocol (streaming SSE with
// `tools` / `tool_calls`). NVIDIA NIM exposes an OpenAI-compatible API
// at https://integrate.api.nvidia.com/v1.
//
// Key features:
//   - Smart retry with exponential backoff + jitter for 429 rate limits
//   - Parses upstream `Retry-After` headers
//   - Gracefully relays stream chunks byte-for-byte or with error framing
//
// Configuration:
//   NVIDIA_NIM_API_KEY (or NIM_API_KEY)     API key (required)
//   NVIDIA_NIM_BASE_URL                     Default: https://integrate.api.nvidia.com/v1
//   NVIDIA_NIM_MODEL                        Default: meta/llama-3.3-70b-instruct

export const NIM_DEFAULT_MODEL = process.env.NVIDIA_NIM_MODEL || "meta/llama-3.3-70b-instruct"
export const NIM_BASE_URL = process.env.NVIDIA_NIM_BASE_URL || "https://integrate.api.nvidia.com/v1"

export function getNimApiKey(): string {
  return (
    process.env.NVIDIA_NIM_API_KEY ||
    process.env.NIM_API_KEY ||
    process.env.NVIDIA_API_KEY ||
    ""
  ).trim()
}

export function isNimConfigured(): boolean {
  return !!getNimApiKey()
}

/**
 * Normalizes user-specified NIM model ids.
 * Examples:
 *   - "nim/meta/llama-3.3-70b-instruct" -> "meta/llama-3.3-70b-instruct"
 *   - "nvidia/nemotron-4-340b-instruct" -> "nvidia/nemotron-4-340b-instruct"
 *   - "meta/llama-3.3-70b-instruct"     -> "meta/llama-3.3-70b-instruct"
 */
export function resolveNimModel(model?: string): string {
  if (!model) return NIM_DEFAULT_MODEL
  let id = model.trim()
  if (id.startsWith("nim/")) {
    id = id.slice(4)
  } else if (id.startsWith("nim:")) {
    id = id.slice(4)
  } else if (id.startsWith("nvidia:")) {
    id = `nvidia/${id.slice(7)}`
  }
  if (id === "nemotron-3-super" || id === "nvidia/nemotron-3-super") {
    id = "nvidia/nemotron-4-340b-instruct"
  }
  return id || NIM_DEFAULT_MODEL
}

export function isNimModelId(model?: string): boolean {
  if (!model) return false
  const lower = model.toLowerCase().trim()
  return (
    lower.startsWith("nim/") ||
    lower.startsWith("nim:") ||
    lower.startsWith("nvidia/") ||
    lower.startsWith("nvidia:") ||
    lower.includes("nemotron") ||
    lower.startsWith("meta/llama-3") ||
    lower.startsWith("mistralai/mistral-large") ||
    lower.startsWith("deepseek-ai/deepseek-r1") ||
    lower.startsWith("deepseek-ai/deepseek-v3")
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export function isRetryableNimError(status: number, message: string): boolean {
  if (status === 429 || status === 503 || status === 500 || status === 502 || status === 504) {
    return true
  }
  const msg = message.toLowerCase()
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("resource_exhausted") ||
    msg.includes("quota") ||
    msg.includes("overloaded") ||
    msg.includes("temporarily unavailable") ||
    msg.includes("timeout")
  )
}

/**
 * Smart fetch with exponential backoff + jitter and Retry-After header parsing
 * specifically tuned to prevent stops from NVIDIA NIM rate limits.
 */
async function fetchWithSmartRetry(
  url: string,
  options: RequestInit,
  attempts = 5,
): Promise<Response> {
  let lastError: any
  let lastResponse: Response | null = null

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const res = await fetch(url, options)

      if (res.ok) {
        return res
      }

      lastResponse = res

      // Parse error body if possible to check message
      const errText = await res.clone().text().catch(() => "")
      const retryable = isRetryableNimError(res.status, errText)

      if (!retryable || attempt === attempts - 1) {
        return res
      }

      // Check Retry-After header (either seconds or HTTP date)
      let waitMs = 0
      const retryAfterHeader = res.headers.get("retry-after")
      if (retryAfterHeader) {
        const parsedSec = parseInt(retryAfterHeader, 10)
        if (!isNaN(parsedSec) && parsedSec > 0) {
          waitMs = parsedSec * 1000
        } else {
          const parsedDate = Date.parse(retryAfterHeader)
          if (!isNaN(parsedDate) && parsedDate > Date.now()) {
            waitMs = parsedDate - Date.now()
          }
        }
      }

      // If no explicit Retry-After, calculate exponential backoff with jitter
      if (waitMs <= 0) {
        const baseMs = Math.min(1000 * 2 ** attempt, 16000)
        const jitter = Math.floor(Math.random() * 500)
        waitMs = baseMs + jitter
      }

      console.warn(
        `[NVIDIA NIM] Rate limit / transient error (${res.status}). Retrying attempt ${attempt + 1}/${attempts} in ${waitMs}ms...`
      )
      await sleep(waitMs)
    } catch (err: any) {
      lastError = err
      const isAbort = err?.name === "AbortError" || options.signal?.aborted
      if (isAbort || attempt === attempts - 1) {
        throw err
      }

      const backoff = Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 400)
      console.warn(
        `[NVIDIA NIM] Network failure (${err?.message || err}). Retrying attempt ${attempt + 1}/${attempts} in ${backoff}ms...`
      )
      await sleep(backoff)
    }
  }

  if (lastResponse) return lastResponse
  throw lastError || new Error("NVIDIA NIM request failed after retries")
}

interface OpenAIContent {
  type: "text"
  text: string
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool"
  content?: string | null | OpenAIContent[]
  tool_calls?: Array<{
    id?: string
    type?: string
    function?: { name?: string; arguments?: string }
  }>
  tool_call_id?: string
  name?: string
}

export interface GenerateNimRequest {
  messages: OpenAIMessage[]
  tools?: any
  temperature?: number
  maxOutputTokens?: number
  model?: string
  apiKeyOverride?: string
  /** Cancels the upstream request when the browser disconnects. */
  signal?: AbortSignal
}

export function streamNimCompatible(req: GenerateNimRequest): Response {
  const encoder = new TextEncoder()
  const modelLabel = resolveNimModel(req.model)
  const apiKey = (req.apiKeyOverride || getNimApiKey()).trim()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const id = `chatcmpl-nim-${Date.now()}`
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
        if (!apiKey) {
          sendEvent(
            JSON.stringify({
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: modelLabel,
              choices: [
                {
                  index: 0,
                  delta: {
                    content:
                      "\n\n[NVIDIA NIM Error] API key missing. Please provide your NVIDIA NIM API key via NVIDIA_NIM_API_KEY or Omni Router settings.",
                  },
                  finish_reason: "stop",
                },
              ],
            })
          )
          done()
          return
        }

        const requestBody: Record<string, any> = {
          model: modelLabel,
          messages: req.messages,
          temperature: req.temperature ?? 0.6,
          max_tokens: req.maxOutputTokens ?? 8192,
          stream: true,
        }

        if (req.tools && Array.isArray(req.tools) && req.tools.length > 0) {
          requestBody.tools = req.tools
          requestBody.tool_choice = "auto"
        }

        const res = await fetchWithSmartRetry(
          `${NIM_BASE_URL}/chat/completions`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              Accept: "text/event-stream",
            },
            body: JSON.stringify(requestBody),
            signal: req.signal
              ? AbortSignal.any([req.signal, AbortSignal.timeout(180_000)])
              : AbortSignal.timeout(180_000),
          },
          5 // Up to 5 smart retries
        )

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`)
          let errMsg = errText
          try {
            const parsed = JSON.parse(errText)
            errMsg = parsed.error?.message || parsed.message || errText
          } catch {
            // keep raw text
          }

          sendEvent(
            JSON.stringify({
              id,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: modelLabel,
              choices: [
                {
                  index: 0,
                  delta: {
                    content: `\n\n[NVIDIA NIM Error] ${res.status}: ${errMsg}`,
                  },
                  finish_reason: "stop",
                },
              ],
            })
          )
          done()
          return
        }

        if (!res.body) {
          throw new Error("No response body received from NVIDIA NIM")
        }

        // Byte-for-byte forwarding preserves SSE framing and tool_calls
        const reader = res.body.getReader()
        try {
          while (!req.signal?.aborted) {
            const { done: streamDone, value } = await reader.read()
            if (streamDone) break
            if (value?.byteLength) enqueue(value)
          }
        } finally {
          if (req.signal?.aborted) await reader.cancel().catch(() => undefined)
          reader.releaseLock()
        }

        if (!closed) {
          closed = true
          controller.close()
        }
      } catch (err: any) {
        if (req.signal?.aborted) {
          if (!closed) controller.close()
          return
        }
        const message = err?.message || "NVIDIA NIM generation failed"
        sendEvent(
          JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: modelLabel,
            choices: [
              {
                index: 0,
                delta: { content: `\n\n[AI Error] ${message}` },
                finish_reason: "stop",
              },
            ],
          })
        )
        done()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Content-Encoding": "identity",
    },
  })
}
