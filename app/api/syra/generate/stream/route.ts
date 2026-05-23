// Syra Generate Stream — SSE endpoint with real-time pipeline progress
import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runPipeline } from "@/lib/syra"
import type { ModelSelection } from "@/lib/ai-provider"
import type { ProgressEvent } from "@/lib/syra"

export const runtime = "nodejs"
export const maxDuration = 120

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401, headers: { "Content-Type": "application/json" } })
  }

  try {
    const { prompt, modelId, modelProvider } = await request.json()
    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return new Response(`data: ${JSON.stringify({ type: "error", error: "Prompt must be at least 3 characters" })}\n\ndata: [DONE]\n\n`, { headers: SSE_HEADERS })
    }

    const model: ModelSelection | undefined = modelId && modelProvider ? { id: modelId, provider: modelProvider } : undefined
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const send = (e: ProgressEvent) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`))
        try {
          await runPipeline(prompt, { model, onEvent: send })
        } catch (error) {
          send({ type: "error", error: error instanceof Error ? error.message : String(error) })
        } finally {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        }
      },
    })

    return new Response(stream, { headers: SSE_HEADERS })
  } catch (error) {
    return new Response(`data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : String(error) })}\n\ndata: [DONE]\n\n`, { headers: SSE_HEADERS })
  }
}
