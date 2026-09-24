import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { getRecentAuditLogs } from "@/lib/moderator-audit"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await requireModerator()
    const { searchParams } = new URL(request.url)
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))

    const logs = await getRecentAuditLogs(limit)
    return NextResponse.json({ ok: true, logs })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
