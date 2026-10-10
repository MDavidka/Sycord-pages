import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

/**
 * Smart Model Auto-Discovery Endpoint:
 * Given a base URL (e.g. OpenAI-compatible /v1, Ollama, Groq, Together, DeepInfra, OpenRouter)
 * or a chat completion endpoint URL, queries available models.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || "guest_user"

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON payload" }, { status: 400 })
  }

  const rawUrl = (body?.base_url || body?.url || "").trim()
  const apiKey = (body?.api_key || "").trim()

  if (!rawUrl) {
    return NextResponse.json({ ok: false, error: "Base URL or Chat Completion URL is required" }, { status: 400 })
  }

  // Normalize URL
  let baseUrl = rawUrl
  if (!baseUrl.startsWith("http://") && !baseUrl.startsWith("https://")) {
    baseUrl = `https://${baseUrl}`
  }
  // Strip trailing slashes
  baseUrl = baseUrl.replace(/\/+$/, "")
  // Strip chat completions / completions / chat paths
  baseUrl = baseUrl.replace(/\/chat\/completions\/?$/i, "")
  baseUrl = baseUrl.replace(/\/completions\/?$/i, "")
  baseUrl = baseUrl.replace(/\/chat\/?$/i, "")

  // Build candidate model endpoints to query in sequence or in parallel
  const candidates: string[] = []

  // 1. If ends with /v1, candidate is ${baseUrl}/models
  if (baseUrl.endsWith("/v1")) {
    candidates.push(`${baseUrl}/models`)
  } else {
    // Try both /v1/models and /models
    candidates.push(`${baseUrl}/models`)
    candidates.push(`${baseUrl}/v1/models`)
    // Also Ollama native tags endpoint
    candidates.push(`${baseUrl}/api/tags`)
  }

  const headers: Record<string, string> = {
    "Accept": "application/json",
    "User-Agent": "Sycord-Omni-Router/1.0",
  }
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`
  }

  const discoveredModels: Array<{ id: string; name: string; description?: string; context_window?: number }> = []
  let lastError = ""

  for (const candidateUrl of candidates) {
    try {
      const res = await fetch(candidateUrl, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(8000),
        cache: "no-store",
      })

      if (!res.ok) {
        lastError = `Endpoint ${candidateUrl} returned HTTP ${res.status}`
        continue
      }

      const data = await res.json().catch(() => null)
      if (!data) continue

      // Parse standard OpenAI response: { data: [ { id: "gpt-4o", ... } ] }
      if (Array.isArray(data.data) && data.data.length > 0) {
        for (const item of data.data) {
          const modelId = typeof item === "string" ? item : item?.id || item?.name
          if (modelId && typeof modelId === "string") {
            const cleanId = modelId.trim()
            discoveredModels.push({
              id: cleanId,
              name: item?.name || cleanId,
              description: item?.description || undefined,
              context_window: item?.context_length || item?.context_window || undefined,
            })
          }
        }
      }
      // Parse Ollama response: { models: [ { name: "llama3:latest", model: "llama3", ... } ] }
      else if (Array.isArray(data.models) && data.models.length > 0) {
        for (const item of data.models) {
          const modelId = typeof item === "string" ? item : item?.name || item?.model || item?.id
          if (modelId && typeof modelId === "string") {
            const cleanId = modelId.trim()
            discoveredModels.push({
              id: cleanId,
              name: item?.name || cleanId,
              description: item?.details?.parameter_size ? `Size: ${item.details.parameter_size}` : undefined,
            })
          }
        }
      }
      // Parse array response: [ { id: "..." } ] or [ "..." ]
      else if (Array.isArray(data) && data.length > 0) {
        for (const item of data) {
          const modelId = typeof item === "string" ? item : item?.id || item?.name || item?.model
          if (modelId && typeof modelId === "string") {
            const cleanId = modelId.trim()
            discoveredModels.push({
              id: cleanId,
              name: typeof item === "object" && item?.name ? item.name : cleanId,
            })
          }
        }
      }

      if (discoveredModels.length > 0) {
        break
      }
    } catch (err: any) {
      lastError = err?.message || "Connection timeout"
    }
  }

  // Deduplicate discovered models
  const uniqueModels: Array<{ id: string; name: string; description?: string; context_window?: number }> = []
  const seen = new Set<string>()
  for (const m of discoveredModels) {
    if (!seen.has(m.id)) {
      seen.add(m.id)
      uniqueModels.push(m)
    }
  }

  if (uniqueModels.length > 0) {
    return NextResponse.json({
      ok: true,
      models: uniqueModels,
      count: uniqueModels.length,
      message: `Discovered ${uniqueModels.length} models from provider endpoint.`,
    })
  }

  return NextResponse.json({
    ok: false,
    models: [],
    count: 0,
    error: lastError || "No models found at provider URL. You can add model names manually.",
  })
}
