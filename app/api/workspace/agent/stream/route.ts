/**
 * Proxies Syte agent activity SSE through the Next.js session so the browser
 * never sees DEPLOYER_API_KEY.
 *
 * GET /api/workspace/agent/stream?projectId=...&since_id=0&format=sse
 */

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import {
  isSyteConfigured,
  syteOpenAgentActivityStream,
} from "@/lib/deploy/syte-client"
import {
  createSyteWorkspaceForProject,
  getStoredSyteUuid,
} from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

async function resolveUuid(userId: string, projectId: string) {
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) return null

  let uuid = getStoredSyteUuid(project)
  if (!uuid) {
    const created = await createSyteWorkspaceForProject(db, userId, projectId, project)
    if (created.ok && created.data?.uuid) uuid = created.data.uuid
  }
  return uuid
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!isSyteConfigured()) {
    return new Response(
      JSON.stringify({ ok: false, error: "Syte VM agent is not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }

  const url = new URL(req.url)
  const projectId = (url.searchParams.get("projectId") || "").trim()
  if (!projectId) {
    return new Response(JSON.stringify({ ok: false, error: "Missing projectId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const sinceId = Number(url.searchParams.get("since_id") || "0") || 0
  const formatParam = (url.searchParams.get("format") || "sse").trim()
  const format =
    formatParam === "tagged" || formatParam === "text" || formatParam === "jsonl"
      ? formatParam
      : "sse"

  const uuid = await resolveUuid(userId, projectId)
  if (!uuid) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "No Syte workspace UUID for this project.",
        needsCreate: true,
      }),
      { status: 409, headers: { "Content-Type": "application/json" } },
    )
  }

  const upstream = await syteOpenAgentActivityStream(uuid, {
    sinceId,
    live: true,
    format,
    signal: req.signal,
  })

  if (!upstream.ok) {
    return new Response(JSON.stringify({ ok: false, error: upstream.error }), {
      status: upstream.status || 502,
      headers: { "Content-Type": "application/json" },
    })
  }

  const body = upstream.response.body
  if (!body) {
    return new Response(JSON.stringify({ ok: false, error: "Empty agent stream body" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    })
  }

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Syra-Agent-Uuid": uuid,
    },
  })
}
