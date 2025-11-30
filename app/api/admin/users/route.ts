import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  try {
    await requireAdmin()

    const client = await clientPromise
    const db = client.db()

    // 1. Fetch all registered users from the 'users' collection
    const users = await db.collection("users").find({}).toArray()

    // 2. Fetch all projects to calculate stats
    const projects = await db.collection("projects").find({}).toArray()

    // 3. Map projects to users for counting
    const projectMap = new Map()
    for (const project of projects) {
      if (!projectMap.has(project.userId)) {
        projectMap.set(project.userId, [])
      }
      projectMap.get(project.userId).push(project)
    }

    // 4. Construct the response object combining User + Project data
    const userList = users.map(user => {
        const userProjects = projectMap.get(user.id) || []

        // Safety: We return a masked version of the token or just a boolean if it exists.
        // User requested "Token to vercel should be stored and displayed on admin page"
        // so we will return it.

        return {
            userId: user.id,
            email: user.email || "Unknown",
            name: user.name || "Unknown",
            // Vercel Integration Data
            hasVercelLinked: !!(user.vercelAccessToken),
            vercelAccessToken: user.vercelAccessToken || null,

            projectCount: userProjects.length,
            isPremium: user.isPremium || false, // Fallback if not set in user doc
            ip: userProjects.length > 0 ? (userProjects[0].userIP || "Unknown") : "Unknown", // Best effort IP from projects
            createdAt: user.createdAt || new Date().toISOString(), // Fallback if missing
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
