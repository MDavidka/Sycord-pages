import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/torso"

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { userId } = await params
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 })
    }

    let body: { isPremium?: boolean }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { isPremium } = body

    const client = await clientPromise
    const db = client.db()

    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
          "projects.$[].isPremium": !!isPremium,
          "projects.$[].premiumUpdatedAt": new Date(),
        },
      },
    )

    return NextResponse.json({
      success: true,
      message: `User ${isPremium ? "upgraded" : "downgraded"} to ${isPremium ? "premium" : "free"}`,
    })
  } catch (error) {
    console.error("[v0] Premium update error:", error)
    return NextResponse.json({ error: "Failed to update premium status" }, { status: 500 })
  }
}
