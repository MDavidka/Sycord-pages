// AI endpoint for the Glovix builder — pure Omni Provider backed by Vercel AI Gateway.
//
// All models route exclusively through the Vercel AI Gateway (https://ai-gateway.vercel.sh/v1)
// with OpenAI-compatible SSE streaming, tools support, and keepalive heartbeats.
//
// Configure via env:
//   VERCEL_AI (or VERCEL_AI_KEY, AI_GATEWAY_API_KEY)

import { isVercelAiConfigured, streamVercelAiGateway, streamCustomAiProvider } from "@/lib/vercel-ai-gateway"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { DEFAULT_SYSTEM_PROVIDERS } from "@/app/api/ai/custom-providers/route"
import clientPromise from "@/lib/mongodb"

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

/**
 * Resolves custom provider configuration from request payload, database, or system defaults.
 */
async function resolveCustomProvider(
  rawModel: string,
  userId: string,
  explicitCp?: { base_url?: string; api_key?: string; provider?: string }
): Promise<{ baseUrl: string; apiKey?: string; providerName: string; resolvedModel: string } | null> {
  const modelStr = (rawModel || "").trim()
  const modelLower = modelStr.toLowerCase()

  // 1. If explicit custom_provider payload is provided by client
  if (explicitCp?.base_url) {
    const slug = (explicitCp.provider || "").toLowerCase()
    let pureModel = modelStr
    if (slug && pureModel.toLowerCase().startsWith(`${slug}/`)) {
      pureModel = pureModel.slice(slug.length + 1)
    }
    return {
      baseUrl: explicitCp.base_url,
      apiKey: explicitCp.api_key,
      providerName: explicitCp.provider || "Custom Provider",
      resolvedModel: pureModel,
    }
  }

  // 2. Fetch configured providers for user + system providers (e.g. Vyce AI)
  let userProviders: any[] = []
  try {
    const client = await clientPromise
    const db = client.db()
    userProviders = await db.collection("user_custom_providers").find({ userId }).toArray()
  } catch {}

  const allProviders = [...userProviders, ...DEFAULT_SYSTEM_PROVIDERS]

  for (const p of allProviders) {
    const slug = (p.provider || p.name || "").toLowerCase().replace(/[^a-z0-9_-]/g, "_")
    const pBaseUrl = p.base_url || ""
    if (!pBaseUrl) continue

    // Check if model matches provider slug prefix, e.g. "vyceai/deepseek-v4.1" or "vyceai/..."
    if (slug && modelLower.startsWith(`${slug}/`)) {
      const pureModel = modelStr.slice(slug.length + 1)
      return {
        baseUrl: pBaseUrl,
        apiKey: p.api_key,
        providerName: p.name || slug,
        resolvedModel: pureModel,
      }
    }

    // Check if model is listed explicitly in provider's model array
    if (Array.isArray(p.models)) {
      const found = p.models.some((m: string) => {
        const mStr = String(m).toLowerCase()
        return mStr === modelLower || `${slug}/${mStr}` === modelLower
      })
      if (found) {
        let pureModel = modelStr
        if (slug && pureModel.toLowerCase().startsWith(`${slug}/`)) {
          pureModel = pureModel.slice(slug.length + 1)
        }
        return {
          baseUrl: pBaseUrl,
          apiKey: p.api_key,
          providerName: p.name || slug,
          resolvedModel: pureModel,
        }
      }
    }
  }

  return null
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id || "guest_user"

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

  const requestedModel = String(body?.model || "")

  // Check if requested model belongs to a custom provider (e.g. Vyce AI or user-added custom provider)
  const customProviderMatch = await resolveCustomProvider(requestedModel, userId, body?.custom_provider)

  if (customProviderMatch) {
    // Call the custom provider's own API directly (not the basic Vercel gateway)
    return streamCustomAiProvider({
      baseUrl: customProviderMatch.baseUrl,
      apiKey: customProviderMatch.apiKey,
      providerName: customProviderMatch.providerName,
      model: customProviderMatch.resolvedModel,
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
      max_tokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
      thinking_level: typeof body?.thinking_level === "string" ? body.thinking_level : undefined,
      reasoning_effort: typeof body?.reasoning_effort === "string" ? body.reasoning_effort : undefined,
      signal: req.signal,
    })
  }

  // Standard models: route via Vercel AI Gateway
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

