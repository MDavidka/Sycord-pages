import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * AI Messages API
 * GET  — fetch saved messages for a project
 * POST — save messages for a project (latest 50)
 */

const MAX_MESSAGES = 50

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ message: "Missing projectId" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne(
      { id: session.user.id, "projects._id": new ObjectId(projectId) },
      { projection: { "projects.$": 1 } }
    )

    const project = user?.projects?.[0]
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({
      messages: project.aiMessages || [],
    })
  } catch (error: any) {
    console.error("[AI Messages] GET error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { projectId, messages } = await request.json()

    if (!projectId || !Array.isArray(messages)) {
      return NextResponse.json({ message: "Missing projectId or messages" }, { status: 400 })
    }

    // Keep only the latest MAX_MESSAGES
    const trimmedMessages = messages.slice(-MAX_MESSAGES).map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content?.substring(0, 5000) || "", // limit content size
      pageName: m.pageName || undefined,
      timestamp: m.timestamp || new Date().toISOString(),
    }))

    const client = await clientPromise
    const db = client.db()

    await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": new ObjectId(projectId) },
      { $set: { "projects.$.aiMessages": trimmedMessages } }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[AI Messages] POST error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
