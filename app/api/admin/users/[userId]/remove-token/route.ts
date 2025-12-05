import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/mongodb"

export async function POST(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()

    const { userId } = await params

    const client = await clientPromise
    const db = client.db()

    // Remove the Vercel token
    await db
      .collection("users")
      .updateOne({ id: userId }, { $set: { vercelAccessToken: null, vercelRefreshToken: null } })

    return NextResponse.json({
      success: true,
      message: "Vercel token removed successfully",
    })
  } catch (error) {
    console.error("[v0] Remove token error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
