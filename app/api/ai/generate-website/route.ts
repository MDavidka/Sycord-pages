import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runAIWebsiteBuilder } from "@/lib/ai-website-builder"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

interface GeneratedFile {
  path: string
  content: string
}

async function saveGeneratedFilesToProject(
  userId: string,
  projectId: string,
  files: GeneratedFile[],
) {
  if (!ObjectId.isValid(projectId)) {
    throw new Error("Invalid project ID")
  }

  const normalizedPages = files
    .filter((file) => typeof file.path === "string" && typeof file.content === "string")
    .map((file) => {
      const safeName = file.path.replace(/^\/+/, "").slice(0, 255)
      return {
        name: safeName,
        content: file.content,
        usedFor: "ai-builder",
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    })

  const client = await clientPromise
  const db = client.db()

  const result = await db.collection("users").updateOne(
    {
      id: userId,
      "projects._id": new ObjectId(projectId),
    },
    {
      $set: {
        "projects.$.pages": normalizedPages,
        "projects.$.updatedAt": new Date(),
      },
    },
  )

  if (result.matchedCount === 0) {
    throw new Error("Project not found")
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { prompt?: string; projectId?: string }
    const prompt = body.prompt?.trim()

    if (!prompt) {
      return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
    }

    const result = await runAIWebsiteBuilder(prompt)
    let savedPages = 0
    if (body.projectId) {
      await saveGeneratedFilesToProject(session.user.id, body.projectId, result.files)
      savedPages = result.files.length
    }

    const routeSummary = result.manifest.pages.map((p) => p.path).join(", ")
    return NextResponse.json({
      message: `Builder completed ${result.manifest.pages.length} pages: ${routeSummary}`,
      manifest: result.manifest,
      files: result.files,
      savedPages,
      build: result.build,
      logs: result.logs,
    })
  } catch (error) {
    return NextResponse.json(
      {
        message: "Builder failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
