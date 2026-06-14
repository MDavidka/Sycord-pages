// POST /api/workspace/execute  — runCommand (Execution Sandbox API)
//
// Runs a command on an isolated server-side Node.js sandbox scoped to a single
// project, instead of the user's browser. The project's saved files (pages) are
// materialized into a temp workspace, the command runs there, and stdout+stderr
// are streamed back as plain-text chunks. This avoids the browser WebContainer
// crashes / serialization ("object can not be cloned") failures entirely.
//
// Request:  { "command": "pnpm install", "cwd": "/" }   (?projectId=<id>)
// Response: streamed stdout + stderr (text/plain chunks)

import { spawn } from "node:child_process"
import {
  isDangerousCommand,
  loadProject,
  materializeWorkspace,
  projectFiles,
  requireUserId,
  resolveCwd,
} from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

// Hard ceiling for a single command so a hung process can't run forever.
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

  let root: string
  let workdir: string
  try {
    root = await materializeWorkspace(projectId, projectFiles(project))
    workdir = resolveCwd(root, cwd)
  } catch (err: any) {
    return textResponse(`Failed to prepare workspace: ${err?.message || "unknown error"}`, 400)
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
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

      // Run through a shell so the AI can use the same command strings it would
      // type in a terminal. Execution is sandboxed to the project workspace dir.
      const child = spawn(command, {
        cwd: workdir,
        shell: true,
        env: { ...process.env, CI: "1", NO_COLOR: "1", FORCE_COLOR: "0" },
      })

      const timer = setTimeout(() => {
        enqueue(`\n[sandbox] Command timed out after ${COMMAND_TIMEOUT_MS / 1000}s — killed.\n`)
        try {
          child.kill("SIGKILL")
        } catch {
          /* noop */
        }
      }, COMMAND_TIMEOUT_MS)

      enqueue(`$ ${command}\n`)
      child.stdout.on("data", (chunk: Buffer) => enqueue(chunk.toString()))
      child.stderr.on("data", (chunk: Buffer) => enqueue(chunk.toString()))
      child.on("error", (err) => enqueue(`\n[sandbox] ${err.message}\n`))
      child.on("close", (code) => {
        clearTimeout(timer)
        enqueue(`\n[sandbox] exit code ${code ?? 0}\n`)
        finish()
      })

      // If the client disconnects, kill the process.
      req.signal?.addEventListener("abort", () => {
        clearTimeout(timer)
        try {
          child.kill("SIGKILL")
        } catch {
          /* noop */
        }
        finish()
      })
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
