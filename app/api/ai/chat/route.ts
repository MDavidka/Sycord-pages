// AI endpoint for the Glovix builder — backed by Google Gemini on Vertex AI,
// DeepSeek, MiniMax, and GLM / Z.ai (OpenAI-compatible).
//
// The Glovix client posts OpenAI-compatible chat-completion requests (streaming,
// with `tools` / `tool_calls`) to `/api/ai/chat`. This handler routes to the
// appropriate provider based on the requested model name:
//
//   - Models starting with "deepseek" → DeepSeek API (api.deepseek.com)
//   - Models matching GLM (glm-* / z-ai/glm-*) → Z.ai API (api.z.ai)
//   - Models matching MiniMax (minimax-m3 / MiniMax-*) → MiniMax API (api.minimax.io)
//   - Everything else → Gemini on Vertex AI (aiplatform.googleapis.com)
//
// Providers stream responses back in OpenAI-compatible SSE so the client
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
//
//   GLM / Z.ai (syra-ultra → glm-5.2):
//     ZAI_API_KEY (or GLM_API_KEY)                     → API key (required)
//     GLM_MODEL                                        → model (default glm-5.2)
//
//   MiniMax:
//     MINIMAX_API_KEY                                  → API key (required)
//     MINIMAX_MODEL                                    → model (default MiniMax-M3)
//
//   NVIDIA NIM:
//     NVIDIA_NIM_API_KEY (or NIM_API_KEY)              → API key (required)
//     NVIDIA_NIM_MODEL                                 → model (default meta/llama-3.3-70b-instruct)

import { isConfigured, streamOpenAICompatible } from "@/lib/glovix-gemini"
import { isDeepSeekConfigured, streamDeepSeekCompatible } from "@/lib/glovix-deepseek"
import { isGlmConfigured, streamGlmCompatible } from "@/lib/glovix-glm"
import { isMiniMaxConfigured, streamMiniMaxCompatible } from "@/lib/glovix-minimax"
import { isNimConfigured, streamNimCompatible, isNimModelId } from "@/lib/glovix-nim"
import { isVercelAiConfigured, streamVercelAiGateway } from "@/lib/vercel-ai-gateway"
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

function isGlmModel(model: string | undefined): boolean {
  if (!model) return false
  const id = model.toLowerCase()
  return id.startsWith("glm") || id.startsWith("z-ai/glm") || id.startsWith("zhipu/glm")
}

function isMiniMaxModel(model: string | undefined): boolean {
  if (!model) return false
  const id = model.toLowerCase()
  return id.startsWith("minimax") || id.startsWith("minimax/")
}

function isNimModel(model: string | undefined): boolean {
  return isNimModelId(model)
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
      signal: req.signal,
    })
  }

  // Route to GLM / Z.ai for glm-* models (syra-ultra → glm-5.2).
  if (isGlmModel(model)) {
    if (!isGlmConfigured()) {
      return new Response(
        JSON.stringify({
          error:
            "GLM is not configured. Set ZAI_API_KEY (or GLM_API_KEY) in your environment.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      )
    }
    return streamGlmCompatible({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      maxOutputTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      model: model || undefined,
      signal: req.signal,
    })
  }

  // Route to MiniMax for minimax-* / MiniMax-* models.
  if (isMiniMaxModel(model)) {
    if (!isMiniMaxConfigured()) {
      return new Response(
        JSON.stringify({
          error:
            "MiniMax is not configured. Set MINIMAX_API_KEY in your environment.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      )
    }
    return streamMiniMaxCompatible({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      maxOutputTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      model: model || undefined,
      signal: req.signal,
    })
  }

  // Route to NVIDIA NIM for nim/*, nvidia/*, meta/llama-3*, etc.
  if (isNimModel(model)) {
    const customKey = typeof body?.nim_api_key === "string" ? body.nim_api_key : typeof body?.api_key === "string" ? body.api_key : undefined
    if (!isNimConfigured() && !customKey) {
      return new Response(
        JSON.stringify({
          error:
            "NVIDIA NIM is not configured. Please provide your NVIDIA NIM API key via NVIDIA_NIM_API_KEY or Omni Router settings.",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      )
    }
    return streamNimCompatible({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      maxOutputTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      model: model || undefined,
      apiKeyOverride: customKey,
      signal: req.signal,
    })
  }

  // Route to Google API / Vertex AI for Gemini models (gemini-*, google/*, etc.)
  const isGoogle = model && (model.toLowerCase().startsWith("gemini") || model.toLowerCase().startsWith("google/"))
  if (isGoogle && isConfigured()) {
    const cleanModel = model.replace(/^google\//i, "")
    return streamOpenAICompatible({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      maxOutputTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      model: cleanModel,
      thinkingLevel: typeof body?.thinking_level === "string" ? body.thinking_level : typeof body?.thinkingLevel === "string" ? body.thinkingLevel : undefined,
      signal: req.signal,
    })
  }

  // Route to Vercel AI Gateway if model has provider prefix (e.g. anthropic/*, openai/*, meta/*, etc.)
  // or if VERCEL_AI is configured.
  const isSlashModel = typeof model === "string" && model.includes("/")
  if (isVercelAiConfigured() && (isSlashModel || !isConfigured())) {
    return streamVercelAiGateway({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      max_tokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      model: model || undefined,
      signal: req.signal,
    })
  }

  // If Google is configured, use Gemini on Google Developer API / Vertex AI as default
  if (isConfigured()) {
    return streamOpenAICompatible({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      maxOutputTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      model: model ? model.replace(/^google\//i, "") : undefined,
      thinkingLevel: typeof body?.thinking_level === "string" ? body.thinking_level : typeof body?.thinkingLevel === "string" ? body.thinkingLevel : undefined,
      signal: req.signal,
    })
  }

  // Fallback: Vercel AI Gateway
  if (isVercelAiConfigured()) {
    return streamVercelAiGateway({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      max_tokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      model: model || undefined,
      signal: req.signal,
    })
  }

  return new Response(
    JSON.stringify({
      error:
        "No AI provider is configured. Set GOOGLE_API_KEY, GOOGLE_AIAGENT_API, VERCEL_AI, NVIDIA_NIM_API_KEY, DEEPSEEK_API_KEY, or ZAI_API_KEY.",
    }),
    { status: 503, headers: { "Content-Type": "application/json" } },
  )
}
