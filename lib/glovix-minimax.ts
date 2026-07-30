// MiniMax bridge for the Glovix builder.
//
// Glovix speaks the OpenAI chat-completions protocol (streaming SSE with
// `tools` / `tool_calls`). MiniMax's API is OpenAI-compatible at
// api.minimax.io/v1, so this module proxies requests and streams responses
// back verbatim — same pattern as the DeepSeek bridge.
//
// Configuration:
//   MINIMAX_API_KEY          API key (required)
//   MINIMAX_MODEL            model id (default: MiniMax-M3)

export const MINIMAX_MODEL = process.env.MINIMAX_MODEL || "MiniMax-M3"
export const MINIMAX_BASE_URL = "https://api.minimax.io"

export function isMiniMaxConfigured(): boolean {
  return !!(process.env.MINIMAX_API_KEY)
}

/** Normalize client model ids (minimax-m3, minimax/minimax-m3) to MiniMax-M3. */
export function resolveMiniMaxModel(model?: string): string {
  if (!model) return MINIMAX_MODEL
  const id = model.trim()
  if (/^minimax[-_/]?m3$/i.test(id) || /^minimax\/minimax-m3$/i.test(id)) {
    return "MiniMax-M3"
  }
  if (/^minimax-/i.test(id) || /^MiniMax-/i.test(id)) return id
  return MINIMAX_MODEL
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
}

export function streamMiniMaxCompatible(req: GenerateRequest): Response {
  const encoder = new TextEncoder()
  const modelLabel = resolveMiniMaxModel(req.model)
  const apiKey = process.env.MINIMAX_API_KEY || ""

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const id = `chatcmpl-${Date.now()}`
      const sendRaw = (line: string) => controller.enqueue(encoder.encode(`${line}\n`))
      const done = () => {
        sendRaw("data: [DONE]")
        controller.close()
      }

      try {
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
          fetch(`${MINIMAX_BASE_URL}/v1/chat/completions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
              Accept: "text/event-stream",
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(120_000),
          }),
        )

        if (!res.ok) {
          const errText = await res.text().catch(() => `HTTP ${res.status}`)
          let errMsg = errText
          try {
            const parsed = JSON.parse(errText)
            errMsg = parsed.error?.message || parsed.message || errText
          } catch { /* raw text is fine */ }
          sendRaw(`data: ${JSON.stringify({
            id,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: modelLabel,
            choices: [{ index: 0, delta: { content: `\n\n[MiniMax error] ${res.status}: ${errMsg}` }, finish_reason: "stop" }],
          })}`)
          done()
          return
        }

        if (!res.body) {
          throw new Error("No response body from MiniMax")
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        while (true) {
          const { done: streamDone, value } = await reader.read()
          if (streamDone) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() || ""

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) continue
            sendRaw(trimmed)
          }
        }

        if (buffer.trim()) {
          sendRaw(buffer.trim())
        }

        done()
      } catch (err: any) {
        const message = err?.message || "MiniMax generation failed"
        sendRaw(`data: ${JSON.stringify({
          id,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: modelLabel,
          choices: [{ index: 0, delta: { content: `\n\n[AI error] ${message}` }, finish_reason: "stop" }],
        })}`)
        done()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
