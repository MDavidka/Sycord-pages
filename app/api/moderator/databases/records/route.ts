import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import clientPromise, { isTorsoConfigured } from "@/lib/torso"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    await requireModerator()

    if (!isTorsoConfigured()) {
      return NextResponse.json({
        ok: false,
        configured: false,
        error: "Database configuration (TURSO_DATABASE_URL) is not set in this environment.",
        records: [],
        total: 0,
      }, { status: 503 })
    }

    const { searchParams } = new URL(request.url)
    const collectionName = (searchParams.get("collection") || "users").toLowerCase().trim()
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)))
    const skip = (page - 1) * limit
    const search = (searchParams.get("search") || "").toLowerCase().trim()

    // Restrict to approved collections for security
    const ALLOWED_COLLECTIONS = ["users", "projects", "moderation_reports", "models_config"]
    if (!ALLOWED_COLLECTIONS.includes(collectionName)) {
      return NextResponse.json({ ok: false, error: "Invalid collection requested" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    const rawDocs = await db.collection(collectionName).find({}).toArray()

    let filtered = rawDocs
    if (search) {
      filtered = rawDocs.filter((doc: any) => {
        const text = JSON.stringify(doc).toLowerCase()
        return text.includes(search)
      })
    }

    const total = filtered.length
    const pageDocs = filtered.slice(skip, skip + limit)

    // Security: Sanitize output and strictly strip any credentials, secrets, or internal auth tokens
    const sanitized = pageDocs.map((doc: any) => {
      const copy = { ...doc }
      delete copy.password
      delete copy.hashedPassword
      delete copy.token
      delete copy.secret
      delete copy.accessToken
      delete copy.refreshToken
      delete copy.apiKey
      delete copy._token
      return copy
    })

    return NextResponse.json({
      ok: true,
      configured: true,
      collection: collectionName,
      records: sanitized,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  } catch (error: any) {
    console.error("[database/records] Error fetching records:", error)
    return NextResponse.json({ ok: false, error: error?.message || "Failed to inspect database records" }, { status: 500 })
  }
}
