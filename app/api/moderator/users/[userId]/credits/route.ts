import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { logModerationAction } from "@/lib/moderator-audit"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const mod = await requireModerator()
    const { userId } = await params
    const body = await request.json()
    const { amount, action, reason } = body

    const numericAmount = Number(amount)
    if (!userId || !numericAmount || numericAmount <= 0 || !["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "Invalid parameters" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const user = await db.collection("users").findOne<{ credits?: number; isPremium?: boolean; email?: string }>({ id: userId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const currentBalance = Number(user.credits ?? (user.isPremium ? 200 : 10))
    const delta = action === "add" ? numericAmount : -numericAmount
    const newBalance = Math.max(0, Math.round((currentBalance + delta) * 100) / 100)

    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
          credits: newBalance,
          creditsUpdatedAt: new Date().toISOString(),
        },
      }
    )

    await logModerationAction({
      moderatorEmail: mod.email,
      action: action === "add" ? "credits_add" : "credits_remove",
      targetType: "user",
      targetId: userId,
      targetIdentifier: user.email,
      reason: reason || "",
      details: {
        previousBalance: currentBalance,
        delta,
        newBalance,
      },
    })

    return NextResponse.json({
      ok: true,
      message: `Credits successfully ${action === "add" ? "added" : "removed"}`,
      newBalance,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
