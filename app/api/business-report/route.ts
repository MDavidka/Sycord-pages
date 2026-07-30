import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { isAdmin } from "@/lib/is-admin"

const COLLECTION = "business_reports"
const DOC_FILTER = { docType: "business-activity-report" } as const

/** GET /api/business-report — public read of the published report fields. */
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db()
    const doc = await db
      .collection(COLLECTION)
      .findOne(DOC_FILTER, { projection: { _id: 0, fields: 1 } })
    return NextResponse.json({ fields: doc?.fields ?? null })
  } catch (err) {
    console.error("[business-report GET]", err)
    return NextResponse.json({ fields: null }, { status: 500 })
  }
}

/** POST /api/business-report — admin-only write of the shared report document. */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const body = await request.json()
    if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
      return NextResponse.json({ error: "Invalid body: 'fields' must be an object" }, { status: 400 })
    }

    const fields: Record<string, string> = {}
    let keys = 0
    for (const [k, v] of Object.entries(body.fields)) {
      if (typeof v !== "string") continue
      keys += 1
      if (keys > 200) {
        return NextResponse.json({ error: "Too many fields (max 200)" }, { status: 400 })
      }
      if (k.length > 120) {
        return NextResponse.json({ error: "Field key too long" }, { status: 400 })
      }
      fields[k] = v.slice(0, 4000)
    }

    const client = await clientPromise
    const db = client.db()
    await db.collection(COLLECTION).updateOne(
      DOC_FILTER,
      { $set: { fields, updatedAt: new Date(), updatedBy: session.user.id }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[business-report POST]", err)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
