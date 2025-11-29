import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { deployToVercel } from "@/lib/vercel"
import { ObjectId } from "mongodb"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  // 1. Fetch Project
  let projectId;
  try {
      projectId = new ObjectId(id)
  } catch (e) {
      return NextResponse.json({ message: "Invalid ID" }, { status: 400 })
  }

  const project = await db.collection("projects").findOne({
      _id: projectId,
      userId: session.user.id
  })

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  // 2. Fetch User Vercel Token
  const user = await db.collection("users").findOne({ _id: session.user.id })

  if (!user || !user.vercelToken) {
     return NextResponse.json({
         message: "Vercel authorization required",
         requireAuth: true
     }, { status: 403 })
  }

  const token = user.vercelToken

  try {
    // 3. Create Project & Deploy using shared logic
    const deployData = await deployToVercel(token, project, db)

    return NextResponse.json({
        success: true,
        url: deployData.url,
        dashboardUrl: deployData.inspectorUrl
    })

  } catch (error: any) {
      console.error("Deployment process failed:", error)
      return NextResponse.json({ message: error.message || "Deployment failed" }, { status: 500 })
  }
}
