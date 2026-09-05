import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_SYCORD_BASE = "https://sycord.site"

type SycordModel = {
  id?: unknown
  profile?: unknown
  name?: unknown
  model?: unknown
  enabled?: unknown
  active?: unknown
  provider?: unknown
}

type SycordModelsResponse = {
  available_models?: unknown
  models?: unknown
  ai_tab_models?: unknown
  saved_providers?: unknown
}

function getSycordModelsUrl(): string {
  const configuredBase = (process.env.DEPLOYER_API_URL || DEFAULT_SYCORD_BASE).replace(/\/+$/, "")
  const base = configuredBase.replace(/\/api\/?$/, "")
  return `${base}/api/models`
}

function normalizeModels(payload: SycordModelsResponse): Array<{ id: string; profile: string; name: string }> {
  // Check available_models, models, ai_tab_models, or saved_providers from Sycord VM
  const source = Array.isArray(payload.available_models)
    ? payload.available_models
    : Array.isArray(payload.models)
      ? payload.models
      : Array.isArray(payload.ai_tab_models)
        ? payload.ai_tab_models
        : Array.isArray(payload.saved_providers)
          ? payload.saved_providers
          : []

  const seen = new Set<string>()
  const models: Array<{ id: string; profile: string; name: string }> = []

  for (const candidate of source as SycordModel[]) {
    if (!candidate || candidate.enabled === false || candidate.active === false) continue

    const rawId = typeof candidate.id === "string" ? candidate.id.trim() : ""
    const rawModel = typeof candidate.model === "string" ? candidate.model.trim() : ""
    const rawProfile = typeof candidate.profile === "string" ? candidate.profile.trim() : ""
    const rawName = typeof candidate.name === "string" ? candidate.name.trim() : ""

    const profile = rawModel || rawProfile || rawId
    const name = rawName || rawModel || rawProfile || rawId
    const id = rawId || profile

    if (!profile || !name || !id || seen.has(profile)) continue

    seen.add(profile)
    models.push({ id, profile, name })
  }

  return models
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const apiKey = process.env.DEPLOYER_API_KEY || ""
  const headers: Record<string, string> = { Accept: "application/json" }
  if (apiKey) {
    headers["X-API-Key"] = apiKey
    headers.Authorization = `Bearer ${apiKey}`
  }

  try {
    const response = await fetch(getSycordModelsUrl(), {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })

    const payload = (await response.json().catch(() => null)) as SycordModelsResponse | null
    if (!response.ok || !payload) {
      return Response.json(
        { message: `Sycord model API returned ${response.status || 502}.` },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
      )
    }

    // Detect streaming request via query param or Accept header
    const url = new URL(request.url);
    const wantsStream = (url.searchParams.get("stream") === "true" || request.headers.get("accept")?.includes("text/event-stream"));
    if (wantsStream) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          for (const model of normalizeModels(payload)) {
            const data = JSON.stringify({ model })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }
          controller.enqueue(encoder.encode(`data: [DONE]\n\n`))
          controller.close()
        },
      })
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      })
    }

    return Response.json({ models: normalizeModels(payload) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach Sycord model API."
    return Response.json({ message }, { status: 502 })
  }
}

