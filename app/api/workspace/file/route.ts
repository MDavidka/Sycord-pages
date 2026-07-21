// Per-file upload proxy — called by the Glovix AI builder whenever a file is
// created or edited. Writes the file directly to the Syte workspace so the
// running dev server picks up the change via HMR and the preview updates
// instantly without waiting for a full re-sync.
//
// POST /api/workspace/file
// Body: { projectId: string, path: string, content: string }
//
// Returns: { ok, path, uuid } or { ok: false, error }
//
// The client fires this request in the background (no await) so it never
// blocks the AI's file-operation loop.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import { syteWriteFile, isSyteConfigured } from "@/lib/deploy/syte-client"
import { getStoredSyteUuid } from "@/lib/deploy/syte-workspace"
import { isValidProjectId } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Generous timeout — write_file on Syte is fast (<1s) but network latency varies
export const maxDuration = 15

const SKIP_PATTERNS = [
  /^\.glovix\//,
  /^glovix-picker\.js$/,
  /^\.env(?:\.|$)/,
  /^node_modules\//,
]

function shouldSkip(path: string): boolean {
  return SKIP_PATTERNS.some((p) => p.test(path))
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  if (!isSyteConfigured()) {
    // Not an error — silently skip when Syte isn't configured (standalone mode)
    return NextResponse.json({ ok: true, skipped: true, reason: "syte_not_configured" })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectId, path, content } = body

  if (!isValidProjectId(String(projectId || ""))) {
    return NextResponse.json({ ok: false, error: "Invalid project ID" }, { status: 400 })
  }
  if (!path || typeof path !== "string") {
    return NextResponse.json({ ok: false, error: "Missing 'path'" }, { status: 400 })
  }
  if (path.includes("..") || path.includes("\0")) {
    return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 })
  }
  if (typeof content !== "string") {
    return NextResponse.json({ ok: false, error: "Missing 'content'" }, { status: 400 })
  }

  // Skip system/env files
  if (shouldSkip(path)) {
    return NextResponse.json({ ok: true, skipped: true, reason: "system_file" })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, String(projectId))

  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const uuid = getStoredSyteUuid(project)
  if (!uuid) {
    // Workspace UUID not yet saved (project_connect still running in background).
    // Return silently — the full sync on preview start will catch all files.
    return NextResponse.json({
      ok: true,
      skipped: true,
      reason: "uuid_not_ready",
      message: "Workspace UUID not yet available — file will be synced on next preview start.",
    })
  }

  const result = await syteWriteFile(uuid, path, content)

  if (!result.ok) {
    // Non-fatal — the file is already saved in MongoDB pages.
    // Log but return a 200 so the client doesn't retry.
    console.warn(`[workspace/file] syteWriteFile failed for ${path}: ${result.error}`)
    return NextResponse.json({
      ok: false,
      skipped: false,
      error: result.error,
      path,
      uuid,
    })
  }

  return NextResponse.json({ ok: true, path, uuid })
}
