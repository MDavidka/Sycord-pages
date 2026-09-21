import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { logModerationAction } from "@/lib/moderator-audit"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireModerator()
    const client = await clientPromise
    const db = client.db()

    const reports = await db
      .collection("moderation_reports")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()

    return NextResponse.json({ ok: true, reports })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const mod = await requireModerator()
    const body = await request.json()
    const { reportId, status, resolutionNotes } = body

    if (!reportId || !status) {
      return NextResponse.json({ error: "Missing reportId or status" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    await db.collection("moderation_reports").updateOne(
      { id: reportId },
      {
        $set: {
          status,
          resolutionNotes: resolutionNotes || "",
          assignedModerator: mod.email,
          updatedAt: new Date().toISOString(),
        },
      }
    )

    await logModerationAction({
      moderatorEmail: mod.email,
      action: status === "resolved" ? "report_resolve" : "report_dismiss",
      targetType: "report",
      targetId: reportId,
      reason: resolutionNotes,
      details: { status },
    })

    return NextResponse.json({ ok: true, message: `Report marked as ${status}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
