import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { name, content } = await request.json()

    if (!name || !content) {
      return NextResponse.json({ message: "Missing name or content" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Verify project ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      userId: session.user.id
    })

    if (!project) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Upsert page
    await db.collection("pages").updateOne(
      { projectId: new ObjectId(id), name },
      { $set: { content, updatedAt: new Date() } },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error saving page:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const client = await clientPromise
    const db = client.db()

    // Verify project ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      userId: session.user.id
    })

    if (!project) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const pages = await db.collection("pages").find({ projectId: new ObjectId(id) }).toArray()

    return NextResponse.json(pages)
  } catch (error: any) {
    console.error("Error fetching pages:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
