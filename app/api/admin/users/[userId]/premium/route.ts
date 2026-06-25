import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/torso"

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()

    const { userId } = await params
    const { isPremium } = await request.json()

    const client = await clientPromise
    const db = client.db()

    // Update all projects for this user (now embedded)
    // We can use array update with $[] to update all elements in projects array
    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
            "projects.$[].isPremium": !!isPremium,
            "projects.$[].premiumUpdatedAt": new Date()
        }
      }
    )

    return NextResponse.json({
      success: true,
      message: `User ${isPremium ? "upgraded" : "downgraded"} to ${isPremium ? "premium" : "free"}`,
    })
  } catch (error) {
    console.error("[v0] Premium update error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
