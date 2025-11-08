import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const project = await db.collection("projects").findOne({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  return NextResponse.json(project)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()
  const body = await request.json()

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const result = await db
    .collection("projects")
    .updateOne({ _id: new ObjectId(id), userId: session.user.id }, { $set: { ...body, updatedAt: new Date() } })

  if (result.matchedCount === 0) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  try {
    // Get the project to verify ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      userId: session.user.id,
    })

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Delete all deployments associated with this project
    await db.collection("deployments").deleteMany({
      projectId: id,
    })

    // Delete the project itself
    const result = await db.collection("projects").deleteOne({
      _id: new ObjectId(id),
      userId: session.user.id,
    })

    console.log("[v0] Project deleted:", { projectId: id, userId: session.user.id })

    return NextResponse.json({ success: true, message: "Project deleted successfully" })
  } catch (error) {
    console.error("[v0] Error deleting project:", error)
    return NextResponse.json({ message: "Error deleting project" }, { status: 500 })
  }
}
