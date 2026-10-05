import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import { getAuthenticatedModerator } from "@/lib/moderator-types"
import { logModerationAction } from "@/lib/moderator-audit"
import clientPromise from "@/lib/torso"

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()
    const mod = await getAuthenticatedModerator()

    const { userId } = await params
    const body = await request.json()
    const { isBlocked, reason } = body

    const client = await clientPromise
    const db = client.db()

    const targetUser = await db.collection("users").findOne({ id: userId })

    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
          isBlocked: !!isBlocked,
          blockedAt: isBlocked ? new Date().toISOString() : null,
          blockReason: isBlocked ? (reason || "") : null,
        },
      }
    )

    if (mod) {
      await logModerationAction({
        moderatorEmail: mod.email,
        action: isBlocked ? "user_ban" : "user_unban",
        targetType: "user",
        targetId: userId,
        targetIdentifier: targetUser?.email || "Unknown",
        reason: reason || "",
        details: { isBlocked: !!isBlocked },
      })
    }

    return NextResponse.json({
      success: true,
      ok: true,
      message: `User ${isBlocked ? "banned/blocked" : "unbanned"} successfully`,
    })
  } catch (error) {
    console.error("[v0] Block user error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
