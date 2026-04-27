import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runPipeline } from "@/lib/builder/pipeline"
import type { PipelineEvent, ModelSelection } from "@/lib/builder/types"

export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as { id?: string })?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  let body: { prompt?: string; model?: ModelSelection }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 })
  }

  const { prompt, model } = body
  if (!prompt || typeof prompt !== "string" || prompt.trim().length < 5) {
    return NextResponse.json({ message: "Prompt is required (min 5 characters)" }, { status: 400 })
  }

  const selectedModel: ModelSelection = model ?? {
    id: "gemini-3.1-flash-preview",
    provider: "Google",
    name: "Gemini 3.1 Flash",
  }

  // Create a streaming response using Server-Sent Events
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const emitter = (event: PipelineEvent) => {
        try {
          const data = `data: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch {
          // stream may be closed
        }
      }

      try {
        await runPipeline(prompt.trim(), selectedModel, emitter)
      } catch (err) {
        const errorEvent: PipelineEvent = {
          type: "error",
          timestamp: Date.now(),
          error: err instanceof Error ? err.message : "Pipeline failed",
          recoverable: false,
        }
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`))
        } catch {
          // stream closed
        }
      } finally {
        try {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          controller.close()
        } catch {
          // already closed
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
