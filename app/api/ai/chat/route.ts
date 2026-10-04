// AI endpoint for the Glovix builder — pure Omni Provider backed by Vercel AI Gateway.
//
// All models route exclusively through the Vercel AI Gateway (https://ai-gateway.vercel.sh/v1)
// with OpenAI-compatible SSE streaming, tools support, and keepalive heartbeats.
//
// Configure via env:
//   VERCEL_AI (or VERCEL_AI_KEY, AI_GATEWAY_API_KEY)

import { isVercelAiConfigured, streamVercelAiGateway } from "@/lib/vercel-ai-gateway"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const fetchCache = "force-no-store"
export const maxDuration = 300

/**
 * Standardize incoming model ID to full Vercel AI Gateway format: `provider/model-name`
 */
function normalizeToGatewayModel(requested?: string): string {
  if (!requested || typeof requested !== "string") {
    return "anthropic/claude-3.5-sonnet"
  }
  const clean = requested.trim()
  if (clean.includes("/")) {
    return clean
  }

  const lower = clean.toLowerCase()
  if (lower.startsWith("gemini") || lower.startsWith("gemma")) {
    return `google/${clean}`
  }
  if (lower.startsWith("claude")) {
    return `anthropic/${clean}`
  }
  if (lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.startsWith("chatgpt")) {
    return `openai/${clean}`
  }
  if (lower.startsWith("deepseek")) {
    return `deepseek/${clean}`
  }
  if (lower.startsWith("glm")) {
    return `z-ai/${clean}`
  }
  if (lower.startsWith("minimax")) {
    return `minimax/${clean}`
  }
  if (lower.startsWith("llama") || lower.startsWith("meta")) {
    return `meta/${clean}`
  }
  if (lower.startsWith("mistral") || lower.startsWith("codestral") || lower.startsWith("pixtral")) {
    return `mistral/${clean}`
  }
  if (lower.startsWith("qwen")) {
    return `qwen/${clean}`
  }

  // Profile alias mappings
  if (lower === "syra-nano") return "google/gemini-2.5-flash"
  if (lower === "syra-base") return "deepseek/deepseek-chat"
  if (lower === "syra-havy") return "google/gemini-2.5-pro"
  if (lower === "syra-ultra") return "anthropic/claude-3.7-sonnet"

  return clean
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const rate = checkRateLimit(`ai-chat:${userId}`, { limit: 40, windowMs: 60_000 })
  if (!rate.allowed) {
    return new Response(JSON.stringify({ error: "Too many AI requests. Please wait and try again." }), {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(rate.retryAfterSec),
      },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const messages = Array.isArray(body?.messages) ? body.messages : null
  if (!messages) {
    return new Response(JSON.stringify({ error: "Missing 'messages' array" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!isVercelAiConfigured()) {
    return new Response(
      JSON.stringify({
        error:
          "Vercel AI Gateway (Omni Provider) is not configured. Set VERCEL_AI or AI_GATEWAY_API_KEY in your environment.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }

  const gatewayModel = normalizeToGatewayModel(body?.model)

  return streamVercelAiGateway({
    messages,
    tools: body?.tools,
    temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
    max_tokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
    thinking_level: typeof body?.thinking_level === "string" ? body.thinking_level : undefined,
    reasoning_effort: typeof body?.reasoning_effort === "string" ? body.reasoning_effort : undefined,
    model: gatewayModel,
    signal: req.signal,
  })
}

