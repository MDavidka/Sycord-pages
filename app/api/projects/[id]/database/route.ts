import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject, ownedProjectMutationFilter } from "@/lib/project-id"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (!id) {
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
  const project = await getOwnedProject(db, session.user.id, id)
  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const result = await db.collection("users").updateOne(
    ownedProjectMutationFilter(session.user.id, project),
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

  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()

  const project = await getOwnedProject(db, session.user.id, id)

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
