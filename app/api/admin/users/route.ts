import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    await requireAdmin()

    const client = await clientPromise
    const db = client.db()

    // Get all users from projects collection (unique users)
    const projects = await db.collection("projects").find({}).toArray()

    // Extract unique users with their stats
    const userMap = new Map()

    for (const project of projects) {
      if (!userMap.has(project.userId)) {
        userMap.set(project.userId, {
          userId: project.userId,
          email: project.userEmail || "Unknown",
          name: project.userName || "Unknown",
          projectCount: 0,
          isPremium: false,
          ip: project.userIP || "Unknown",
          createdAt: project.createdAt,
          websites: [],
        })
      }

      const user = userMap.get(project.userId)
      user.projectCount += 1
      user.websites.push({
        id: project._id,
        businessName: project.businessName,
        subdomain: project.subdomain,
      })
    }

    return NextResponse.json(Array.from(userMap.values()))
  } catch (error) {
    console.error("[v0] Admin users GET error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
