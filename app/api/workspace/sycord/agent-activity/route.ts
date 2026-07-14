// Agent activity proxy — SSE stream + snapshot polling + local DB persistence.
//
// GET  /api/workspace/sycord/agent-activity?projectId=<id>&live=1      → SSE stream
// GET  /api/workspace/sycord/agent-activity?projectId=<id>&since_id=N  → JSON snapshot (from Syte)
// GET  /api/workspace/sycord/agent-activity?projectId=<id>&history=1   → locally stored events
// POST /api/workspace/sycord/agent-activity                             → persist one event
//
// The browser never holds DEPLOYER_API_KEY. This route proxies:
//   - Streaming: GET  https://sycord.site/api/projects/{uuid}/agent/activity/stream?live=1
//   - Snapshot:  GET  https://sycord.site/sycord/api/agent_activity?uuid={uuid}&since_id=N
//
// Every event received by the browser is POSTed back here so it survives the user
// leaving the page (persisted in the `agentActivity` collection). On return the
// client loads `history=1` and catches up via the snapshot `since_id`, making the
// agent feed continuous across sessions.
//
// Auth: NextAuth session required.

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import { getStoredSyteUuid } from "@/lib/deploy/syte-workspace"
import { isSyteConfigured, getSyteConfig, syteAgentActivity } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Allow long-lived SSE connections — Vercel/Next max is 300 s on Pro.
export const maxDuration = 300

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  if (!isSyteConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Syte deployer is not configured (DEPLOYER_API_KEY missing)." },
      { status: 503 },
    )
  }

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").trim()
  const live = searchParams.get("live") === "1"
  const sinceId = parseInt(searchParams.get("since_id") || "0", 10) || 0
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 2000)
  const session_ = searchParams.get("session") || ""

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing 'projectId'" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const uuid = getStoredSyteUuid(project)
  if (!uuid) {
    return NextResponse.json(
      { ok: false, error: "No Syte workspace UUID for this project." },
      { status: 409 },
    )
  }

  // ── SSE live stream ─────────────────────────────────────────────────────────
  // Forward the Syte SSE endpoint to the browser, rewriting the auth header.
  // Syte SSE path: GET /api/projects/{uuid}/agent/activity/stream?live=1
  if (live) {
    const config = getSyteConfig()
    const upstreamUrl = new URL(
      `${config.baseUrl}/api/projects/${encodeURIComponent(uuid)}/agent/activity/stream`,
    )
    upstreamUrl.searchParams.set("live", "1")
    if (sinceId > 0) upstreamUrl.searchParams.set("since_id", String(sinceId))

    let upstream: Response
    try {
      upstream = await fetch(upstreamUrl.toString(), {
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache",
          "X-API-Key": config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
        // Node fetch: keep connection alive
        // @ts-ignore — Next.js node runtime accepts this
        signal: req.signal,
      })
    } catch (err: any) {
      return NextResponse.json(
        { ok: false, error: err?.message || "Failed to connect to upstream Syte stream" },
        { status: 502 },
      )
    }

    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "")
      return NextResponse.json(
        {
          ok: false,
          error: `Upstream returned ${upstream.status}${
            text ? ": " + text.slice(0, 300) : ""
          }`,
        },
        { status: upstream.status || 502 },
      )
    }

    // Pipe the upstream SSE body directly to the client
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    })
  }

  // ── History (locally stored events) ──────────────────────────────────────────
  // Returns events we have persisted in MongoDB so the feed is continuous across
  // page reloads / the user leaving and coming back.
  if (searchParams.get("history") === "1") {
    const stored = (await db
      .collection("agentActivity")
      .find({ userId, projectId })
      .sort({ eventId: 1 })
      .limit(limit)
      .toArray()) as any[]

    return NextResponse.json({
      ok: true,
      uuid,
      source: "db",
      events: stored.map((e) => ({
        id: e.eventId,
        project_id: e.project_id,
        event_type: e.event_type,
        role: e.role,
        title: e.title,
        detail: e.detail,
        payload: e.payload,
        source: e.source,
        created_at: e.created_at,
      })),
      count: stored.length,
    })
  }

  // ── Snapshot (polling) ───────────────────────────────────────────────────────
  const result = await syteAgentActivity(uuid, { sinceId, limit, session: session_ || undefined })
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: result.status || 502 },
    )
  }

  return NextResponse.json({ ok: true, uuid, ...(result.data as object) })
}

// ─── POST ───────────────────────────────────────────────────────────────────
// Body: { projectId: string; event: SyteAgentEvent }
// Persists a single agent activity event so it survives the user leaving.
// Deduplicated by (userId, projectId, eventId) so replays are idempotent.
export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as any)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectId, event } = body
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing 'projectId'" }, { status: 400 })
  }
  if (!event || typeof event !== "object" || typeof event.id !== "number") {
    return NextResponse.json({ ok: false, error: "Missing or invalid 'event'" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const eventId = Number(event.id)
  await db.collection("agentActivity").updateOne(
    { userId, projectId, eventId },
    {
      $set: {
        userId,
        projectId,
        eventId,
        project_id: event.project_id ?? projectId,
        event_type: event.event_type ?? "message",
        role: event.role ?? "agent",
        title: event.title ?? "",
        detail: event.detail ?? "",
        payload: event.payload ?? {},
        source: event.source ?? "agent",
        created_at: event.created_at ?? new Date().toISOString(),
        updatedAt: new Date(),
      },
    },
    { upsert: true },
  )

  return NextResponse.json({ ok: true, eventId })
}
