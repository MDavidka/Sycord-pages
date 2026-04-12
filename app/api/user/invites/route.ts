import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id || !session.user.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  try {
    // Find projects where this user's email is in the collaborators array
    const query = {
      "projects.collaborators": {
        $elemMatch: { email: session.user.email, status: "pending" }
      }
    };
    const usersWithProjects = await db.collection("users").find(query).toArray()
    console.log(`[API /api/user/invites] Searching for invites for email: ${session.user.email}. Found users: ${usersWithProjects.length}`);

    let invites: any[] = []

    usersWithProjects.forEach(user => {
      user.projects?.forEach((project: any) => {
        const collaborator = project.collaborators?.find((c: any) => c.email === session.user?.email)
        if (collaborator && collaborator.status === "pending") {
          invites.push({
            projectId: project._id.toString(),
            businessName: project.businessName,
            ownerName: user.name || user.email,
            ownerId: user.id,
            status: collaborator.status,
            invitedAt: collaborator.invitedAt
          })
        }
      })
    })

    console.log(`[API /api/user/invites] Compiled ${invites.length} pending invites`);

    return NextResponse.json(invites)
  } catch (error) {
    console.error("Error fetching invites:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id || !session.user.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  try {
    const { projectId, action } = await request.json()

    if (!projectId || !action) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    if (action === "accept") {
      // Find the user who owns the project and update the collaborator status
      await db.collection("users").updateOne(
        {
          "projects._id": new ObjectId(projectId)
        },
        {
          $set: {
            "projects.$[proj].collaborators.$[coll].status": "accepted"
          } as any
        },
        {
          arrayFilters: [
            { "proj._id": new ObjectId(projectId) },
            { "coll.email": session.user.email }
          ]
        }
      )
      return NextResponse.json({ message: "Invite accepted" })

    } else if (action === "deny") {
      await db.collection("users").updateOne(
        { "projects._id": new ObjectId(projectId) },
        {
          $pull: {
            "projects.$.collaborators": { email: session.user.email }
          } as any
        }
      )
      return NextResponse.json({ message: "Invite denied" })
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("Error responding to invite:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
