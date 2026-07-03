import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import { ensureSyteLivePreview } from "@/lib/deploy/syte-preview"
import {
  sytePreviewStatus,
  syteStopPreview,
  pickSytePreviewUrl,
  useSyteWorkspace,
} from "@/lib/deploy/syte-client"
import { getStoredSyteUuid, requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { isValidProjectId, parseClientWorkspaceFiles } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

async function loadProject(userId: string, projectId: string) {
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  return { db, project }
}

function previewErrorNeedsCreate(error?: string): boolean {
  if (!error) return false
  const lower = error.toLowerCase()
  return (
    lower.includes("not found") ||
    lower.includes("createworkspace") ||
    lower.includes("no syte workspace")
  )
}

/**
 * POST /api/workspace/preview — sync files, issue domain (if set), start_preview.
 * GET  /api/workspace/preview?projectId= — preview_status for existing workspace.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  if (!useSyteWorkspace()) {
    return NextResponse.json(
      { ok: false, error: "Syte preview is not configured (DEPLOYER_API_KEY + sycord.site)." },
      { status: 503 },
    )
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }

  const projectId = String(body?.projectId || new URL(req.url).searchParams.get("projectId") || "").trim()
  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ ok: false, error: "Invalid project ID" }, { status: 400 })
  }

  const { db, project } = await loadProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  if (typeof body?.domain === "string" && body.domain.trim()) {
    project.domain = body.domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
  }

  const clientFiles = parseClientWorkspaceFiles(body)

  const result = await ensureSyteLivePreview(db, userId, projectId, project, {
    syncFiles: body?.syncFiles !== false,
    issueDomain: body?.issueDomain !== false,
    domain: typeof body?.domain === "string" ? body.domain : project?.domain,
    clientFiles,
  })

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        needsCreate: previewErrorNeedsCreate(result.error),
        uuid: result.uuid,
        previewUrl: result.previewUrl,
        domainIssued: result.domainIssued,
        status: result.status,
      },
      { status: 502 },
    )
  }

  return NextResponse.json({
    ok: true,
    uuid: result.uuid,
    previewUrl: result.previewUrl,
    previewReady: result.previewReady,
    previewRunning: result.previewRunning,
    domainIssued: result.domainIssued,
    status: result.status,
  })
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").trim()
  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ ok: false, error: "Invalid project ID" }, { status: 400 })
  }

  const { project } = await loadProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const uuid = getStoredSyteUuid(project)
  if (!uuid) {
    return NextResponse.json({
      ok: false,
      needsCreate: true,
      error: "No Syte workspace — call createWorkspace() first.",
    })
  }

  const status = await sytePreviewStatus(uuid)
  if (!status.ok) {
    return NextResponse.json({ ok: false, error: status.error, uuid }, { status: 502 })
  }

  const data = status.data || {}
  return NextResponse.json({
    ok: true,
    uuid,
    previewUrl: pickSytePreviewUrl(data),
    previewReady: Boolean((data as any).preview_ready),
    previewRunning: Boolean((data as any).preview_running),
    status: data,
    domain: project.domain || null,
  })
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").trim()
  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ ok: false, error: "Invalid project ID" }, { status: 400 })
  }

  const { project } = await loadProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const resolved = await requireSyteWorkspaceUuid(project)
  if ("error" in resolved) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 409 })
  }

  const stopped = await syteStopPreview(resolved.uuid)
  if (!stopped.ok) {
    return NextResponse.json({ ok: false, error: stopped.error }, { status: 502 })
  }

  return NextResponse.json({ ok: true, uuid: resolved.uuid })
}
