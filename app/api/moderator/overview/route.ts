import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireModerator()
    const client = await clientPromise
    const db = client.db()

    const [reportsCount, warningsCount, bannedUsersCount, resolvedCount, recentReports] = await Promise.all([
      db.collection("moderation_reports").find({}).toArray().then((r) => r.length).catch(() => 0),
      db.collection("moderation_warnings").find({}).toArray().then((r) => r.length).catch(() => 0),
      db.collection("users").find({ isBlocked: true }).toArray().then((r) => r.length).catch(() => 0),
      db.collection("moderation_reports").find({ status: "resolved" }).toArray().then((r) => r.length).catch(() => 0),
      db.collection("moderation_reports").find({}).sort({ createdAt: -1 }).limit(10).toArray().catch(() => []),
    ])

    return NextResponse.json({
      ok: true,
      metrics: {
        reports: {
          total: reportsCount,
          changeText: "— vs. last week",
        },
        warnings: {
          total: warningsCount,
          changeText: "— vs. last week",
        },
        bans: {
          total: bannedUsersCount,
          changeText: "— vs. last week",
        },
        resolved: {
          total: resolvedCount,
          changeText: "— vs. last week",
        },
      },
      recentReports,
    })
  } catch (error: any) {
    console.error("[moderator/overview] Error:", error)
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
