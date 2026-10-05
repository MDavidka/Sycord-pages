import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { logModerationAction } from "@/lib/moderator-audit"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const mod = await requireModerator()
    const body = await request.json()
    const { userId, reason, caseId } = body

    if (!userId || !reason) {
      return NextResponse.json({ error: "Missing userId or reason" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const user = await db.collection("users").findOne({ id: userId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const warning = {
      id: `warn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      userId,
      userEmail: user.email || "Unknown",
      moderatorEmail: mod.email,
      reason,
      caseId: caseId || null,
      createdAt: new Date().toISOString(),
    }

    await db.collection("moderation_warnings").insertOne(warning)
    await db.collection("users").updateOne(
      { id: userId },
      {
        $push: {
          warnings: warning,
        },
      }
    )

    await logModerationAction({
      moderatorEmail: mod.email,
      action: "user_warn",
      targetType: "user",
      targetId: userId,
      targetIdentifier: user.email,
      reason,
      details: { caseId },
    })

    return NextResponse.json({ ok: true, message: "Warning sent and recorded successfully", warning })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
