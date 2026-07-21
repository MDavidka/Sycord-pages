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

    let body: { subscription?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const { subscription } = body

    if (!["Free", "Sycord+", "Sycord Enterprise"].includes(subscription || "")) {
      return NextResponse.json({ error: "Invalid subscription tier" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const isPremium = subscription !== "Free"

    await db.collection("users").updateOne(
      { id: userId },
      {
        $set: {
          subscription: subscription,
          isPremium: isPremium,
          subscriptionUpdatedAt: new Date(),
        },
      },
    )

    if (isPremium) {
      await db.collection("users").updateOne(
        { id: userId },
        {
          $set: {
            "projects.$[].isPremium": isPremium,
            "projects.$[].premiumUpdatedAt": new Date(),
          },
        },
      )
    }

    return NextResponse.json({
      success: true,
      message: `Subscription updated to ${subscription}`,
    })
  } catch (error) {
    console.error("[v0] Subscription update error:", error)
    return NextResponse.json({ error: "Failed to update subscription" }, { status: 500 })
  }
}
