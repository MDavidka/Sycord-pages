import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("search") || "").toLowerCase().trim()
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
    const skip = Math.max(0, parseInt(searchParams.get("skip") || "0", 10))

    const client = await clientPromise
    const db = client.db()

    // 1. Fetch all registered users from the 'users' collection
    const allUsers = await db.collection("users").find({}).toArray()

    let filtered = allUsers
    if (search) {
      filtered = allUsers.filter((u: any) => {
        const email = String(u.email || "").toLowerCase()
        const name = String(u.name || "").toLowerCase()
        const id = String(u.id || "").toLowerCase()
        const ip = String(u.user?.ip || "").toLowerCase()
        return email.includes(search) || name.includes(search) || id.includes(search) || ip.includes(search)
      })
    }

    const paginated = filtered.slice(skip, skip + limit)

    // Construct response combining user, credits, model usage, and project info
    const userList = paginated.map((user: any) => {
      const userProjects = user.projects || []
      const credits = typeof user.credits === "number" ? user.credits : (user.isPremium ? 200 : 10)

      return {
        userId: user.id,
        email: user.email || "Unknown",
        name: user.name || "Unknown",
        projectCount: userProjects.length,
        isPremium: user.isPremium || false,
        isBlocked: user.isBlocked || false,
        blockReason: user.blockReason || null,
        subscription: user.subscription || (user.isPremium ? "Premium" : "Free"),
        credits,
        totalTokensUsed: user.totalTokensUsed || 0,
        ip: user.user?.ip || "Unknown",
        createdAt: user.createdAt || user.user?.join_date || new Date().toISOString(),
        websites: userProjects.map((p: any) => ({
          id: p._id || p.id,
          businessName: p.businessName || p.name || "Project",
          subdomain: p.subdomain || "",
        })),
        warnings: user.warnings || [],
      }
    })

    return NextResponse.json({
      ok: true,
      users: userList,
      total: filtered.length,
    })
  } catch (error) {
    console.error("[v0] Admin users GET error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
