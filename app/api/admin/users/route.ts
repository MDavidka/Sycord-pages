import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    await requireAdmin()

    const client = await clientPromise
    const db = client.db()

    // 1. Get all users from the 'users' collection (The source of truth for Vercel status)
    const usersCollection = await db.collection("users").find({}).toArray()

    // 2. Get all projects to count projects per user
    const projects = await db.collection("projects").find({}).toArray()

    // 3. Create a map of User ID to User Data
    const userMap = new Map()

    // Initialize with data from 'users' collection
    for (const userDoc of usersCollection) {
        userMap.set(userDoc._id, {
            userId: userDoc._id,
            email: userDoc.email || "Unknown",
            name: userDoc.name || "Unknown",
            projectCount: 0,
            isPremium: userDoc.isPremium || false,
            ip: userDoc.ip || "Unknown",
            createdAt: userDoc.createdAt,
            vercelConnected: !!userDoc.vercelConnected || !!userDoc.vercelAccessToken,
            websites: []
        })
    }

    // Process projects to add stats and catch users only present in 'projects' (legacy/migrated)
    for (const project of projects) {
      if (!userMap.has(project.userId)) {
        // Fallback for users not yet in 'users' collection
        userMap.set(project.userId, {
          userId: project.userId,
          email: project.userEmail || "Unknown",
          name: project.userName || "Unknown",
          projectCount: 0,
          isPremium: false,
          ip: project.userIP || "Unknown",
          createdAt: project.createdAt,
          vercelConnected: false, // Assume false if not in users collection
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
