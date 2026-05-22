// Syra Generate API — POST endpoint for site generation.
// Accepts a prompt and optional model selection, runs the pipeline,
// and returns the manifest + generated files.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runSyraPipeline } from "@/lib/syra"
import type { ModelSelection } from "@/lib/ai-provider"
import type { ProgressCallback } from "@/lib/syra"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const prompt: string = body.prompt
    const modelId: string | undefined = body.modelId
    const modelProvider: string | undefined = body.modelProvider

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return NextResponse.json(
        { message: "Prompt must be at least 3 characters" },
        { status: 400 },
      )
    }

    const model: ModelSelection | undefined =
      modelId && modelProvider
        ? { id: modelId, provider: modelProvider }
        : undefined

    const { result } = await runSyraPipeline(prompt, { model })

    return NextResponse.json({
      siteId: result.siteId,
      manifest: result.manifest,
      files: result.files,
      pipelineState: result.pipelineState,
      fileCount: result.files.length,
      pageCount: result.manifest.pages.length,
    })
  } catch (error) {
    console.error("Syra generation error:", error)
    return NextResponse.json(
      {
        message: "Generation failed",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
