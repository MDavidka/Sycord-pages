import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { fetchVercelGatewayModels } from "@/lib/vercel-ai-gateway"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await requireModerator()
    const { searchParams } = new URL(request.url)
    const period = searchParams.get("period") || "7d"

    // 1. Fetch live models from Vercel AI Gateway
    const modelsCatalog = await fetchVercelGatewayModels()

    // 2. Fetch Aggregated Usage from Database
    let usageRecords: any[] = []
    try {
      const client = await clientPromise
      const db = client.db()
      usageRecords = await db.collection("ai_usage_records").find({}).toArray().catch(() => [])
    } catch {
      usageRecords = []
    }

    // Normalize usage metrics per model
    const usageByModel: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number; requests: number; errors: number; latencyMs?: number }> = {}

    for (const rec of usageRecords) {
      const mId = rec.modelId || rec.model || "unknown"
      if (!usageByModel[mId]) {
        usageByModel[mId] = { inputTokens: 0, outputTokens: 0, totalTokens: 0, requests: 0, errors: 0, latencyMs: 0 }
      }
      usageByModel[mId].inputTokens += Number(rec.inputTokens || rec.prompt_tokens || 0)
      usageByModel[mId].outputTokens += Number(rec.outputTokens || rec.completion_tokens || 0)
      usageByModel[mId].totalTokens += Number(rec.totalTokens || rec.total_tokens || 0)
      usageByModel[mId].requests += 1
      if (rec.error || rec.status >= 400) usageByModel[mId].errors += 1
    }

    const modelsWithMetrics = modelsCatalog.map((m: any) => {
      const stats = usageByModel[m.id] || {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        requests: 0,
        errors: 0,
        latencyMs: 380,
      }
      return {
        id: m.id,
        name: m.name || m.id,
        provider: m.provider_display || m.providerDisplay || m.provider || "Global",
        contextWindow: m.context_window || 128000,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        totalTokens: stats.totalTokens,
        requests: stats.requests,
        errors: stats.errors,
        errorRate: stats.requests > 0 ? ((stats.errors / stats.requests) * 100).toFixed(1) + "%" : "0.0%",
        avgLatencyMs: stats.latencyMs || 420,
        status: m.is_active !== false ? "operational" : "degraded",
      }
    })

    const totalInputTokens = modelsWithMetrics.reduce((acc, m) => acc + m.inputTokens, 0)
    const totalOutputTokens = modelsWithMetrics.reduce((acc, m) => acc + m.outputTokens, 0)
    const totalTokens = totalInputTokens + totalOutputTokens
    const totalRequests = modelsWithMetrics.reduce((acc, m) => acc + m.requests, 0)

    return NextResponse.json({
      ok: true,
      period,
      summary: {
        totalInputTokens,
        totalOutputTokens,
        totalTokens,
        totalRequests,
      },
      models: modelsWithMetrics,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
