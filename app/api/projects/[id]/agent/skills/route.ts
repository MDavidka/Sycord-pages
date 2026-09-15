import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import {
  syteAgentSkillsDisable,
  syteAgentSkillsEnable,
  syteAgentSkillsList,
  syteAgentSkillsUpload,
  syteAgentSkillsDelete,
  type SyteResult,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/projects/[id]/agent/skills
 * → GET /api/agent_skills?uuid=
 *
 * POST /api/projects/[id]/agent/skills
 * body: { action: "enable"|"disable"|"upload"|"add"|"delete", skillId?, name?, content?, responsibility?, description?, parameters?, active? }
 * → POST /api/agent_skills_enable | /api/agent_skills_disable | /api/agent_skills_add | /api/agent_skills_delete
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
  let body: {
    action?: unknown
    skillId?: unknown
    skill_id?: unknown
    name?: unknown
    content?: unknown
    responsibility?: unknown
    description?: unknown
    parameters?: unknown
    active?: unknown
  } | null = null
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : ""
  const skillId =
    (typeof body?.skillId === "string" && body.skillId.trim()) ||
    (typeof body?.skill_id === "string" && body.skill_id.trim()) ||
    ""
  const parameters =
    body?.parameters && typeof body.parameters === "object" && !Array.isArray(body.parameters)
      ? (body.parameters as Record<string, unknown>)
      : undefined

  if (!projectId || !action) {
    return Response.json(
      { message: 'Project ID and action ("enable"|"disable"|"upload"|"add"|"delete") are required.' },
      { status: 400 },
    )
  }

  const loaded = await loadOwnedWorkspace(projectId, session.user.id)
  if ("error" in loaded) return loaded.error

  let result: SyteResult<any>

  if (action === "upload" || action === "add") {
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const content = typeof body?.content === "string" ? body.content.trim() : ""
    const responsibility =
      typeof body?.responsibility === "string" ? body.responsibility.trim().toLowerCase() : "general"
    const description = typeof body?.description === "string" ? body.description.trim() : ""
    const active = body?.active !== false

    if (!name || !content) {
      return Response.json({ message: "Skill name and content are required." }, { status: 400 })
    }

    result = await syteAgentSkillsUpload(loaded.uuid, {
      name,
      responsibility,
      description,
      content,
      parameters,
      active,
    })
  } else if (action === "delete") {
    if (!skillId) {
      return Response.json({ message: "skillId is required to delete a skill." }, { status: 400 })
    }
    result = await syteAgentSkillsDelete(loaded.uuid, skillId)
  } else if (action === "enable") {
    if (!skillId) {
      return Response.json({ message: "skillId is required to enable a skill." }, { status: 400 })
    }
    result = await syteAgentSkillsEnable(loaded.uuid, skillId, parameters)
  } else if (action === "disable") {
    if (!skillId) {
      return Response.json({ message: "skillId is required to disable a skill." }, { status: 400 })
    }
    result = await syteAgentSkillsDisable(loaded.uuid, skillId)
  } else {
    return Response.json({ message: `Unsupported action: ${action}` }, { status: 400 })
  }

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
    skill_id: skillId || undefined,
    skills: listed.ok ? listed.data?.skills || [] : undefined,
  })
}
