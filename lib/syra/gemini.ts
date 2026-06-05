// Gemini client + context caching for Syra.
//
// Uses the GOOGLE_AIAGENT_API key and the GOOGLE_AIAGENT_MODEL model
// (defaulting to a Flash model). The stable project context is saved to Gemini's
// explicit context cache so subsequent prompt rounds reuse it cheaply; when the
// context is too small for the cache (Gemini enforces a minimum token count) we
// fall back to injecting it inline. Either way the behaviour is identical to the
// caller.

import { GoogleGenerativeAI, type GenerativeModel } from "@google/generative-ai"

export const GEMINI_MODEL = process.env.GOOGLE_AIAGENT_MODEL || "gemini-2.5-flash"
const CACHE_MODEL = process.env.GOOGLE_AIAGENT_CACHE_MODEL || GEMINI_MODEL

export function getApiKey(): string {
  const key = process.env.GOOGLE_AIAGENT_API || process.env.GOOGLE_AIAGENT_API_KEY
  if (!key) {
    throw new Error("Missing GOOGLE_AIAGENT_API environment variable for Syra generation.")
  }
  return key
}

export function getClient(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(getApiKey())
}

export interface ProjectContextHandle {
  /** Cache resource name when an explicit Gemini cache was created. */
  cacheName: string | null
  /** True when the context lives in a Gemini context cache. */
  cached: boolean
  /** Approximate token count of the cached/stored context. */
  tokens?: number
  /** The raw stable context text (used for the inline fallback). */
  text: string
}

/**
 * Best-effort: store the stable project context in Gemini's context cache.
 * Returns a handle describing whether caching succeeded. Never throws — a failed
 * cache simply means we inline the context instead.
 */
export async function cacheProjectContext(stableContext: string): Promise<ProjectContextHandle> {
  const handle: ProjectContextHandle = { cacheName: null, cached: false, text: stableContext }

  // Rough token estimate (≈4 chars/token). Gemini rejects caches below its
  // minimum token threshold, so skip the network call for small contexts.
  const approxTokens = Math.ceil(stableContext.length / 4)
  handle.tokens = approxTokens
  if (approxTokens < 1200) {
    return handle
  }

  try {
    // Dynamically import the server-only cache manager so the module stays out
    // of any edge/client bundle.
    const mod: any = await import("@google/generative-ai/server")
    const CacheManager = mod.GoogleAICacheManager
    if (!CacheManager) return handle
    const manager = new CacheManager(getApiKey())
    const modelName = CACHE_MODEL.startsWith("models/") ? CACHE_MODEL : `models/${CACHE_MODEL}`
    const cache = await manager.create({
      model: modelName,
      displayName: "syra-project-context",
      systemInstruction:
        "You are Syra's project memory. The following is stable context about the user's codebase.",
      contents: [{ role: "user", parts: [{ text: stableContext }] }],
      ttlSeconds: 60 * 30, // 30 minutes
    })
    handle.cacheName = cache?.name || null
    handle.cached = !!cache?.name
    if (cache?.usageMetadata?.totalTokenCount) handle.tokens = cache.usageMetadata.totalTokenCount
  } catch {
    // Caching unavailable (small context, model without cache support, etc.).
    // Fall back to inline context — handled by the caller.
  }
  return handle
}

/**
 * Build a generative model bound to the project context. When an explicit cache
 * exists we attach it; otherwise the context is folded into the systemInstruction.
 */
export function buildModel(
  client: GoogleGenerativeAI,
  handle: ProjectContextHandle,
  systemInstruction: string,
  tools?: any[],
): GenerativeModel {
  const fullSystem = handle.cached
    ? systemInstruction
    : `${systemInstruction}\n\n${handle.text}`

  if (handle.cached && handle.cacheName) {
    try {
      return client.getGenerativeModelFromCachedContent({
        name: handle.cacheName,
        model: GEMINI_MODEL.startsWith("models/") ? GEMINI_MODEL : `models/${GEMINI_MODEL}`,
      } as any)
    } catch {
      // Fall through to a plain model with inline context.
    }
  }

  return client.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: fullSystem,
    ...(tools ? { tools: [{ functionDeclarations: tools }] } : {}),
  })
}

/** Delete a context cache when the run is done. Never throws. */
export async function releaseContextCache(handle: ProjectContextHandle): Promise<void> {
  if (!handle.cached || !handle.cacheName) return
  try {
    const mod: any = await import("@google/generative-ai/server")
    const CacheManager = mod.GoogleAICacheManager
    if (!CacheManager) return
    const manager = new CacheManager(getApiKey())
    await manager.delete(handle.cacheName)
  } catch {
    /* ignore */
  }
}
