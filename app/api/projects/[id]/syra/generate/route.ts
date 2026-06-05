import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { runSyra } from "@/lib/syra/agent"
import { applyChanges, loadProjectFiles } from "@/lib/syra/persist"
import type { SyraEvent, SyraEventInput } from "@/lib/syra/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

/**
 * Syra generation endpoint. Streams Server-Sent Events describing every step,
 * tool call, file change and debug log while the agent works, then persists the
 * resulting files to the project.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  let prompt = ""
  try {
    const body = await request.json()
    prompt = String(body?.prompt || "").trim()
  } catch {
    return Response.json({ message: "Invalid request body" }, { status: 400 })
  }
  if (!prompt) {
    return Response.json({ message: "A prompt is required" }, { status: 400 })
  }
  if (prompt.length > 8000) {
    return Response.json({ message: "Prompt is too long" }, { status: 400 })
  }

  const userId = session.user.id
  const { files, exists } = await loadProjectFiles(userId, id)
  if (!exists) {
    return Response.json({ message: "Project not found" }, { status: 404 })
  }

  const encoder = new TextEncoder()
  const abort = new AbortController()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (event: SyraEvent | SyraEventInput) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          /* controller already closed */
        }
      }

      // Initial padding + retry hint so proxies flush immediately.
      controller.enqueue(encoder.encode(": syra stream open\nretry: 10000\n\n"))

      try {
        await runSyra({
          prompt,
          initialFiles: files,
          signal: abort.signal,
          emit: (event) => send(event),
          persist: (changes) => applyChanges(userId, id, changes),
        })
      } catch (err: any) {
        send({ type: "log", level: "error", message: err?.message || "Syra crashed." } as SyraEventInput)
      } finally {
        if (!closed) {
          controller.enqueue(encoder.encode("data: [DONE]\n\n"))
          closed = true
          controller.close()
        }
      }
    },
    cancel() {
      abort.abort()
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
