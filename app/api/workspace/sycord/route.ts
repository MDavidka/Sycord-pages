// Backend proxy for the Sycord Deployer API (/sycord/api/).
//
// The browser never holds DEPLOYER_API_KEY — all calls are proxied here.
// Auth: NextAuth session required. Each action loads syteWorkspaceUuid from
// the project document in MongoDB before forwarding to Syte.
//
// POST /api/workspace/sycord  — issue_deployment | domain
// GET  /api/workspace/sycord  — container_get

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject, ownedProjectMutationFilter } from "@/lib/project-id"
import {
  syteIssueDeployment,
  syteContainerGet,
  syteSycordDomain,
  isSyteConfigured,
} from "@/lib/deploy/syte-client"
import { getStoredSyteUuid } from "@/lib/deploy/syte-workspace"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

async function getProjectUuid(db: any, userId: string, projectId: string) {
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) return { project: null, uuid: null }
  const uuid = getStoredSyteUuid(project)
  return { project, uuid }
}

// ─── POST ────────────────────────────────────────────────────────────────────
// Body: { action: 'issue_deployment' | 'domain', projectId: string, domain?: string }
export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  const rate = checkRateLimit(`sycord-action:${userId}`, { limit: 100, windowMs: 60_000 })
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    )
  }

  if (!isSyteConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Syte deployer is not configured (DEPLOYER_API_KEY missing)." },
      { status: 503 },
    )
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { action, projectId, domain } = body
  if (!action) return NextResponse.json({ ok: false, error: "Missing 'action'" }, { status: 400 })
  if (!projectId) return NextResponse.json({ ok: false, error: "Missing 'projectId'" }, { status: 400 })

  const client = await clientPromise
  const db = client.db()
  const { project, uuid } = await getProjectUuid(db, userId, projectId)

  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  if (!uuid) {
    return NextResponse.json(
      { ok: false, error: "No Syte workspace UUID found for this project. The workspace may still be initialising — try again in a moment." },
      { status: 409 },
    )
  }

  // ── issue_deployment ───────────────────────────────────────────────────────
  if (action === "issue_deployment") {
    const result = await syteIssueDeployment(uuid)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 502 })
    }

    // Update deployStatus to 'deploying' in DB
    try {
      await db.collection("users").updateOne(
        ownedProjectMutationFilter(userId, project),
        { $set: { "projects.$.deployStatus": "deploying", "projects.$.updatedAt": new Date() } },
      )
    } catch (err) {
      console.error("[sycord] Failed to persist deployStatus=deploying:", err)
      return NextResponse.json(
        { ok: false, error: "Deployment started but failed to update project state" },
        { status: 500 },
      )
    }

    return NextResponse.json({
      ok: true,
      uuid,
      status: result.data?.status ?? "deploying",
      stream_url: result.data?.stream_url ?? null,
      message: result.data?.message ?? "Deployment started",
    })
  }

  // ── domain ─────────────────────────────────────────────────────────────────
  if (action === "domain") {
    if (!domain || typeof domain !== "string") {
      return NextResponse.json({ ok: false, error: "Missing 'domain'" }, { status: 400 })
    }
    const result = await syteSycordDomain(uuid, domain)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 502 })
    }

    const newDomain = (result.data as any)?.project?.domain ?? domain
    const newUrl = (result.data as any)?.project?.url ?? null
    try {
      await db.collection("users").updateOne(
        ownedProjectMutationFilter(userId, project),
        {
          $set: {
            "projects.$.syteDomain": newDomain,
            "projects.$.syteUrl": newUrl,
            "projects.$.updatedAt": new Date(),
          },
        },
      )
    } catch (err) {
      console.error("[sycord] Failed to persist domain update:", err)
      return NextResponse.json(
        { ok: false, error: "Domain set on deployer but failed to update project state" },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true, uuid, domain: newDomain, url: newUrl })
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
}

// ─── GET ─────────────────────────────────────────────────────────────────────
// Query: ?action=container_get&projectId=...
export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })

  if (!isSyteConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Syte deployer is not configured." },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const action = url.searchParams.get("action")
  const projectId = url.searchParams.get("projectId")

  if (!action || action !== "container_get") {
    return NextResponse.json({ ok: false, error: "action must be 'container_get'" }, { status: 400 })
  }
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing 'projectId'" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const { project, uuid } = await getProjectUuid(db, userId, projectId)

  if (!project) return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  if (!uuid) {
    return NextResponse.json(
      { ok: false, error: "No Syte workspace UUID for this project." },
      { status: 409 },
    )
  }

  const result = await syteContainerGet(uuid)
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 502 })
  }

  const data = result.data
  const running = Boolean(data?.running)
  const liveUrl = data?.url ?? null

  // If now running, persist the live URL and update deploy status
  if (running && liveUrl) {
    try {
      await db.collection("users").updateOne(
        ownedProjectMutationFilter(userId, project),
        {
          $set: {
            "projects.$.syteUrl": liveUrl,
            "projects.$.syteDomain": data?.domain ?? null,
            "projects.$.deployStatus": "running",
            "projects.$.updatedAt": new Date(),
          },
        },
      )
    } catch (err) {
      console.error("[sycord] Failed to persist container running state:", err)
    }
  }

  return NextResponse.json({
    ok: true,
    uuid,
    running,
    status: data?.status ?? null,
    url: liveUrl,
    domain: data?.domain ?? null,
    state: data?.state ?? null,
  })
}
