import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
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
      //
      // Race-safe: we first upsert the user record with `$setOnInsert` so an
      // initial seed is written atomically iff a brand-new document is
      // created. If another concurrent request already created the record,
      // that seed is discarded. A subsequent conditional `$set` handles the
      // case where the record already existed but was missing the field
      // (e.g. legacy users created before this feature). Finally we re-read
      // to return whatever is actually persisted.
      const seed = seedBalance(!!user?.isPremium)
      await users.updateOne(
        { id: session.user.id },
        { $setOnInsert: { id: session.user.id, credits: seed } },
        { upsert: true },
      )
      await users.updateOne(
        { id: session.user.id, credits: { $exists: false } },
        { $set: { credits: seed } },
      )
      const after = await users.findOne(
        { id: session.user.id },
        { projection: { credits: 1 } },
      )
      credits = typeof after?.credits === "number" ? after.credits : seed
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
