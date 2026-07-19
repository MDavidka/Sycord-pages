import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import {
  syteAgentSkillsDisable,
  syteAgentSkillsEnable,
  syteAgentSkillsList,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/projects/[id]/agent/skills
 * → GET /api/agent_skills?uuid=
 *
 * POST /api/projects/[id]/agent/skills
 * body: { action: "enable"|"disable", skillId, parameters? }
 * → POST /api/agent_skills_enable | /api/agent_skills_disable
 *
 * Docs: https://sycord.site/api/#agent
 */
async function loadOwnedWorkspace(projectId: string, userId: string) {
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) return { error: Response.json({ message: "Project not found" }, { status: 404 }) }

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) {
    return {
      error: Response.json({ message: workspace.error, needsCreate: true }, { status: 409 }),
    }
  }
  return { uuid: workspace.uuid }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  if (!projectId) {
    return Response.json({ message: "Project ID is required." }, { status: 400 })
  }

  const loaded = await loadOwnedWorkspace(projectId, session.user.id)
  if ("error" in loaded) return loaded.error

  const listed = await syteAgentSkillsList(loaded.uuid)
  if (!listed.ok) {
    return Response.json(
      { message: listed.error || "Failed to list agent skills." },
      { status: listed.status || 502 },
    )
  }

  return Response.json({
    ok: true,
    uuid: loaded.uuid,
    skills: listed.data?.skills || [],
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  const body = (await request.json().catch(() => null)) as {
    action?: unknown
    skillId?: unknown
    skill_id?: unknown
    parameters?: unknown
  } | null

  const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : ""
  const skillId =
    (typeof body?.skillId === "string" && body.skillId.trim()) ||
    (typeof body?.skill_id === "string" && body.skill_id.trim()) ||
    ""
  const parameters =
    body?.parameters && typeof body.parameters === "object" && !Array.isArray(body.parameters)
      ? (body.parameters as Record<string, unknown>)
      : undefined

  if (!projectId || !skillId || (action !== "enable" && action !== "disable")) {
    return Response.json(
      { message: 'Project ID, skillId, and action ("enable"|"disable") are required.' },
      { status: 400 },
    )
  }

  const loaded = await loadOwnedWorkspace(projectId, session.user.id)
  if ("error" in loaded) return loaded.error

  const result =
    action === "enable"
      ? await syteAgentSkillsEnable(loaded.uuid, skillId, parameters)
      : await syteAgentSkillsDisable(loaded.uuid, skillId)

  if (!result.ok) {
    return Response.json(
      { ok: false, message: result.error || `Failed to ${action} skill.` },
      { status: result.status || 502 },
    )
  }

  const listed = await syteAgentSkillsList(loaded.uuid)
  return Response.json({
    ok: true,
    uuid: loaded.uuid,
    action,
    skill_id: skillId,
    skills: listed.ok ? listed.data?.skills || [] : undefined,
  })
}
