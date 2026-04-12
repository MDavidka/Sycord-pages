import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  try {
    const { email, action } = await request.json()

    if (!email) {
      return NextResponse.json({ message: "Email is required" }, { status: 400 })
    }

    // Find the project owner to ensure the user is allowed to invite
    const userDoc = await db.collection("users").findOne({
      id: session.user.id,
      "projects._id": new ObjectId(params.id)
    })

    if (!userDoc) {
      return NextResponse.json({ message: "Project not found or unauthorized" }, { status: 404 })
    }

    if (action === "invite") {
      // Prevent duplicates
      const project = userDoc.projects.find((p: any) => p._id.toString() === params.id)
      if (project?.collaborators?.some((c: any) => c.email === email)) {
        return NextResponse.json({ message: "User already invited" }, { status: 400 })
      }

      // Add email to the collaborators array (status: pending)
      await db.collection("users").updateOne(
        { "projects._id": new ObjectId(params.id) },
        {
          $push: {
            "projects.$.collaborators": {
              email,
              status: "pending",
              invitedAt: new Date()
            }
          } as any
        }
      )
      return NextResponse.json({ message: "Invite sent successfully" })

    } else if (action === "revoke") {
      // Remove email from collaborators array
      await db.collection("users").updateOne(
        { "projects._id": new ObjectId(params.id) },
        {
          $pull: {
            "projects.$.collaborators": { email }
          } as any
        }
      )
      return NextResponse.json({ message: "Access revoked successfully" })
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 })

  } catch (error) {
    console.error("Error managing access:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
