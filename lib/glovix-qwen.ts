// Qwen (DashScope) bridge for the Glovix builder.
//
// Glovix speaks the OpenAI chat-completions protocol (streaming SSE with
// `tools` / `tool_calls`). DashScope's Qwen API is OpenAI-compatible at
// dashscope-intl.aliyuncs.com/compatible-mode/v1, so this module proxies
// requests and streams responses back verbatim — same pattern as the
// DeepSeek / MiniMax / GLM bridges.
//
// Configuration:
//   DASHSCOPE_API_KEY        API key (required; QWEN_API_KEY accepted as alias)
//   QWEN_MODEL               model id (default: qwen3.7-plus)
//   QWEN_BASE_URL            optional base URL override (default: intl endpoint)

export const QWEN_MODEL = process.env.QWEN_MODEL || "qwen3.7-plus"
export const QWEN_BASE_URL =
  process.env.QWEN_BASE_URL ||
  "https://dashscope-intl.aliyuncs.com/compatible-mode/v1"

function getQwenApiKey(): string {
  return process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || ""
}

export function isQwenConfigured(): boolean {
  return !!getQwenApiKey()
}

/** Normalize client model ids (qwen3.7-plus, qwen/qwen3.7-plus) to a DashScope id. */
export function resolveQwenModel(model?: string): string {
  if (!model) return QWEN_MODEL
  const id = model.trim()
  if (/^qwen\//i.test(id)) {
    return id.replace(/^qwen\//i, "")
  }
  if (/^qwen/i.test(id)) return id
  return QWEN_MODEL
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

export function streamQwenCompatible(req: GenerateRequest): Response {
  const encoder = new TextEncoder()
  const modelLabel = resolveQwenModel(req.model)
  const apiKey = getQwenApiKey()

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
          fetch(`${QWEN_BASE_URL}/chat/completions`, {
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
            choices: [{ index: 0, delta: { content: `\n\n[Qwen error] ${res.status}: ${errMsg}` }, finish_reason: "stop" }],
          })}`)
          done()
          return
        }

        if (!res.body) {
          throw new Error("No response body from Qwen")
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
        const message = err?.message || "Qwen generation failed"
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
