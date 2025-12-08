import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
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
    const { code, files } = await request.json()

    console.log("[v0] Deploy: Starting for project ID:", id, "User ID:", session.user.id)

    const client = await clientPromise
    const db = client.db()

    // Convert ID to ObjectId
    let projectObjectId: ObjectId
    try {
      projectObjectId = new ObjectId(id)
    } catch (err) {
      console.error("[v0] Deploy: Invalid ObjectId format:", id)
      return NextResponse.json({ message: "Invalid project ID format" }, { status: 400 })
    }

    // Find project
    const project = await db.collection("projects").findOne({
      _id: projectObjectId,
    })

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    let updateData: any = {
      aiCodeDeployedAt: new Date(),
      updatedAt: new Date(),
    }

    // Handle Multi-File Deployment
    if (files && Array.isArray(files)) {
      console.log(`[v0] Deploy: Deploying ${files.length} files`)

      // Validate files
      for (const file of files) {
        if (!file.name || !file.content) {
           return NextResponse.json({ message: "Invalid file format" }, { status: 400 })
        }
      }

      updateData.pages = files

      // Set main code for legacy/preview purposes (try index.html, or first file)
      const indexFile = files.find((f: any) => f.name === 'index.html' || f.name === 'index')
      if (indexFile) {
        updateData.aiGeneratedCode = indexFile.content
      } else if (files.length > 0) {
        updateData.aiGeneratedCode = files[0].content
      }
    }
    // Handle Legacy Single Code Deployment
    else if (code) {
      console.log("[v0] Deploy: Deploying single code block")
      if (typeof code !== "string") {
        return NextResponse.json({ message: "Invalid code provided" }, { status: 400 })
      }
      updateData.aiGeneratedCode = code
      // Also save as index.html in pages for consistency
      updateData.pages = [{ name: "index.html", content: code }]
    } else {
      return NextResponse.json({ message: "No code or files provided" }, { status: 400 })
    }

    // Save to project
    const updateResult = await db.collection("projects").updateOne(
      { _id: projectObjectId },
      { $set: updateData },
    )

    if (updateResult.modifiedCount === 0) {
      console.error("[v0] Deploy: Failed to update project document")
      return NextResponse.json({ message: "Failed to save code to project" }, { status: 500 })
    }

    console.log("[v0] Deploy: Code saved successfully.")

    return NextResponse.json({
      message: "Code deployed successfully",
      success: true,
      projectId: projectObjectId.toString(),
    })
  } catch (error: any) {
    console.error("[v0] Deploy: Unexpected error:", error.message)
    return NextResponse.json({ message: error.message || "Failed to deploy code" }, { status: 500 })
  }
}
