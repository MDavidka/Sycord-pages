// DeepSeek bridge for the Glovix builder.
//
// Glovix speaks the OpenAI chat-completions protocol (streaming SSE with
// `tools` / `tool_calls`). DeepSeek's API is OpenAI-compatible, so this module
// simply proxies requests to api.deepseek.com and streams responses back
// verbatim. No message conversion is needed.
//
// This follows the same pattern as the Gemini bridge (glovix-gemini.ts):
//   - isConfigured() checks for DEEPSEEK_API_KEY
//   - streamDeepSeekCompatible() streams OpenAI-compatible SSE from DeepSeek
//
// Configuration:
//   DEEPSEEK_API_KEY          API key (required)
//   DEEPSEEK_MODEL            model id (default: deepseek-chat)

export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-chat"
export const DEEPSEEK_BASE_URL = "https://api.deepseek.com"

export function isDeepSeekConfigured(): boolean {
  return !!(process.env.DEEPSEEK_API_KEY)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

function isRetryable(err: any): boolean {
  const code = err?.status ?? err?.code ?? err?.response?.status
  if (code === 429 || code === 503 || code === 500 || code === 502) return true
  const msg = String(err?.message || err || "").toLowerCase()
  return (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("503") ||
    msg.includes("502") ||
    msg.includes("timeout")
  )
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === attempts - 1 || !isRetryable(err)) break
      const backoff = Math.min(1000 * 2 ** i, 8000) + Math.floor(Math.random() * 400)
      await sleep(backoff)
    }
  }
  throw lastErr
}

// ---------------------------------------------------------------------------
// Request / response types (mirrors OpenAI chat-completions)
// ---------------------------------------------------------------------------

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

export interface GenerateRequest {
  messages: OpenAIMessage[]
  tools?: any
  temperature?: number
  maxOutputTokens?: number
  model?: string
  /** Cancels the upstream request when the browser disconnects. */
  signal?: AbortSignal
}

// ---------------------------------------------------------------------------
// DeepSeek streaming — passes OpenAI-format requests through to DeepSeek
// ---------------------------------------------------------------------------

export function streamDeepSeekCompatible(req: GenerateRequest): Response {
  const encoder = new TextEncoder()
  const modelLabel = req.model || DEEPSEEK_MODEL
  const apiKey = process.env.DEEPSEEK_API_KEY || ""

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const id = `chatcmpl-${Date.now()}`
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

      // Commit response headers immediately to prevent buffering and timeouts
      enqueue(encoder.encode(": deepseek-stream-ready\n\n"))
      const keepaliveTimer = setInterval(() => {
        if (!closed) {
          enqueue(encoder.encode(": ping\n\n"))
        }
      }, 15000)

      try {
        // Build the OpenAI-compatible request body that DeepSeek expects.
        const requestBody = {
          model: modelLabel,
          messages: req.messages,
          temperature: req.temperature ?? 0.7,
          max_tokens: req.maxOutputTokens ?? 16384,
          stream: true,
          ...(req.tools && Array.isArray(req.tools) && req.tools.length > 0
            ? { tools: req.tools, tool_choice: "auto" as const }
            : {}),
        }

        const res = await withRetry(() =>
          fetch(`${DEEPSEEK_BASE_URL}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              Accept: "text/event-stream",
            },
            body: JSON.stringify(requestBody),
            signal: req.signal ? AbortSignal.any([req.signal, AbortSignal.timeout(120_000)]) : AbortSignal.timeout(120_000),
          }),
        )

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`)
          let errMsg = errText
          try {
            const parsed = JSON.parse(errText)
            errMsg = parsed.error?.message || parsed.message || errText
          } catch { /* raw text is fine */ }
          sendEvent(JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: modelLabel,
            choices: [{ index: 0, delta: { content: `\n\n[DeepSeek error] ${res.status}: ${errMsg}` }, finish_reason: "stop" }],
          }))
          done()
          return
        }

        if (!res.body) {
          throw new Error("No response body from DeepSeek")
        }

        // Keep upstream chunks intact. Re-framing line by line coalesces events,
        // drops SSE comments/blank delimiters, and adds visible token latency.
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
        const message = err?.message || "DeepSeek generation failed"
        sendEvent(JSON.stringify({
          id,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: modelLabel,
          choices: [{ index: 0, delta: { content: `\n\n[AI error] ${message}` }, finish_reason: "stop" }],
        }))
        done()
      } finally {
        clearInterval(keepaliveTimer)
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
