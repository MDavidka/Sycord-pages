// AI endpoint for the Glovix builder — backed by Google Gemini on Vertex AI and
// DeepSeek (OpenAI-compatible).
//
// The Glovix client posts OpenAI-compatible chat-completion requests (streaming,
// with `tools` / `tool_calls`) to `/api/ai/chat`. This handler routes to the
// appropriate provider based on the requested model name:
//
//   - Models starting with "deepseek" → DeepSeek API (api.deepseek.com)
//   - Everything else → Gemini on Vertex AI (aiplatform.googleapis.com)
//
// Both providers stream responses back in OpenAI-compatible SSE so the client
// is unchanged regardless of which backend is used.
//
// Configure via env:
//   Gemini:
//     GOOGLE_VERTEX_PROJECT  / GOOGLE_VERTEX_LOCATION  → full Vertex AI (ADC)
//     GOOGLE_AIAGENT_API                              → API key (express/dev API)
//     GOOGLE_AIAGENT_MODEL                            → model (default gemini-3.5-flash)
//
//   DeepSeek:
//     DEEPSEEK_API_KEY                                 → API key (required)
//     DEEPSEEK_MODEL                                   → model (default deepseek-chat)

import { isConfigured, streamOpenAICompatible } from "@/lib/glovix-gemini"
import { isDeepSeekConfigured, streamDeepSeekCompatible } from "@/lib/glovix-deepseek"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function isDeepSeekModel(model: string | undefined): boolean {
  if (!model) return false
  return model.toLowerCase().startsWith("deepseek")
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

  const model = typeof body?.model === "string" ? body.model : undefined

  // Route to DeepSeek for deepseek-* models.
  if (isDeepSeekModel(model)) {
    if (!isDeepSeekConfigured()) {
      return new Response(
        JSON.stringify({
          error:
            "DeepSeek is not configured. Set DEEPSEEK_API_KEY in your environment.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      )
    }
    return streamDeepSeekCompatible({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      maxOutputTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      model: model || undefined,
    })
  }

  // Default: Gemini on Vertex AI.
  if (!isConfigured()) {
    return new Response(
      JSON.stringify({
        error:
          "No AI provider is configured. Set DEEPSEEK_API_KEY for DeepSeek, or GOOGLE_VERTEX_PROJECT / GOOGLE_AIAGENT_API for Gemini.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }

  return streamOpenAICompatible({
    messages,
    tools: body?.tools,
    temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
    maxOutputTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
    model: model || undefined,
  })
}
