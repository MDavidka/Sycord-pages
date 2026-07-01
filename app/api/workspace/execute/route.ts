import {
  isDangerousCommand,
  loadProject,
  projectFiles,
  requireUserId,
} from "@/lib/workspace/sandbox"
import {
  syteExecuteCommand,
  syteSetEnv,
  syteSyncProjectFiles,
  useSyteWorkspace,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { getProjectEnvVars } from "@/lib/deploy/runner-client"
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
  const cwd = typeof body?.cwd === "string" ? body.cwd : "app"

  if (!command) return textResponse("Missing 'command'", 400)
  if (isDangerousCommand(command)) return textResponse(`Dangerous command blocked: ${command}`, 400)

  const project = await loadProject(userId, projectId)
  if (!project) return textResponse("Project not found", 404)

  if (useSyteWorkspace()) {
    const resolved = await requireSyteWorkspaceUuid(project)
    if ("error" in resolved) {
      return textResponse(
        `${resolved.error}\n\nCall createWorkspace() first (POST /api/create_project) to obtain a workspace UUID.`,
        409,
      )
    }

    const uuid = resolved.uuid
    if (body?.sync !== false) {
      await syteSyncProjectFiles(uuid, projectFiles(project))
    }
    const env = getProjectEnvVars(project)
    if (Object.keys(env).length > 0) {
      await syteSetEnv(uuid, env, true)
    }

    const result = await syteExecuteCommand(uuid, command, {
      cwd,
      timeout: Math.min(
        typeof body?.timeout === "number" ? body.timeout : 300,
        COMMAND_TIMEOUT_MS / 1000,
      ),
    })

    if (!result.ok) {
      return textResponse(result.error || "Command failed", result.status || 502)
    }

    const data = result.data as any
    const output = String(data?.output || "")
    const exitCode = data?.exit_code ?? data?.exitCode ?? 1
    return textResponse(
      `$ ${command}\n[workspace uuid: ${uuid}]\n${output}${output.endsWith("\n") ? "" : "\n"}\n[syte] exit code ${exitCode}\n`,
      exitCode === 0 ? 200 : 422,
    )
  }

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
