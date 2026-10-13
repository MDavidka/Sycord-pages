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
  const { firebaseUid, firebaseEmail, firebaseDisplayName } = body

  if (!firebaseUid || !firebaseEmail) {
    return NextResponse.json({ message: "Missing Firebase user details" }, { status: 400 })
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
        "projects.$.firebaseConnected": true,
        "projects.$.firebaseUid": firebaseUid,
        "projects.$.firebaseEmail": firebaseEmail,
        "projects.$.firebaseDisplayName": firebaseDisplayName || null,
        "projects.$.firebaseConnectedAt": new Date(),
        "projects.$.updatedAt": new Date(),
      },
    }
  )

  if (result.matchedCount === 0) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true, firebaseConnected: true })
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
    firebaseConnected: project.firebaseConnected ?? false,
    firebaseEmail: project.firebaseEmail ?? null,
    firebaseDisplayName: project.firebaseDisplayName ?? null,
  })
}
