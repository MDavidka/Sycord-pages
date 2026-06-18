import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runAIWebsiteBuilder } from "@/lib/ai-builder"

// POST /api/ai/website-builder
//   body: { prompt: string, modelId?: string, modelProvider?: string }
//   returns: { files, plan, manifest, build, logs }
//
// Generates a complete multi-page Next.js website (scaffold +
// per-page TSX) from a single user prompt using the v0-style
// pipeline implemented in `lib/ai-builder`.
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const obj = (body && typeof body === "object" ? body : {}) as Record<string, unknown>
  const prompt = typeof obj.prompt === "string" ? obj.prompt.trim() : ""
  if (!prompt) {
    return NextResponse.json({ message: "prompt is required" }, { status: 400 })
  }
  if (prompt.length > 4000) {
    return NextResponse.json({ message: "prompt is too long (max 4000 chars)" }, { status: 400 })
  }

  const modelId = typeof obj.modelId === "string" ? obj.modelId : undefined
  const modelProvider = typeof obj.modelProvider === "string" ? obj.modelProvider : undefined

  try {
    const result = await runAIWebsiteBuilder(prompt, { modelId, modelProvider })
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI website builder failed"
    return NextResponse.json({ message }, { status: 502 })
  }
}
