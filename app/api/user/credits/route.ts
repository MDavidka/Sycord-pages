import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import {
  BEST_COST_PER_FILE,
  FAST_COST_PER_FILE,
  seedBalance,
} from "@/lib/credits"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({
        credits: 0,
        bestCost: BEST_COST_PER_FILE,
        fastCost: FAST_COST_PER_FILE,
      })
    }

    const client = await clientPromise
    const db = client.db()
    const users = db.collection("users")

    const user = await users.findOne({ id: session.user.id })

    let credits: number
    if (user && typeof user.credits === "number") {
      credits = user.credits
    } else {
      // Lazy-seed new users (or users missing the field).
      credits = seedBalance(!!user?.isPremium)
      await users.updateOne(
        { id: session.user.id },
        { $set: { credits } },
        { upsert: true },
      )
    }

    return NextResponse.json({
      credits,
      bestCost: BEST_COST_PER_FILE,
      fastCost: FAST_COST_PER_FILE,
      isPremium: !!user?.isPremium,
    })
  } catch (error) {
    console.error("[User/Credits] error:", error)
    return NextResponse.json({
      credits: 0,
      bestCost: BEST_COST_PER_FILE,
      fastCost: FAST_COST_PER_FILE,
      error: "failed_to_load",
    })
  }
}
