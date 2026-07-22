import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { syteAgentAnswerQuestion } from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isValidAnswer(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) {
    return value.length > 0 && value.every((item) => typeof item === "string" && item.length > 0)
  }
  if (value && typeof value === "object") return Object.keys(value as object).length > 0
  return false
}

/**
 * POST /api/projects/[id]/agent/questions/[questionId]/answer
 * body: { answer: string | number | string[] | object }
 * → POST /api/agent_answer_question
 *
 * Docs: https://sycord.site/api/#agent
 * GUI mirror of Syte: POST /api/projects/{uuid}/agent/questions/{question_id}/answer
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; questionId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const rate = checkRateLimit(`agent-answer:${session.user.id}`, { limit: 60, windowMs: 60_000 })
  if (!rate.allowed) {
    return Response.json(
      { message: "Too many answers. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    )
  }

  const { id: projectId, questionId } = await params
  if (!projectId || !questionId?.trim()) {
    return Response.json({ message: "Project ID and question ID are required." }, { status: 400 })
  }

  let body: { answer?: unknown } | null = null
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const answer = body?.answer
  if (!isValidAnswer(answer)) {
    return Response.json(
      { message: "Answer is required (string, number, string[], or object)." },
      { status: 400 },
    )
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, projectId)
  if (!project) {
    return Response.json({ message: "Project not found" }, { status: 404 })
  }

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) {
    return Response.json({ message: workspace.error, needsCreate: true }, { status: 409 })
  }

  const normalizedAnswer =
    typeof answer === "string" ? answer.trim() : (answer as string | number | string[] | Record<string, unknown>)

  const result = await syteAgentAnswerQuestion(workspace.uuid, questionId.trim(), normalizedAnswer)
  if (!result.ok) {
    return Response.json(
      { message: result.error || "Failed to answer agent question." },
      { status: result.status || 502 },
    )
  }

  return Response.json({
    ok: true,
    uuid: workspace.uuid,
    id: result.data?.id || questionId.trim(),
    status: result.data?.status || "answered",
    answer: result.data?.answer ?? normalizedAnswer,
  })
}
