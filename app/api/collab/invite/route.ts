import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"


export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: { projectId?: string; inviteeEmail?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const { projectId, inviteeEmail } = body

  if (!projectId || !inviteeEmail) {
    return NextResponse.json({ message: "projectId and inviteeEmail are required" }, { status: 400 })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(inviteeEmail)) {
    return NextResponse.json({ message: "Invalid email address" }, { status: 400 })
  }

  if (inviteeEmail.toLowerCase() === session.user.email?.toLowerCase()) {
    return NextResponse.json({ message: "You cannot invite yourself" }, { status: 400 })
  }

  if (!projectId || !projectId.trim()) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()

  // Verify the inviter owns this project
  const inviterDoc = await db.collection("users").findOne(
    { id: session.user.id },
    { projection: { projects: 1, name: 1 } }
  )

  if (!inviterDoc) {
    return NextResponse.json({ message: "User not found" }, { status: 404 })
  }

  const project = inviterDoc.projects?.find((p: any) => p._id.toString() === projectId)
  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  // Don't allow collaborators to invite others
  if (project.isCollaborator) {
    return NextResponse.json({ message: "Collaborators cannot invite others" }, { status: 403 })
  }

  // Check for existing pending invite
  const existing = await db.collection("collaborationInvites").findOne({
    projectId,
    inviteeEmail: inviteeEmail.toLowerCase(),
    status: "pending",
  })

  if (existing) {
    return NextResponse.json({ message: "An invite is already pending for this email" }, { status: 409 })
  }

  const invite = {
    _id: crypto.randomUUID(),
    projectId,
    projectName: project.businessName || "Unnamed project",
    inviterUserId: session.user.id,
    inviterName: session.user.name || session.user.email || "Someone",
    inviteeEmail: inviteeEmail.toLowerCase(),
    status: "pending",
    createdAt: new Date(),
  }

  await db.collection("collaborationInvites").insertOne(invite)

  return NextResponse.json({ message: "Invite sent", inviteId: invite._id.toString() }, { status: 201 })
}
