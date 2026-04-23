import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/is-admin";
import clientPromise from "@/lib/mongodb";

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()

    const { userId } = await params
    const { subscription } = await request.json()

    if (!["Free", "Sycord+", "Sycord Enterprise"].includes(subscription)) {
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
          subscriptionUpdatedAt: new Date()
        }
      }
    )

    // Also update embedded projects
    if (isPremium) {
      await db.collection("users").updateOne(
        { id: userId },
        {
          $set: {
            "projects.$[].isPremium": isPremium,
            "projects.$[].premiumUpdatedAt": new Date()
          }
        }
      )
    }

    return NextResponse.json({
      success: true,
      message: `Subscription updated to ${subscription}`,
    })
  } catch (error) {
    console.error("[v0] Subscription update error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
