// AI client for Syra — Vertex AI via the unified @google/genai SDK.
//
// Generation runs on Vertex AI. Auth/runtime is resolved from env, preferring
// Vertex AI and using the key the user provided (GOOGLE_AIAGENT_API):
//
//   GOOGLE_AIAGENT_API        API key (Vertex AI express mode / Gemini Dev API)
//   GOOGLE_AIAGENT_MODEL      model id (default: gemini-3.5-flash)
//   GOOGLE_VERTEX_PROJECT     GCP project id  -> full Vertex AI mode (ADC)
//   GOOGLE_VERTEX_LOCATION    region          (default: global)
//   GOOGLE_GENAI_USE_VERTEXAI "false" to force the Gemini Developer API
//
// The stable project context is stored in a Vertex AI context cache and reused
// across turns; when the context is too small for caching we transparently fall
// back to inlining it in the system instruction.

import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  type Content,
  type FunctionDeclaration,
  type GenerateContentConfig,
  type GenerateContentResponse,
} from "@google/genai"

// Syra generation runs strictly on the "gemini-3.5-flash" model unless an
// explicit override is provided via GOOGLE_AIAGENT_MODEL.
export const GEMINI_MODEL = process.env.GOOGLE_AIAGENT_MODEL || "gemini-3.5-flash"

export type AiMode = "vertex" | "vertex-express" | "developer"

export interface AiClient {
  ai: GoogleGenAI
  mode: AiMode
  model: string
}

function readEnv() {
  const apiKey = process.env.GOOGLE_AIAGENT_API || process.env.GOOGLE_AIAGENT_API_KEY || ""
  const project = process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || ""
  const location =
    process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || "global"
  const useVertex = (process.env.GOOGLE_GENAI_USE_VERTEXAI ?? "true").toLowerCase() !== "false"
  return { apiKey, project, location, useVertex }
}

/**
 * Construct the AI client, preferring Vertex AI. Throws a descriptive error when
 * neither a project nor an API key is configured.
 */
export function getAiClient(): AiClient {
  const { apiKey, project, location, useVertex } = readEnv()

  if (useVertex && project) {
    // Full Vertex AI: relies on Application Default Credentials.
    return {
      ai: new GoogleGenAI({ vertexai: true, project, location }),
      mode: "vertex",
      model: GEMINI_MODEL,
    }
  }

  if (useVertex && apiKey) {
    // Vertex AI express mode with an API key.
    return {
      ai: new GoogleGenAI({ vertexai: true, apiKey }),
      mode: "vertex-express",
      model: GEMINI_MODEL,
    }
  }

  if (apiKey) {
    // Gemini Developer API fallback.
    return { ai: new GoogleGenAI({ apiKey }), mode: "developer", model: GEMINI_MODEL }
  }

  throw new Error(
    "Syra is not configured: set GOOGLE_AIAGENT_API (and optionally GOOGLE_VERTEX_PROJECT) to enable Vertex AI generation.",
  )
}

export interface ProjectContextHandle {
  /** Cache resource name when a Vertex AI context cache was created. */
  cacheName: string | null
  /** True when the context lives in a context cache. */
  cached: boolean
  /** Approximate token count of the cached/stored context. */
  tokens?: number
  /** The raw stable context text (used for the inline fallback). */
  text: string
  /** How the AI client is running, surfaced to the debug UI. */
  mode: AiMode
}

function modelPath(model: string): string {
  return model.startsWith("models/") || model.startsWith("publishers/") ? model : model
}

/**
 * Best-effort: store the stable project context in a Vertex AI context cache.
 * Never throws — if caching is unavailable (small context, express mode limits,
 * etc.) we inline the context instead and report `cached: false`.
 */
export async function cacheProjectContext(
  client: AiClient,
  stableContext: string,
): Promise<ProjectContextHandle> {
  const handle: ProjectContextHandle = {
    cacheName: null,
    cached: false,
    text: stableContext,
    mode: client.mode,
    tokens: Math.ceil(stableContext.length / 4),
  }

  // Context caches enforce a minimum token count; skip tiny contexts outright.
  if ((handle.tokens ?? 0) < 1024) return handle

  try {
    const cache = await client.ai.caches.create({
      model: modelPath(client.model),
      config: {
        displayName: "syra-project-context",
        systemInstruction:
          "You are Syra's project memory. The following is stable context about the user's codebase.",
        contents: [{ role: "user", parts: [{ text: stableContext }] }],
        ttl: "1800s",
      },
    })
    handle.cacheName = cache?.name ?? null
    handle.cached = !!cache?.name
    const total = (cache as any)?.usageMetadata?.totalTokenCount
    if (typeof total === "number") handle.tokens = total
  } catch {
    // Fall back to inline context.
  }
  return handle
}

export async function releaseContextCache(client: AiClient, handle: ProjectContextHandle): Promise<void> {
  if (!handle.cached || !handle.cacheName) return
  try {
    await client.ai.caches.delete({ name: handle.cacheName })
  } catch {
    /* ignore */
  }
}

export interface GenerateOptions {
  client: AiClient
  handle: ProjectContextHandle
  systemInstruction: string
  contents: Content[]
  tools?: FunctionDeclaration[]
  /** "AUTO" lets the model choose; "ANY" forces a function call. */
  forceTool?: boolean
  temperature?: number
  responseJson?: boolean
  /** Upper bound on output tokens — raised high so the model can emit huge files. */
  maxOutputTokens?: number
}

/**
 * Single generation turn. Attaches the context cache when available, otherwise
 * folds the stable context into the system instruction.
 */
export async function generate(opts: GenerateOptions): Promise<GenerateContentResponse> {
  const { client, handle, systemInstruction, contents, tools, forceTool, temperature, responseJson, maxOutputTokens } =
    opts

  const config: GenerateContentConfig = {
    temperature: temperature ?? 0.7,
    maxOutputTokens: maxOutputTokens ?? 32768,
    // System instruction: inline the context only when it isn't cached.
    systemInstruction: handle.cached ? systemInstruction : `${systemInstruction}\n\n${handle.text}`,
  }

  if (handle.cached && handle.cacheName) config.cachedContent = handle.cacheName

  if (tools && tools.length) {
    config.tools = [{ functionDeclarations: tools }]
    config.toolConfig = {
      functionCallingConfig: {
        mode: forceTool ? FunctionCallingConfigMode.ANY : FunctionCallingConfigMode.AUTO,
      },
    }
  }
  if (responseJson) config.responseMimeType = "application/json"

  return client.ai.models.generateContent({
    model: client.model,
    contents,
    config,
  })
}
