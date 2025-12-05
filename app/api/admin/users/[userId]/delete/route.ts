import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function DELETE(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await requireAdmin()

    const { userId } = await params

    const client = await clientPromise
    const db = client.db()

    // Delete all projects and deployments for this user
    const userProjects = await db.collection("projects").find({ userId }).toArray()

    for (const project of userProjects) {
      if (project.deploymentId) {
        await db.collection("deployments").deleteOne({ _id: new ObjectId(project.deploymentId) })
      }
    }

    await db.collection("projects").deleteMany({ userId })

    await db.collection("users").deleteOne({ id: userId })

    return NextResponse.json({
      success: true,
      message: `User and all associated data deleted`,
    })
  } catch (error) {
    console.error("[v0] Delete user error:", error)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
