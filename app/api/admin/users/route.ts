import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/torso"

export async function GET() {
  try {
    await requireAdmin()

    const client = await clientPromise
    const db = client.db()

    // 1. Fetch all registered users from the 'users' collection
    const users = await db.collection("users").find({}).toArray()

    // 4. Construct the response object combining User + Project data (embedded)
    const userList = users.map(user => {
        const userProjects = user.projects || []

        return {
            userId: user.id,
            email: user.email || "Unknown",
            name: user.name || "Unknown",
            projectCount: userProjects.length,
            isPremium: user.isPremium || false,
            isBlocked: user.isBlocked || false,
            subscription: user.subscription || "Free",
            // Assuming first project might have IP or user doc has IP (which it does in auth.ts)
            ip: user.user?.ip || "Unknown",
            createdAt: user.createdAt || new Date().toISOString(),
            websites: userProjects.map((p: any) => ({
                id: p._id,
                businessName: p.businessName,
                subdomain: p.subdomain
            }))
        }
    })

    return NextResponse.json(userList)
  } catch (error) {
    console.error("[v0] Admin users GET error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
