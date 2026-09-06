// Agent activity proxy — SSE hot path + local snapshot fallback.
//
// Prefer live SSE for token_delta / thinking_delta (hot events skip Turso):
//   GET /api/workspace/sycord/agent-activity?projectId=<id>&live=1&since_id=N
// Docs: https://sycord.site/api/#stream/
//
// Snapshot (polling):
//   GET /api/workspace/sycord/agent-activity?projectId=<id>&since_id=N
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
export const fetchCache = "force-no-store"
export const revalidate = 0
// Allow long-lived SSE connections — Vercel/Next max is 300 s on Pro.
export const maxDuration = 300

async function openUpstreamStream(
  config: ReturnType<typeof getSyteConfig>,
  uuid: string,
  sinceId: number,
  sessionFilter: string,
  signal: AbortSignal,
): Promise<Response> {
  // Prefer the token API hot path from https://sycord.site/api/#stream/
  // Fall back to session-auth + sycord mirrors if the primary path is unavailable.
  const candidates = [
    `${config.baseUrl}/api/agent_activity/stream?uuid=${encodeURIComponent(uuid)}`,
    `${config.baseUrl}/sycord/api/agent_activity/stream?uuid=${encodeURIComponent(uuid)}`,
    `${config.baseUrl}/api/projects/${encodeURIComponent(uuid)}/agent/activity/stream`,
  ]

  let lastError: Error | null = null
  for (const candidate of candidates) {
    const upstreamUrl = new URL(candidate)
    if (sinceId > 0) upstreamUrl.searchParams.set("since_id", String(sinceId))
    if (sessionFilter) upstreamUrl.searchParams.set("session", sessionFilter)
    if (!upstreamUrl.searchParams.has("live")) {
      upstreamUrl.searchParams.set("live", "1")
    }

    try {
      const upstream = await fetch(upstreamUrl.toString(), {
        headers: {
          Accept: "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Accept-Encoding": "identity",
          "X-API-Key": config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
        // @ts-ignore — Next.js node runtime accepts aborting the upstream
        signal,
      })
      if (upstream.ok && upstream.body) {
        return upstream
      }
      const text = await upstream.text().catch(() => "")
      lastError = new Error(
        `Upstream ${upstreamUrl.pathname} returned ${upstream.status}${
          text ? ": " + text.slice(0, 200) : ""
        }`,
      )
    } catch (err: any) {
      if (err?.name === "AbortError") throw err
      lastError = err instanceof Error ? err : new Error(String(err))
    }
  }

  throw lastError || new Error("Failed to connect to Syte agent activity stream")
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream; charset=utf-8",
  "Cache-Control": "no-cache, no-transform, no-store, must-revalidate",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
  "Content-Encoding": "none",
  Vary: "Accept-Encoding",
}

/**
 * Create an explicit byte-for-byte SSE bridge with 0ms TTFT.
 * The immediate comment commits response headers to the client;
 * following bytes are forwarded unchanged as they arrive from Syte.
 */
function bridgeUpstreamSse(
  open: () => Promise<Response>,
  requestSignal: AbortSignal,
): Response {
  const encoder = new TextEncoder()
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  let pingInterval: NodeJS.Timeout | undefined

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const abortUpstream = () => {
        void reader?.cancel().catch(() => undefined)
      }
      requestSignal.addEventListener("abort", abortUpstream, { once: true })

      // Establish a real SSE response immediately. This prevents CDN/function
      // buffering from withholding the connection until the first model token.
      controller.enqueue(encoder.encode(": sycord-agent-stream-ready\n\n"))

      // Periodic heartbeat comment to keep connection alive through any intermediate proxies
      pingInterval = setInterval(() => {
        if (!requestSignal.aborted) {
          try {
            controller.enqueue(encoder.encode(": ping\n\n"))
          } catch {
            // Stream might be closed
          }
        }
      }, 10000)

      try {
        const upstream = await open()
        if (!upstream.body) {
          throw new Error("Syte stream opened without a response body")
        }
        reader = upstream.body.getReader()
        while (!requestSignal.aborted) {
          const { done, value } = await reader.read()
          if (done) break
          if (value?.byteLength) controller.enqueue(value)
        }
      } catch (error: any) {
        if (!requestSignal.aborted) {
          const message = error?.message || "Failed to connect to upstream Syte stream"
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ event_type: "error", error: "stream_unavailable", message })}\n\n`,
            ),
          )
        }
      } finally {
        if (pingInterval) clearInterval(pingInterval)
        requestSignal.removeEventListener("abort", abortUpstream)
        try {
          reader?.releaseLock()
        } catch {
          // Reader may already have been cancelled by the client.
        }
        controller.close()
      }
    },
    async cancel() {
      if (pingInterval) clearInterval(pingInterval)
      await reader?.cancel().catch(() => undefined)
    },
  })

  return new Response(body, { status: 200, headers: SSE_HEADERS })
}

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

  // ── SSE live stream (hot path) ──────────────────────────────────────────────
  // https://sycord.site/api/#stream/ — token_delta / thinking_delta are SSE-only.
  if (live) {
    const config = getSyteConfig()
    return bridgeUpstreamSse(
      () => openUpstreamStream(config, uuid, sinceId, session_, req.signal),
      req.signal,
    )
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
