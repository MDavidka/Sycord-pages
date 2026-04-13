import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"

/**
 * Credits API
 * GET  — get current credit balance and history
 * POST — deduct credit (internal use from AI generation)
 */

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne({ id: session.user.id })

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 })
    }

    const credits = user.credits ?? 0
    const creditHistory = user.creditHistory ?? []

    return NextResponse.json({
      credits: parseFloat(credits.toFixed(2)),
      history: creditHistory.slice(-50).reverse(),
    })
  } catch (error: any) {
    console.error("[Credits] GET error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { amount, reason, projectId, fileName } = await request.json()

    if (typeof amount !== "number" || amount === 0) {
      return NextResponse.json({ message: "Invalid amount" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const historyEntry = {
      amount: parseFloat(amount.toFixed(2)),
      reason: reason || "AI generation",
      projectId: projectId || null,
      fileName: fileName || null,
      timestamp: new Date(),
    }

    await db.collection("users").updateOne(
      { id: session.user.id },
      {
        $inc: { credits: amount },
        $push: {
          creditHistory: {
            $each: [historyEntry],
            $slice: -200,
          },
        } as any,
      }
    )

    const updatedUser = await db.collection("users").findOne(
      { id: session.user.id },
      { projection: { credits: 1 } }
    )

    return NextResponse.json({
      success: true,
      credits: parseFloat((updatedUser?.credits ?? 0).toFixed(2)),
    })
  } catch (error: any) {
    console.error("[Credits] POST error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
