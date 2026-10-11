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

import { logModerationAction } from "@/lib/moderator-audit"
import { syteSyncHandshake } from "@/lib/deploy/syte-client"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized: Admin access required" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const moderatorEmail = session.user.email

    // Case 1: Bulk disable / enable all (scoped to provider if provided)
    if (typeof body.action === "string" && (body.action === "disable_all" || body.action === "enable_all")) {
      const isEnable = body.action === "enable_all"
      const gatewayModels = await fetchVercelGatewayModels()
      
      let targetModels = gatewayModels
      if (Array.isArray(body.modelIds) && body.modelIds.length > 0) {
        targetModels = gatewayModels.filter((m) => body.modelIds.includes(m.id))
      } else if (typeof body.provider === "string" && body.provider.trim()) {
        const prov = body.provider.toLowerCase().trim()
        targetModels = gatewayModels.filter((m) => {
          const p = (m.provider || "").toLowerCase()
          if (prov === "vertex" || prov === "google") {
            return p.includes("vertex") || p.includes("google") || m.id.includes("gemini")
          }
          if (prov === "vercel") {
            return p.includes("vercel") || p === "openai" || p === "anthropic"
          }
          if (prov === "vyce") {
            return p.includes("vyce") || m.id.includes("vyce")
          }
          return p === prov || p.includes(prov)
        })
      }

      const targetIds = targetModels.map((m) => m.id)
      if (targetIds.length === 0) {
        return NextResponse.json({
          ok: true,
          action: body.action,
          provider: body.provider || null,
          count: 0,
          message: "No models matched provider scope",
        })
      }

      const success = await setBulkModelEnabled(targetIds, isEnable)
      if (!success) {
        return NextResponse.json({ ok: false, error: "Failed to bulk update model status" }, { status: 500 })
      }

      // Record audit action
      await logModerationAction({
        moderatorEmail,
        action: "models_bulk_update",
        targetType: "system",
        targetId: body.provider || "all_providers",
        reason: `${isEnable ? "Enabled" : "Disabled"} all models for provider ${body.provider || "all"}`,
        details: {
          action: body.action,
          provider: body.provider || "all",
          isEnable,
          modelCount: targetIds.length,
          modelIds: targetIds,
        },
      })

      // Sync state with VM runtime
      syteSyncHandshake({
        models: targetIds.map((id) => ({ id, enabled: isEnable })),
      }).catch((err) => console.warn("[syte-sync] Handshake warning:", err?.message || err))

      return NextResponse.json({
        ok: true,
        action: body.action,
        provider: body.provider || "all",
        count: targetIds.length,
        modelIds: targetIds,
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

    // Record audit action
    await logModerationAction({
      moderatorEmail,
      action: "model_toggle",
      targetType: "system",
      targetId: modelId,
      reason: `Updated model ${modelId} visibility/name`,
      details: {
        modelId,
        displayName,
        enabledInLibrary,
      },
    })

    // Sync state with VM runtime
    syteSyncHandshake({
      models: [{ id: modelId, enabled: enabledInLibrary ?? true }],
    }).catch((err) => console.warn("[syte-sync] Handshake warning:", err?.message || err))

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
