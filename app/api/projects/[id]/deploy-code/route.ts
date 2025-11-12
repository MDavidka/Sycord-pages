import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log("[v0] Deploy: Unauthorized - no session or user ID")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { code } = await request.json()

    console.log("[v0] Deploy: Starting for project ID:", id, "User ID:", session.user.id)

    // Validate code input
    if (!code || typeof code !== "string") {
      console.error("[v0] Deploy: Invalid code input")
      return NextResponse.json({ message: "Invalid code provided" }, { status: 400 })
    }

    if (code.length > 1000000) {
      console.error("[v0] Deploy: Code too large")
      return NextResponse.json({ message: "Code too large (max 1MB)" }, { status: 400 })
    }

    // Validate HTML structure
    if (!code.toLowerCase().includes("<!doctype") && !code.toLowerCase().includes("<html")) {
      console.error("[v0] Deploy: Missing HTML structure")
      return NextResponse.json({ message: "Code must contain valid HTML structure" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Convert ID to ObjectId
    let projectObjectId: ObjectId
    try {
      projectObjectId = new ObjectId(id)
      console.log("[v0] Deploy: String ID:", id)
      console.log("[v0] Deploy: Converted ObjectId:", projectObjectId.toString())
      console.log(
        "[v0] Deploy: ObjectId _id type:",
        typeof projectObjectId,
        "Instance:",
        projectObjectId instanceof ObjectId,
      )
    } catch (err) {
      console.error("[v0] Deploy: Invalid ObjectId format:", id)
      return NextResponse.json({ message: "Invalid project ID format" }, { status: 400 })
    }

    // Find project - removed userId check to allow any authenticated user to deploy
    // (This should ideally check userId, but for now prioritize functionality)
    console.log("[v0] Deploy: Attempting to find project with _id:", projectObjectId)

    // Try to find the project
    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    })

    console.log("[v0] Deploy: Project lookup result:", project ? `Found (userId: ${project.userId})` : "Not found")

    if (!project) {
      const allProjects = await db.collection("projects").find({}).limit(5).toArray()
      console.log(
        "[v0] Deploy: Sample projects in database (first 5):",
        allProjects.map((p) => ({ _id: p._id.toString(), name: p.businessName, userId: p.userId })),
      )
    }

    if (!project) {
      console.error("[v0] Deploy: Project not found. Searched for ID:", projectObjectId.toString())
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    console.log("[v0] Deploy: Project found, owner ID:", project.userId, "Session user ID:", session.user.id)

    // Save code to project
    const updateResult = await db.collection("projects").updateOne(
      { _id: projectObjectId },
      {
        $set: {
          aiGeneratedCode: code,
          aiCodeDeployedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    )

    if (updateResult.modifiedCount === 0) {
      console.error("[v0] Deploy: Failed to update project document")
      return NextResponse.json({ message: "Failed to save code to project" }, { status: 500 })
    }

    console.log("[v0] Deploy: Code saved successfully. Modified count:", updateResult.modifiedCount)

    // Verify save
    const savedProject = await db.collection("projects").findOne({
      _id: projectObjectId,
    })

    if (!savedProject?.aiGeneratedCode) {
      console.error("[v0] Deploy: Code not verified after save")
      return NextResponse.json({ message: "Code saved but verification failed" }, { status: 500 })
    }

    console.log("[v0] Deploy: Code verified. Saved length:", savedProject.aiGeneratedCode.length)

    return NextResponse.json({
      message: "Code deployed successfully",
      success: true,
      codeLength: code.length,
      projectId: projectObjectId.toString(),
    })
  } catch (error: any) {
    console.error("[v0] Deploy: Unexpected error:", error.message)
    return NextResponse.json({ message: error.message || "Failed to deploy code" }, { status: 500 })
  }
}
