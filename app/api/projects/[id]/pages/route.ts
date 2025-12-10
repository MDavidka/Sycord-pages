import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const client = await clientPromise
    const db = client.db()

    const pages = await db.collection("pages")
      .find({ projectId: new ObjectId(id) })
      .toArray()

    return NextResponse.json(pages)
  } catch (error: any) {
    console.error("[v0] Pages GET error:", error)
    return NextResponse.json({ message: error.message || "Failed to fetch pages" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { name, content } = await request.json()

    if (!name || !content) {
      return NextResponse.json({ message: "Name and content are required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Validate Project Ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      userId: session.user.id
    })

    if (!project) {
        return NextResponse.json({ message: "Project not found or unauthorized" }, { status: 404 })
    }

    const result = await db.collection("pages").updateOne(
      { projectId: new ObjectId(id), name: name },
      {
        $set: {
          projectId: new ObjectId(id),
          name: name,
          content: content,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )

    return NextResponse.json({
      success: true,
      message: "Page saved",
      id: result.upsertedId || "updated"
    })
  } catch (error: any) {
    console.error("[v0] Pages POST error:", error)
    return NextResponse.json({ message: error.message || "Failed to save page" }, { status: 500 })
  }
}
