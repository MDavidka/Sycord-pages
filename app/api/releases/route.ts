import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/torso"

const RELEASE_ADMIN_EMAIL = "dmarton336@gmail.com"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email?.toLowerCase()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!(await isAdmin()) && email !== RELEASE_ADMIN_EMAIL) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await request.json()
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 140) : ""
    const version = typeof body.version === "string" ? body.version.trim().slice(0, 30) : ""
    const summary = typeof body.summary === "string" ? body.summary.trim().slice(0, 2000) : ""
    const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim().slice(0, 500) : ""
    if (!title || !version || !summary || !imageUrl || (!imageUrl.startsWith("/") && !/^https:\/\//i.test(imageUrl))) return NextResponse.json({ error: "Title, version, summary, and a safe image URL are required" }, { status: 400 })

    const client = await clientPromise
    await client.db().collection("version_updates").insertOne({ title, version, summary, imageUrl, published: true, createdAt: new Date(), createdBy: session.user.id })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[releases POST]", error)
    return NextResponse.json({ error: "Failed to publish version update" }, { status: 500 })
  }
}
