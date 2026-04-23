import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const COLLECTION = "business_reports"
const DOC_FILTER = { docType: "business-activity-report" } as const

/** GET /api/business-report
 *  Returns the saved field map for the Business Activity Report document.
 */
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

/** POST /api/business-report
 *  Body: { fields: Record<string, string> }
 *  Upserts the field map so every in-browser edit is persisted.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (!body.fields || typeof body.fields !== "object" || Array.isArray(body.fields)) {
      return NextResponse.json({ error: "Invalid body: 'fields' must be an object" }, { status: 400 })
    }

    // Sanitise: only accept string values, discard anything else
    const fields: Record<string, string> = {}
    for (const [k, v] of Object.entries(body.fields)) {
      if (typeof v === "string") {
        fields[k] = v.slice(0, 4000) // cap individual field length
      }
    }

    const client = await clientPromise
    const db = client.db()
    await db.collection(COLLECTION).updateOne(
      DOC_FILTER,
      { $set: { fields, updatedAt: new Date() }, $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[business-report POST]", err)
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
