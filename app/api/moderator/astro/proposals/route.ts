import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { classifyVmAnomalies } from "@/lib/admin/astro-tasks"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await requireModerator()

    const { searchParams } = new URL(request.url)
    const host = searchParams.get("host") || undefined

    // Fetch live status internally via /api/admin/vps-runner/status
    const origin = new URL(request.url).origin
    const statusUrl = new URL("/api/admin/vps-runner/status", origin)
    if (host) statusUrl.searchParams.set("host", host)

    let vmStatus: Record<string, any> | null = null
    try {
      const res = await fetch(statusUrl.toString(), {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      })
      if (res.ok) {
        vmStatus = await res.json()
      }
    } catch {
      // In case status call fails
    }

    const proposals = classifyVmAnomalies(vmStatus)

    return NextResponse.json({
      ok: true,
      vmStatus,
      proposals,
      evaluatedAt: new Date().toISOString(),
    })
  } catch (err: any) {
    const status = err?.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ ok: false, error: err?.message || "Failed to classify proposals" }, { status })
  }
}
