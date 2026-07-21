import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { redactProjectForClient } from "@/lib/security/redact-project"
import {
  getOwnedProject,
  getProjectOwnerUserId,
  getStoredProjectId,
  ownedProjectMutationFilter,
} from "@/lib/project-id"
import {
  MAX_BUSINESS_DESCRIPTION,
  MAX_BUSINESS_NAME,
  MAX_PAGE_CONTENT_BYTES,
  MAX_PAGES_PER_PROJECT,
  MAX_PROFILE_IMAGE,
  MAX_STYLE,
  MAX_SUBDOMAIN,
  estimateJsonSize,
  utf8ByteLength,
} from "@/lib/security/payload-limits"
import { isSyteConfigured, syteDeleteProject } from "@/lib/deploy/syte-client"
import { getStoredSyteUuid, resolveCanonicalSyteUuid } from "@/lib/deploy/syte-workspace"

/** Fields clients may update via PUT — everything else is rejected (mass-assignment guard). */
const ALLOWED_PROJECT_UPDATE_KEYS = new Set([
  "businessName",
  "businessDescription",
  "style",
  "profileImage",
  "subdomain",
  "pages",
  "status",
])

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()

    const project = await getOwnedProject(db, session.user.id, id)
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // ETag-style short cache so the same project edit screen does not
    // re-download its payload on every tab focus / nav back. The dashboard
    // explicitly invalidates by adding a fresh fetch on mutation.
    const lastModified =
      project.updatedAt || project.createdAt || Date.now().toString()
    const etag = `W/"${id}-${typeof lastModified === "string"
      ? lastModified
      : new Date(lastModified).getTime()
    }"`

    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: { ETag: etag },
      })
    }

    // Strip heavy file payloads from the default project GET — clients that
    // need pages should call /api/projects/[id]/pages.
    const { pages: _pages, ...projectWithoutPages } = project as Record<string, unknown> & {
      pages?: unknown
    }
    void _pages

    return NextResponse.json(redactProjectForClient(projectWithoutPages as any), {
      headers: {
        ETag: etag,
        "Cache-Control": "private, max-age=15, stale-while-revalidate=60",
      },
    })
  } catch (error) {
    console.error("Error fetching project:", error)
    return NextResponse.json({ message: "Error fetching project" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const project = await getOwnedProject(db, session.user.id, id)
  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const updateFields: Record<string, unknown> = {}
  for (const key of Object.keys(body)) {
    if (!ALLOWED_PROJECT_UPDATE_KEYS.has(key)) continue
    const value = body[key]

    if (key === "businessName") {
      if (typeof value !== "string" || !value.trim() || value.length > MAX_BUSINESS_NAME) {
        return NextResponse.json({ message: `businessName must be 1–${MAX_BUSINESS_NAME} chars` }, { status: 400 })
      }
      updateFields[`projects.$.${key}`] = value.trim()
      continue
    }
    if (key === "businessDescription") {
      if (typeof value !== "string" || value.length > MAX_BUSINESS_DESCRIPTION) {
        return NextResponse.json({ message: `businessDescription max ${MAX_BUSINESS_DESCRIPTION} chars` }, { status: 400 })
      }
      updateFields[`projects.$.${key}`] = value
      continue
    }
    if (key === "style") {
      if (typeof value !== "string" || value.length > MAX_STYLE) {
        return NextResponse.json({ message: `style max ${MAX_STYLE} chars` }, { status: 400 })
      }
      updateFields[`projects.$.${key}`] = value
      continue
    }
    if (key === "subdomain") {
      if (typeof value !== "string" || value.length > MAX_SUBDOMAIN) {
        return NextResponse.json({ message: `subdomain max ${MAX_SUBDOMAIN} chars` }, { status: 400 })
      }
      updateFields[`projects.$.${key}`] = value
      continue
    }
    if (key === "profileImage") {
      if (typeof value !== "string" || value.length > MAX_PROFILE_IMAGE) {
        return NextResponse.json({ message: "profileImage too large" }, { status: 400 })
      }
      updateFields[`projects.$.${key}`] = value
      continue
    }
    if (key === "pages") {
      if (!Array.isArray(value) || value.length > MAX_PAGES_PER_PROJECT) {
        return NextResponse.json({ message: `pages max ${MAX_PAGES_PER_PROJECT} entries` }, { status: 400 })
      }
      if (estimateJsonSize(value) > MAX_PAGE_CONTENT_BYTES * 2) {
        return NextResponse.json({ message: "pages payload too large" }, { status: 400 })
      }
      for (const page of value) {
        if (!page || typeof page !== "object") {
          return NextResponse.json({ message: "Invalid page entry" }, { status: 400 })
        }
        const content = (page as { content?: unknown }).content
        if (typeof content === "string" && utf8ByteLength(content) > MAX_PAGE_CONTENT_BYTES) {
          return NextResponse.json({ message: "page content too large" }, { status: 400 })
        }
      }
      updateFields[`projects.$.${key}`] = value
      continue
    }
    if (key === "status") {
      if (typeof value !== "string" || value.length > 64) {
        return NextResponse.json({ message: "Invalid status" }, { status: 400 })
      }
      updateFields[`projects.$.${key}`] = value
      continue
    }

    updateFields[`projects.$.${key}`] = value
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ message: "No updatable fields provided" }, { status: 400 })
  }

  updateFields[`projects.$.updatedAt`] = new Date()

  const result = await db.collection("users").updateOne(
    ownedProjectMutationFilter(session.user.id, project),
    { $set: updateFields },
  )

  if (result.matchedCount === 0) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  try {
    const project = await getOwnedProject(db, session.user.id, id)
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Collaborators leave by removing their local stub; owners delete the real project.
    if (project.isCollaborator) {
      const result = await db.collection("users").updateOne(
        { id: session.user.id },
        {
          $pull: {
            projects: { _id: id },
          } as any,
        },
      )
      if (result.modifiedCount === 0) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
      }
      return NextResponse.json({ success: true, message: "Left collaboration successfully" })
    }

    const ownerUserId = getProjectOwnerUserId(project, session.user.id)
    const storedId = getStoredProjectId(project)

    // Free the Syte workspace so deleted projects no longer count against the
    // remote max-project quota (fixes create failing at 2/3 after a local delete).
    if (!project.isCollaborator && isSyteConfigured()) {
      const projectIdStr = String(storedId ?? id)
      const syteUuid =
        getStoredSyteUuid(project) || resolveCanonicalSyteUuid(project, projectIdStr)
      if (syteUuid) {
        try {
          const deleted = await syteDeleteProject(syteUuid)
          if (!deleted.ok) {
            console.warn(
              `[Project Delete] Syte delete_project failed for ${syteUuid}:`,
              deleted.error,
            )
          } else {
            console.log(`[Project Delete] Syte workspace deleted: ${syteUuid}`)
          }
        } catch (err: any) {
          console.warn(
            `[Project Delete] Syte delete_project error for ${syteUuid}:`,
            err?.message,
          )
        }
      }
    }

    const result = await db.collection("users").updateOne(
      { id: ownerUserId },
      {
        $pull: {
          projects: { _id: storedId },
        } as any,
      },
    )

    if (result.modifiedCount === 0) {
      // Legacy rows may store _id with a different type — pull by string id too.
      const retry = await db.collection("users").updateOne(
        { id: ownerUserId },
        {
          $pull: {
            projects: { _id: String(storedId ?? id) },
          } as any,
        },
      )
      if (retry.modifiedCount === 0) {
        const user = await db.collection("users").findOne({ id: ownerUserId })
        if (!user) {
          return NextResponse.json({ message: "User not found" }, { status: 404 })
        }
        // Last resort: filter the array in memory (handles id / _id mismatches).
        const projects = Array.isArray((user as any).projects) ? (user as any).projects : []
        const next = projects.filter(
          (p: any) =>
            String(p?._id) !== String(storedId) &&
            String(p?._id) !== String(id) &&
            String(p?.id) !== String(id),
        )
        if (next.length === projects.length) {
          return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }
        await db.collection("users").updateOne(
          { id: ownerUserId },
          { $set: { projects: next } },
        )
      }
    }

    console.log("[v0] Project deleted:", { projectId: id, userId: session.user.id })

    return NextResponse.json({ success: true, message: "Project deleted successfully" })
  } catch (error) {
    console.error("[v0] Error deleting project:", error)
    return NextResponse.json({ message: "Error deleting project" }, { status: 500 })
  }
}
