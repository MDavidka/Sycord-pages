import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { ASTRO_ALLOWLISTED_TASKS, executeAstroTask } from "@/lib/admin/astro-tasks"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireModerator()
    const tasks = Object.values(ASTRO_ALLOWLISTED_TASKS).map((task) => ({
      id: task.id,
      name: task.name,
      description: task.description,
      category: task.category,
      requiresApproval: task.requiresApproval,
      riskLevel: task.riskLevel,
      timeoutMs: task.timeoutMs,
    }))

    return NextResponse.json({ ok: true, tasks })
  } catch (err: any) {
    const status = err?.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ ok: false, error: err?.message || "Failed to load tasks" }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const mod = await requireModerator()
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
    }

    const { taskId, approved, reason } = body || {}
    if (!taskId || typeof taskId !== "string") {
      return NextResponse.json({ ok: false, error: "Missing required 'taskId' parameter" }, { status: 400 })
    }

    const task = ASTRO_ALLOWLISTED_TASKS[taskId]
    if (!task) {
      return NextResponse.json(
        {
          ok: false,
          error: `Task '${taskId}' is not permitted. Only predefined tasks in the secure allowlist can be executed.`,
        },
        { status: 403 },
      )
    }

    if (task.requiresApproval && !approved) {
      return NextResponse.json(
        {
          ok: false,
          error: `Task '${task.name}' requires explicit moderator confirmation before execution.`,
        },
        { status: 400 },
      )
    }

    const result = await executeAstroTask(taskId, {
      moderatorEmail: mod.email,
      approved: Boolean(approved),
      reason: typeof reason === "string" ? reason : undefined,
    })

    return NextResponse.json({
      ok: result.success,
      result,
    })
  } catch (err: any) {
    const status = err?.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ ok: false, error: err?.message || "Execution failed" }, { status })
  }
}
