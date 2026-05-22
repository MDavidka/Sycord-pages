// Syra Generate Stream — SSE endpoint for real-time pipeline progress.
// Streams ProgressEvent objects as SSE messages so the chat UI can render
// live progress: pipeline stages, step completion, file generation, etc.

import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runSyraPipeline, buildStreamingResponse, streamPipelineProgress } from "@/lib/syra"
import type { ModelSelection } from "@/lib/ai-provider"
import type { ProgressEvent } from "@/lib/syra"

export const runtime = "nodejs"
export const maxDuration = 120

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  const headers = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  }

  try {
    const body = await request.json()
    const prompt: string = body.prompt
    const modelId: string | undefined = body.modelId
    const modelProvider: string | undefined = body.modelProvider

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 3) {
      return new Response(
        `data: ${JSON.stringify({ type: "error", error: "Prompt must be at least 3 characters" })}\n\ndata: [DONE]\n\n`,
        { headers },
      )
    }

    const model: ModelSelection | undefined =
      modelId && modelProvider
        ? { id: modelId, provider: modelProvider }
        : undefined

    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const sendEvent = (event: ProgressEvent) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        }

        try {
          const { result } = await runSyraPipeline(prompt, {
            model,
            onEvent: sendEvent,
          })
        } catch (error) {
          sendEvent({
            type: "error",
            error: error instanceof Error ? error.message : String(error),
          })
        } finally {
          sendEvent({ type: "step", step: "done", status: "done", progress: 100, detail: "Stream complete" })
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        }
      },
    })

    return new Response(stream, { headers })
  } catch (error) {
    return new Response(
      `data: ${JSON.stringify({ type: "error", error: error instanceof Error ? error.message : String(error) })}\n\ndata: [DONE]\n\n`,
      { headers },
    )
  }
}
