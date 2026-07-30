import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { isAdminEmail } from "@/lib/is-admin"

export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db()
    const col = db.collection("releases")
    const releases = await col.find().sort({ createdAt: -1 }).toArray()
    return NextResponse.json({ releases })
  } catch {
    return NextResponse.json({ releases: [] }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const { title, version, image, body } = await req.json()
    if (!title || !version) {
      return NextResponse.json({ error: "Title and version required" }, { status: 400 })
    }
    const client = await clientPromise
    const db = client.db()
    const col = db.collection("releases")
    const doc = {
      title,
      version,
      image: image || "",
      body: body || "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await col.insertOne(doc)
    const releases = await col.find().sort({ createdAt: -1 }).toArray()
    return NextResponse.json({ releases }, { status: 201 })
  } catch (e) {
    return NextResponse.json({ error: "Failed to create release" }, { status: 500 })
  }
}
