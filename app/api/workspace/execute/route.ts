import {
  isDangerousCommand,
  loadProject,
  projectFiles,
  requireUserId,
} from "@/lib/workspace/sandbox"
import { getContainer, sshExecuteCommand } from "@/lib/deploy/ssh-deploy"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const COMMAND_TIMEOUT_MS = 180_000

function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}

export async function POST(req: Request): Promise<Response> {
  const userId = await requireUserId()
  if (!userId) return textResponse("Unauthorized", 401)

  const { searchParams } = new URL(req.url)
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }

  const projectId = (searchParams.get("projectId") || body?.projectId || "").toString()
  const command = typeof body?.command === "string" ? body.command.trim() : ""
  const cwd = typeof body?.cwd === "string" ? body.cwd : undefined

  if (!command) return textResponse("Missing 'command'", 400)
  if (isDangerousCommand(command)) return textResponse(`Dangerous command blocked: ${command}`, 400)

  const project = await loadProject(userId, projectId)
  if (!project) return textResponse("Project not found", 404)

  const container = await getContainer(projectId)
  if (!container) {
    return textResponse("Container not provisioned. Deploy first to create workspace.", 400)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const enqueue = (text: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(text))
        } catch {
          /* controller already closed */
        }
      }
      const finish = () => {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          /* already closed */
        }
      }

      const timer = setTimeout(() => {
        enqueue(`\n[ssh-exec] Command timed out after ${COMMAND_TIMEOUT_MS / 1000}s — killed.\n`)
        finish()
      }, COMMAND_TIMEOUT_MS)

      enqueue(`$ ${command}\n`)

      try {
        const result = await sshExecuteCommand(container, command, cwd)
        clearTimeout(timer)

        if (result.stdout) {
          enqueue(result.stdout)
          if (!result.stdout.endsWith("\n")) enqueue("\n")
        }
        if (result.stderr) {
          enqueue(result.stderr)
          if (!result.stderr.endsWith("\n")) enqueue("\n")
        }
        enqueue(`\n[ssh-exec] exit code ${result.exitCode ?? "unknown"}\n`)
      } catch (err: any) {
        clearTimeout(timer)
        enqueue(`\n[ssh-exec] Error: ${err?.message || "SSH execution failed"}\n`)
      } finally {
        finish()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
