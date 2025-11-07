import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()
  const { id } = params

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

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = params
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
