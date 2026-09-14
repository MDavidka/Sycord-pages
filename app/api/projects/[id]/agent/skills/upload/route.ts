import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import {
  syteAgentSkillsList,
  syteAgentSkillsUpload,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

/**
 * POST /api/projects/[id]/agent/skills/upload
 * Multipart form or JSON upload for custom skills (.md, .json, .txt).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  if (!projectId) {
    return Response.json({ message: "Project ID is required." }, { status: 400 })
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

  const contentType = request.headers.get("content-type") || ""
  const uploadedSkills: Array<{
    name: string
    responsibility?: string
    description?: string
    content: string
    active?: boolean
  }> = []

  if (contentType.includes("multipart/form-data") || contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData()
    const files = formData.getAll("file")

    for (const item of files) {
      if (!(item instanceof Blob)) continue
      const filename = (item as any).name || "custom_skill.md"
      const text = await item.text()
      if (!text.trim()) continue

      if (filename.endsWith(".json")) {
        try {
          const parsed = JSON.parse(text)
          if (Array.isArray(parsed)) {
            for (const skill of parsed) {
              if (skill && typeof skill === "object" && skill.name && skill.content) {
                uploadedSkills.push({
                  name: String(skill.name).trim(),
                  responsibility: String(skill.responsibility || "general").toLowerCase(),
                  description: String(skill.description || "").trim(),
                  content: String(skill.content).trim(),
                  active: skill.active !== false,
                })
              }
            }
          } else if (parsed && typeof parsed === "object") {
            uploadedSkills.push({
              name: String(parsed.name || filename.replace(/\.json$/, "")).trim(),
              responsibility: String(parsed.responsibility || "general").toLowerCase(),
              description: String(parsed.description || "").trim(),
              content: String(parsed.content || text).trim(),
              active: parsed.active !== false,
            })
          }
        } catch {
          // Fallback as markdown
          uploadedSkills.push({
            name: filename.replace(/\.[^/.]+$/, ""),
            responsibility: "general",
            description: `Imported from ${filename}`,
            content: text,
            active: true,
          })
        }
      } else {
        // Markdown or text
        let skillName = filename.replace(/\.[^/.]+$/, "")
        let responsibility = "general"
        let description = ""

        // Extract title if starts with #
        const firstLineMatch = text.match(/^#\s+(.+)$/m)
        if (firstLineMatch) {
          skillName = firstLineMatch[1].trim()
        }

        // Check for responsibility hints in text
        const lower = text.toLowerCase()
        if (lower.includes("responsibility: design") || lower.includes("designing") || lower.includes("ui/ux") || lower.includes("styling")) {
          responsibility = "designing"
        } else if (lower.includes("responsibility: integrate") || lower.includes("integrating") || lower.includes("api") || lower.includes("webhook")) {
          responsibility = "integrating"
        } else if (lower.includes("responsibility: test") || lower.includes("testing") || lower.includes("unit test") || lower.includes("pytest")) {
          responsibility = "testing"
        } else if (lower.includes("responsibility: security") || lower.includes("auth") || lower.includes("oauth") || lower.includes("security")) {
          responsibility = "security"
        } else if (lower.includes("responsibility: build") || lower.includes("building") || lower.includes("architecture") || lower.includes("scaffold")) {
          responsibility = "building"
        }

        uploadedSkills.push({
          name: skillName,
          responsibility,
          description: description || `Uploaded from ${filename}`,
          content: text,
          active: true,
        })
      }
    }
  } else {
    // JSON body
    const body = await request.json().catch(() => null)
    if (body) {
      if (Array.isArray(body)) {
        for (const item of body) {
          if (item?.name && item?.content) {
            uploadedSkills.push({
              name: String(item.name).trim(),
              responsibility: String(item.responsibility || "general").toLowerCase(),
              description: String(item.description || "").trim(),
              content: String(item.content).trim(),
              active: item.active !== false,
            })
          }
        }
      } else if (body.name && body.content) {
        uploadedSkills.push({
          name: String(body.name).trim(),
          responsibility: String(body.responsibility || "general").toLowerCase(),
          description: String(body.description || "").trim(),
          content: String(body.content).trim(),
          active: body.active !== false,
        })
      }
    }
  }

  if (uploadedSkills.length === 0) {
    return Response.json({ message: "No valid skills found in upload." }, { status: 400 })
  }

  const savedSkills = []
  for (const skill of uploadedSkills) {
    const res = await syteAgentSkillsUpload(workspace.uuid, skill)
    if (res.ok && res.data?.skill) {
      savedSkills.push(res.data.skill)
    }
  }

  const listed = await syteAgentSkillsList(workspace.uuid)
  return Response.json({
    ok: true,
    uuid: workspace.uuid,
    saved_count: savedSkills.length,
    skills: listed.ok ? listed.data?.skills || [] : savedSkills,
  })
}
