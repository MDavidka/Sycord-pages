import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runSyraPipeline, classifyIntent } from "@/lib/ai/pipeline"
import { loadPages, loadLastBuildError, loadDeploymentRuntime } from "@/lib/ai/project-store"
import type { SyraMode, SyraRequest } from "@/lib/ai/types"
import { AiPipelineError, redactSecrets } from "@/lib/ai/errors"

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const userId = (session.user as any).id as string
  if (!userId) {
    return new Response("Unauthorized", { status: 401 })
  }
  const enc = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      const done = () => {
        if (closed) return
        try {
          controller.enqueue(enc.encode("event: done\ndata: {}\n\n"))
          controller.close()
        } catch {
          closed = true
        }
      }

      try {
        const body = await request.json().catch(() => ({}))
        const prompt = String(body.prompt ?? "").trim()
        const projectId = String(body.projectId ?? "")

        if (!prompt || !projectId) {
          push("error", { stage: "validation", title: "Missing fields", message: "prompt and projectId are required", retryable: false })
          done()
          return
        }

        const syraRequest: SyraRequest = {
          prompt,
          projectId,
          modelId: String(body.modelId ?? "deepseek-v4-pro"),
          provider: String(body.provider ?? "DeepSeek"),
          mode: (body.mode as "auto" | "generate" | "edit" | "fix") ?? "auto",
          selectedFile: body.selectedFile ?? undefined,
          attachments: body.attachments ?? [],
          diagnostics: body.diagnostics ?? [],
          deployLogs: body.deployLogs ?? [],
        }

        await runSyraPipeline(syraRequest, userId, push)
        done()
      } catch (err: unknown) {
        if (err instanceof AiPipelineError) {
          const safeEvent = err.toSSE()
          push("error", safeEvent)
        } else if (err instanceof Error) {
          push("error", {
            stage: "streaming",
            title: "Unexpected error",
            message: redactSecrets(err.message),
            retryable: false,
          })
        } else {
          push("error", {
            stage: "streaming",
            title: "Unknown error",
            message: "An unexpected error occurred",
            retryable: false,
          })
        }
        done()
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 })
  }

  const userId = (session.user as any).id as string
  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId") ?? ""

  if (!projectId) {
    return Response.json({ error: "Invalid projectId" }, { status: 400 })
  }

  try {
    const pages = await loadPages(userId, projectId)
    return Response.json({ pages })
  } catch (e: unknown) {
    return Response.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 })
  }
}
