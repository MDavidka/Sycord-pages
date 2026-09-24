import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { fetchVercelGatewayModels } from "@/lib/vercel-ai-gateway"
import { syteSelectOmniModel } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const refresh = searchParams.get("refresh") === "true"

  try {
    // Always fetch live model list from Vercel AI Gateway
    const models = await fetchVercelGatewayModels(refresh)

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
      name: modelList[0]?.provider_display || provider.charAt(0).toUpperCase() + provider.slice(1),
      count: modelList.length,
      models: modelList,
    }))

    return NextResponse.json({
      ok: true,
      provider: "vercel_ai_gateway",
      models,
      providers,
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
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

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

    return NextResponse.json(result.data || { ok: true, active_model: model_id, provider })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Invalid JSON payload" }, { status: 400 })
  }
}
