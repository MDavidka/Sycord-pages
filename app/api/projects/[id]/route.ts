import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  try {
    const user = await db.collection("users").findOne(
        { id: session.user.id },
        { projection: { projects: 1 } }
    )

    if (!user || !user.projects) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const project = user.projects.find((p: any) => p._id?.toString() === id || p._id === id)

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // ETag-style short cache so the same project edit screen does not
    // re-download its payload on every tab focus / nav back. The dashboard
    // explicitly invalidates by adding a fresh fetch on mutation.
    const lastModified =
      project.updatedAt || project.createdAt || Date.now().toString()
    const etag = `W/"${id}-${typeof lastModified === "string"
      ? lastModified
      : new Date(lastModified).getTime()
    }"`

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag },
      })
    }

    return NextResponse.json(project, {
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
      },
    })
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json({ message: "Error fetching project" }, { status: 500 })
  }
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

  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  // Construct update object for specific fields in the array element
  // keys in body need to be mapped to "projects.$.key"
  const updateFields: any = {};
  for (const key in body) {
      if (key !== '_id' && key !== 'userId') {
          updateFields[`projects.$.${key}`] = body[key];
      }
  }
  updateFields[`projects.$.updatedAt`] = new Date();

  const result = await db.collection("users").updateOne(
    {
        id: session.user.id,
        "projects._id": id
    },
    { $set: updateFields }
  )

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

  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  try {
    // Remove the project from the projects array
    const result = await db.collection("users").updateOne(
        { id: session.user.id },
        {
            $pull: {
                projects: { _id: id }
            } as any
        }
    )

    if (result.modifiedCount === 0) {
       // Could mean project didn't exist or user didn't own it
       // Check if user exists
       const user = await db.collection("users").findOne({ id: session.user.id });
       if (!user) {
         return NextResponse.json({ message: "User not found" }, { status: 404 })
       }
       // If user exists but modifiedCount is 0, then project wasn't found in array
       return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    console.log("[v0] Project deleted:", { projectId: id, userId: session.user.id })

    return NextResponse.json({ success: true, message: "Project deleted successfully" })
  } catch (error) {
    console.error("[v0] Error deleting project:", error)
    return NextResponse.json({ message: "Error deleting project" }, { status: 500 })
  }
}
