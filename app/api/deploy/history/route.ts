import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ message: "Project ID is required" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()

    const user = await db.collection("users").findOne(
      { "projects._id": new ObjectId(projectId) },
      { projection: { "projects.$": 1 } }
    )

    const project = user?.projects?.[0]
    if (!project) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const history = [
        {
            versionId: "latest",
            message: "Latest AI Generation (main branch)",
            date: project.updatedAt || new Date(),
            isCurrent: true
        }
    ]

    return NextResponse.json({ history })
  } catch (error: any) {
    console.error("[Deploy History] Error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
