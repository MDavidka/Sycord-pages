import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const client = await clientPromise
    const db = client.db()

    const user = await db.collection("users").findOne({ id: session.user.id })

    return NextResponse.json({
      creditHistory: user?.creditHistory || []
    })
  } catch (error: any) {
    console.error("[v0] Fetch credit history error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
