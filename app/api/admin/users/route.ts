import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise, { getSqlClient, ensureCollectionTable, tableNameForCollection } from "@/lib/torso"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const search = (searchParams.get("search") || "").toLowerCase().trim()
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
    const skip = Math.max(0, parseInt(searchParams.get("skip") || "0", 10))

    let rawUsers: any[] = []
    let totalCount = 0

    try {
      await ensureCollectionTable("users")
      const client = getSqlClient()
      const tableName = tableNameForCollection("users")

      if (search) {
        const pattern = `%${search}%`
        const countRes = await client.execute({
          sql: `SELECT COUNT(*) as cnt FROM "${tableName}" 
                WHERE LOWER(json_extract(doc, '$.email')) LIKE ?
                   OR LOWER(json_extract(doc, '$.name')) LIKE ?
                   OR LOWER(json_extract(doc, '$.id')) LIKE ?
                   OR LOWER(json_extract(doc, '$.user.ip')) LIKE ?`,
          args: [pattern, pattern, pattern, pattern],
        })
        totalCount = Number(countRes.rows[0]?.cnt || 0)

        const rowsRes = await client.execute({
          sql: `SELECT _tid, doc FROM "${tableName}"
                WHERE LOWER(json_extract(doc, '$.email')) LIKE ?
                   OR LOWER(json_extract(doc, '$.name')) LIKE ?
                   OR LOWER(json_extract(doc, '$.id')) LIKE ?
                   OR LOWER(json_extract(doc, '$.user.ip')) LIKE ?
                ORDER BY updated_at DESC, created_at DESC
                LIMIT ? OFFSET ?`,
          args: [pattern, pattern, pattern, pattern, limit, skip],
        })
        rawUsers = rowsRes.rows
          .map((r) => {
            try {
              return JSON.parse(String(r.doc || "{}"))
            } catch {
              return null
            }
          })
          .filter(Boolean)
      } else {
        const countRes = await client.execute({
          sql: `SELECT COUNT(*) as cnt FROM "${tableName}"`,
          args: [],
        })
        totalCount = Number(countRes.rows[0]?.cnt || 0)

        const rowsRes = await client.execute({
          sql: `SELECT _tid, doc FROM "${tableName}"
                ORDER BY updated_at DESC, created_at DESC
                LIMIT ? OFFSET ?`,
          args: [limit, skip],
        })
        rawUsers = rowsRes.rows
          .map((r) => {
            try {
              return JSON.parse(String(r.doc || "{}"))
            } catch {
              return null
            }
          })
          .filter(Boolean)
      }
    } catch (sqlErr) {
      console.warn("[torso] Falling back to collection find for users:", sqlErr)
      const client = await clientPromise
      const db = client.db()
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
      totalCount = filtered.length
      rawUsers = filtered.slice(skip, skip + limit)
    }

    // Construct response combining user, credits, model usage, and project info
    const userList = rawUsers.map((user: any) => {
      const userProjects = user.projects || []
      const credits = typeof user.credits === "number" ? user.credits : (user.isPremium ? 200 : 10)
      const email = user.email || user.user?.email || "Unknown"
      const name = user.name || user.user?.name || (email !== "Unknown" ? email.split("@")[0] : "User")
      const ip = user.ip || user.user?.ip || "Unknown"
      const createdAt = user.createdAt || user.created_at || user.user?.join_date || new Date().toISOString()

      return {
        userId: user.id || user.userId || user._tid || user._id,
        email,
        name,
        image: user.image || user.picture || user.user?.image || null,
        projectCount: Array.isArray(userProjects) ? userProjects.length : 0,
        isPremium: Boolean(user.isPremium || user.subscription === "pro" || user.subscription === "premium"),
        isBlocked: Boolean(user.isBlocked),
        blockReason: user.blockReason || null,
        subscription: user.subscription || (user.isPremium ? "Premium" : "Free"),
        credits,
        totalTokensUsed: user.totalTokensUsed || 0,
        ip,
        createdAt,
        websites: Array.isArray(userProjects)
          ? userProjects.map((p: any) => ({
              id: p._id || p.id,
              businessName: p.businessName || p.name || "Project",
              subdomain: p.subdomain || "",
            }))
          : [],
        warnings: Array.isArray(user.warnings) ? user.warnings : [],
      }
    })

    return NextResponse.json({
      ok: true,
      users: userList,
      total: totalCount,
    })
  } catch (error) {
    console.error("[v0] Admin users GET error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
