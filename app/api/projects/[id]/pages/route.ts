import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const { name, content } = await request.json()

    if (!name || !content) {
      return NextResponse.json({ message: "Name and content required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Validate project ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      userId: session.user.id
    })

    if (!project) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Upsert page in the 'pages' collection
    // We normalize the name to remove extension for the DB query if desired,
    // but Cloudflare deploy script expects names that map to routes.
    // The previous analysis showed Cloudflare deploy script does:
    // routes[`/${page.name}`] = content;

    await db.collection("pages").updateOne(
        { projectId: new ObjectId(id), name: name },
        {
            $set: {
                projectId: new ObjectId(id),
                name: name,
                content: content,
                updatedAt: new Date()
            },
            $setOnInsert: { createdAt: new Date() }
        },
        { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error saving page:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
