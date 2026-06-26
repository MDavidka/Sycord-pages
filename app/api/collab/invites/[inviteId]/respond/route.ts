import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"


export async function POST(
  request: Request,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  const { inviteId } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (!inviteId || !inviteId.trim()) {
    return NextResponse.json({ message: "Invalid invite ID" }, { status: 400 })
  }

  let body: { action?: "accept" | "ignore" }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const { action } = body
  if (action !== "accept" && action !== "ignore") {
    return NextResponse.json({ message: "action must be 'accept' or 'ignore'" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()

  // Find the invite and verify it belongs to this user
  const invite = await db.collection("collaborationInvites").findOne({
    _id: inviteId,
    inviteeEmail: session.user.email.toLowerCase(),
    status: "pending",
  })

  if (!invite) {
    return NextResponse.json({ message: "Invite not found or already responded" }, { status: 404 })
  }

  if (action === "ignore") {
    await db.collection("collaborationInvites").updateOne(
      { _id: inviteId },
      { $set: { status: "ignored", respondedAt: new Date() } }
    )
    return NextResponse.json({ message: "Invite ignored" })
  }

  // Accept: copy the project to the invitee's projects array
  const inviterDoc = await db.collection("users").findOne(
    { id: invite.inviterUserId },
    { projection: { projects: 1 } }
  )

  if (!inviterDoc) {
    return NextResponse.json({ message: "Inviter not found" }, { status: 404 })
  }

  const project = inviterDoc.projects?.find(
    (p: any) => p._id.toString() === invite.projectId
  )

  if (!project) {
    return NextResponse.json({ message: "Project no longer exists" }, { status: 404 })
  }

  // Check if already a collaborator on this project
  const inviteeDoc = await db.collection("users").findOne(
    { id: session.user.id },
    { projection: { projects: 1 } }
  )

  const alreadyCollaborating = inviteeDoc?.projects?.some(
    (p: any) =>
      p.isCollaborator === true &&
      p.originalProjectId === invite.projectId
  )

  if (alreadyCollaborating) {
    // Already added, just mark invite accepted
    await db.collection("collaborationInvites").updateOne(
      { _id: inviteId },
      { $set: { status: "accepted", respondedAt: new Date() } }
    )
    return NextResponse.json({ message: "Already a collaborator" })
  }

  // Create a shared copy of the project for the invitee
  const sharedProject = {
    ...project,
    _id: crypto.randomUUID(), // new unique id in invitee's array
    isCollaborator: true,
    originalProjectId: invite.projectId,
    originalOwnerUserId: invite.inviterUserId,
    originalOwnerName: invite.inviterName,
    collaboratorSince: new Date(),
  }

  await db.collection("users").updateOne(
    { id: session.user.id },
    { $push: { projects: sharedProject } as any }
  )

  await db.collection("collaborationInvites").updateOne(
    { _id: inviteId },
    { $set: { status: "accepted", respondedAt: new Date() } }
  )

  return NextResponse.json({ message: "Invite accepted", projectId: sharedProject._id.toString() })
}
