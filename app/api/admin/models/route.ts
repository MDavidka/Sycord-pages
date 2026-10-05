import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdminEmail } from "@/lib/is-admin"
import { fetchVercelGatewayModels } from "@/lib/vercel-ai-gateway"
import { getAllModelConfigs, upsertModelConfig, setBulkModelEnabled } from "@/lib/models-config"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized: Admin access required" }, { status: 403 })
  }

  try {
    const [gatewayModels, customConfigs] = await Promise.all([
      fetchVercelGatewayModels(),
      getAllModelConfigs(),
    ])

    const models = gatewayModels.map((m) => {
      const config = customConfigs[m.id]
      return {
        id: m.id,
        originalName: m.name,
        displayName: config?.displayName || m.name || m.id,
        provider: m.provider,
        providerDisplay: m.provider_display,
        enabledInLibrary: config?.enabledInLibrary ?? true,
        contextWindow: m.context_window,
        inputCost: m.input_cost,
        outputCost: m.output_cost,
        inputCostDisplay: m.inputCostDisplay,
        outputCostDisplay: m.outputCostDisplay,
        tags: m.tags,
      }
    })

    return NextResponse.json({
      ok: true,
      models,
      totalCount: models.length,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to fetch models" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized: Admin access required" }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Case 1: Bulk disable / enable all
    if (typeof body.action === "string" && (body.action === "disable_all" || body.action === "enable_all")) {
      const isEnable = body.action === "enable_all"
      const gatewayModels = await fetchVercelGatewayModels()
      const allIds = gatewayModels.map((m) => m.id)

      const success = await setBulkModelEnabled(allIds, isEnable)
      if (!success) {
        return NextResponse.json({ ok: false, error: "Failed to bulk update model status" }, { status: 500 })
      }

      return NextResponse.json({
        ok: true,
        action: body.action,
        count: allIds.length,
      })
    }

    // Case 2: Single model update
    const { modelId, displayName, enabledInLibrary } = body

    if (!modelId) {
      return NextResponse.json({ ok: false, error: "modelId is required" }, { status: 400 })
    }

    const success = await upsertModelConfig(modelId, {
      displayName,
      enabledInLibrary,
    })

    if (!success) {
      return NextResponse.json({ ok: false, error: "Failed to persist model config" }, { status: 500 })
    }

    return NextResponse.json({
      ok: true,
      modelId,
      displayName,
      enabledInLibrary,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Invalid payload" }, { status: 400 })
  }
}
