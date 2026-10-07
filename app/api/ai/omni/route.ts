import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { fetchVercelGatewayModels } from "@/lib/vercel-ai-gateway"
import { syteSelectOmniModel } from "@/lib/deploy/syte-client"
import { getAllModelConfigs } from "@/lib/models-config"
import clientPromise from "@/lib/mongodb"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || "guest_user"

  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get("refresh") === "true"

  try {
    // 1. Fetch live model list from Vercel AI Gateway & configs & custom providers in parallel
    const [rawModels, customConfigs, customProviders] = await Promise.all([
      fetchVercelGatewayModels(refresh),
      getAllModelConfigs().catch(() => ({} as Record<string, { displayName?: string; enabledInLibrary?: boolean }>)),
      (async () => {
        try {
          const client = await clientPromise
          const db = client.db()
          return await db.collection("user_custom_providers").find({ userId }).toArray()
        } catch {
          return []
        }
      })(),
    ])

    // Apply admin custom configs: filter out disabled models and update display names
    const models = rawModels
      .filter((m) => {
        const config = customConfigs[m.id]
        return config?.enabledInLibrary ?? true
      })
      .map((m) => {
        const config = customConfigs[m.id]
        if (config?.displayName) {
          return {
            ...m,
            name: config.displayName,
          }
        }
        return m
      })

    // 2. Append custom provider models
    for (const cp of customProviders) {
      const providerSlug = cp.provider || cp.name?.toLowerCase().replace(/[^a-z0-9_-]/g, "_") || "custom"
      const providerDisplayName = cp.name || providerSlug
      const modelList = Array.isArray(cp.models) ? cp.models : []

      for (const m of modelList) {
        const modelId = typeof m === "string" ? m : m?.id || m?.name
        if (!modelId) continue
        const fullId = modelId.includes("/") ? modelId : `${providerSlug}/${modelId}`
        const modelName = typeof m === "object" && m.name ? m.name : modelId.includes("/") ? modelId.split("/").pop() : modelId

        models.push({
          id: fullId,
          name: modelName,
          provider: providerSlug,
          providerDisplay: providerDisplayName,
          provider_display: providerDisplayName,
          swe_score: 50,
          input_cost: 0.0,
          output_cost: 0.0,
          context_window: 128000,
          supports_vision: true,
          supports_tools: true,
          supports_reasoning: true,
          description: `Custom model hosted on ${providerDisplayName} (${cp.base_url || "Custom Endpoint"})`,
          is_active: false,
          is_custom: true,
          tags: ["custom", providerSlug],
        } as any)
      }
    }

    // Group models by provider
    const providersMap = new Map<string, typeof models>()
    for (const m of models) {
      const p = m.provider || "other"
      if (!providersMap.has(p)) {
        providersMap.set(p, [])
      }
      providersMap.get(p)!.push(m)
    }

    const providers = Array.from(providersMap.entries()).map(([provider, modelList]) => ({
      id: provider,
      name: modelList[0]?.provider_display || modelList[0]?.providerDisplay || provider.charAt(0).toUpperCase() + provider.slice(1),
      count: modelList.length,
      models: modelList,
    }))

    return NextResponse.json({
      ok: true,
      provider: "vercel_ai_gateway",
      models,
      providers,
      custom_providers: customProviders.map((p) => ({
        id: p.id || p._id?.toString(),
        name: p.name,
        provider: p.provider,
        base_url: p.base_url,
        models: p.models,
      })),
      total_count: models.length,
      active_model: "anthropic/claude-3.5-sonnet",
      active_provider: "anthropic",
      credits: {
        balance: 200,
        total_granted: 200,
        total_used: 0,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to fetch models from Vercel AI Gateway" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || "guest_user"

  try {
    const body = await request.json()
    const { model_id, project_id, provider } = body

    if (!model_id) {
      return NextResponse.json({ ok: false, error: "model_id is required" }, { status: 400 })
    }

    const result = await syteSelectOmniModel(model_id, project_id || "global", provider).catch(() => ({
      ok: true,
      data: { ok: true, active_model: model_id, provider: provider || "vercel_ai_gateway" },
    }))

    return NextResponse.json(result?.data || { ok: true, active_model: model_id, provider })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Invalid JSON payload" }, { status: 400 })
  }
}
