import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = params
    const { code } = await request.json()

    if (!code || typeof code !== "string") {
      return NextResponse.json({ message: "Invalid code" }, { status: 400 })
    }

    if (code.length > 1000000) {
      return NextResponse.json({ message: "Code too large (max 1MB)" }, { status: 500 })
    }

    const htmlTagPattern = /<\/?[a-zA-Z][^>]*>/
    if (!htmlTagPattern.test(code)) {
      console.error("[v0] Code validation error - missing HTML tags", code.substring(0, 100))
      return NextResponse.json({ message: "Code must contain HTML tags" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      userId: session.user.id,
    })

    if (!project) {
      console.error("[v0] Project not found for ID:", id, "User:", session.user.id)
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    if (!code.includes("html") && !code.includes("body") && !code.includes("jsx")) {
      console.log("[v0] Code validation warning - missing expected HTML/JSX", code.substring(0, 100))
    }

    const updateResult = await db.collection("projects").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          aiGeneratedCode: code,
          aiCodeDeployedAt: new Date(),
          updatedAt: new Date(),
        },
      },
    )

    console.log("[v0] Code deployed - Modified docs:", updateResult.modifiedCount, "Code length:", code.length)

    if (updateResult.modifiedCount === 0) {
      return NextResponse.json({ message: "Failed to update project" }, { status: 500 })
    }

    return NextResponse.json({
      message: "Code deployed successfully",
      success: true,
      codeLength: code.length,
    })
  } catch (error: any) {
    console.error("[v0] Deployment error:", error)
    return NextResponse.json({ message: error.message || "Failed to deploy code" }, { status: 500 })
  }
}
