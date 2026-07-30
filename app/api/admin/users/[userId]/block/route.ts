import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/torso"

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()

    const { userId } = await params
    const { isBlocked } = await request.json()

    const client = await clientPromise
    const db = client.db()

    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
          isBlocked: !!isBlocked,
          blockedAt: isBlocked ? new Date() : null
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: `User ${isBlocked ? "blocked" : "unblocked"} successfully`,
    })
  } catch (error) {
    console.error("[v0] Block user error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
