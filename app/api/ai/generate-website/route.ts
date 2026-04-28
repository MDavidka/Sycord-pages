import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runAIWebsiteBuilder } from "@/lib/ai-website-builder"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as { prompt?: string }
    const prompt = body.prompt?.trim()

    if (!prompt) {
      return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
    }

    const result = await runAIWebsiteBuilder(prompt)

    const routeSummary = result.manifest.pages.map((p) => p.path).join(", ")
    return NextResponse.json({
      message: `Builder completed ${result.manifest.pages.length} pages: ${routeSummary}`,
      manifest: result.manifest,
      files: result.files,
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
