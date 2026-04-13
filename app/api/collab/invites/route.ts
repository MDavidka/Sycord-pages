import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id || !session.user.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  const invites = await db
    .collection("collaborationInvites")
    .find({ inviteeEmail: session.user.email.toLowerCase(), status: "pending" })
    .sort({ createdAt: -1 })
    .toArray()

  return NextResponse.json(invites)
}
