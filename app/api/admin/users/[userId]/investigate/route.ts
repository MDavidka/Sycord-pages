import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/mongodb"

export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()

    const { userId } = await params

    const client = await clientPromise
    const db = client.db()

    // Get the target user's IP
    const user = await db.collection("users").findOne({ id: userId })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    // Get the user's IP from their projects
    const userProject = await db.collection("projects").findOne({ userId })
    const userIP = userProject?.userIP || "Unknown"

    // Find all users with the same IP
    const projectsWithSameIP = await db.collection("projects").find({ userIP }).toArray()
    const userIdsWithSameIP = [...new Set(projectsWithSameIP.map((p) => p.userId))]

    // Get details for all users with same IP
    const usersWithSameIP = await db
      .collection("users")
      .find({ id: { $in: userIdsWithSameIP } })
      .toArray()

    return NextResponse.json({
      targetUser: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
      ip: userIP,
      duplicateCount: usersWithSameIP.length,
      duplicateUsers: usersWithSameIP.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.createdAt,
      })),
    })
  } catch (error) {
    console.error("[v0] Investigate user error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
