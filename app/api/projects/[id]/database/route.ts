import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const body = await request.json()
  const { mongoEndpoint, mongoDataSource, mongoDatabase, mongoApiKey } = body

  if (!mongoEndpoint || !mongoDataSource || !mongoDatabase || !mongoApiKey) {
    return NextResponse.json({ message: "Missing MongoDB Data API connection details" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()

  // Verify ownership before update
  const owner = await db.collection("users").findOne(
    { id: session.user.id, "projects._id": new ObjectId(id) },
    { projection: { _id: 1 } }
  )
  if (!owner) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const result = await db.collection("users").updateOne(
    {
      id: session.user.id,
      "projects._id": new ObjectId(id),
    },
    {
      $set: {
        "projects.$.databaseConnected": true,
        "projects.$.mongoEndpoint": mongoEndpoint,
        "projects.$.mongoDataSource": mongoDataSource,
        "projects.$.mongoDatabase": mongoDatabase,
        "projects.$.mongoApiKey": mongoApiKey,
        "projects.$.databaseConnectedAt": new Date(),
        "projects.$.updatedAt": new Date(),
      },
    }
  )

  if (result.matchedCount === 0) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, databaseConnected: true })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()

  const user = await db.collection("users").findOne(
    { id: session.user.id },
    { projection: { projects: 1 } }
  )

  if (!user?.projects) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const project = user.projects.find((p: any) => p._id.toString() === id)
  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  return NextResponse.json({
    databaseConnected: project.databaseConnected ?? false,
    mongoEndpoint: project.mongoEndpoint ?? null,
    mongoDataSource: project.mongoDataSource ?? null,
    mongoDatabase: project.mongoDatabase ?? null,
    mongoApiKey: project.mongoApiKey ? "hidden" : null, // don't return API key to client
  })
}
