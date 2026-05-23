// Syra Generate — POST endpoint + GET manifest retrieval
import { NextResponse, NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runPipeline } from "@/lib/syra"
import type { ModelSelection } from "@/lib/ai-provider"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")
  const slug = searchParams.get("slug")

  // In a full implementation, this would fetch from a database.
  // For now, return a minimal response so the preview page doesn't crash.
  return NextResponse.json({
    projectId,
    slug,
    manifest: null,
    message: "Use the POST endpoint to generate a manifest first.",
  })
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })

  try {
    const { prompt, modelId, modelProvider } = await request.json()
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return NextResponse.json({ message: "Prompt must be at least 3 characters" }, { status: 400 })
    }

    const model: ModelSelection | undefined = modelId && modelProvider ? { id: modelId, provider: modelProvider } : undefined
    const { result } = await runPipeline(prompt, { model })

    return NextResponse.json({
      projectId: result.projectId,
      manifest: result.manifest,
      files: result.files,
      sectionsBuilt: result.sectionsBuilt,
      sectionsTotal: result.sectionsTotal,
      pipelineState: result.pipelineState,
    })
  } catch (error) {
    console.error("Syra generate error:", error)
    return NextResponse.json({ message: "Generation failed", error: error instanceof Error ? error.message : String(error) }, { status: 500 })
  }
}
