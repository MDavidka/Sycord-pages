import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ isBlocked: false, subscription: "Free", isPremium: false })
    }

    const client = await clientPromise
    const db = client.db()

    const user = await db.collection("users").findOne({ id: session.user.id })

    return NextResponse.json({
      isBlocked: user?.isBlocked || false,
      subscription: user?.subscription || "Free",
      isPremium: user?.isPremium || false,
    })
  } catch (error) {
    console.error("[v0] User status error:", error)
    return NextResponse.json({ isBlocked: false, subscription: "Free", isPremium: false })
  }
}
