// GET /api/syra/[projectId]/stream[?since_id=&format=marked&types=&uuid=]
//
// Same-origin proxy for Syte's durable agent activity SSE stream:
//   GET /api/projects/{uuid}/agent/activity/stream?live=1&since_id=0&format=marked
//
// The browser opens this with an EventSource; we inject the Syte api key
// server-side (EventSource cannot set Authorization) and pipe the upstream
// stream through verbatim. Default encoding is `marked` (`[sessionN]` +
// `S…(d|g)-`) so the client only consumes the latest session.
//
// The upstream frames include `id:` lines, so the browser's native EventSource
// resume works: on a transient disconnect it reconnects with the Last-Event-ID
// header, which we forward upstream as since_id.

import {
  isSyteConfigured,
  openActivityStream,
  resolveUuid,
} from "@/lib/syra-agent"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  if (!isSyteConfigured()) {
    return new Response(
      `retry: 5000\n\ndata: [error]<{"text":"syte_not_configured"}>\n\n`,
      {
        status: 503,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      },
    )
  }

  const url = new URL(req.url)
  const uuid = resolveUuid(projectId, url.searchParams.get("uuid"))
  if (!uuid) {
    return new Response("Missing uuid", { status: 400 })
  }

  // Resume point: explicit ?since_id wins, else the standard SSE reconnect header.
  const sinceParam = url.searchParams.get("since_id")
  const lastEventId = req.headers.get("last-event-id")
  const sinceId = Number(sinceParam ?? lastEventId ?? 0) || 0

  // Prefer marked: [boot] / [sessionN] / S{N}{mmm}(d|g)- … so the client can
  // stream only the latest session (older ones are already saved).
  const format = (url.searchParams.get("format") || "marked") as
    | "sse"
    | "tagged"
    | "marked"
    | "text"
    | "jsonl"
  const types = url.searchParams.get("types") || undefined

  let upstream: Response
  try {
    upstream = await openActivityStream(uuid, {
      sinceId,
      format,
      types,
      signal: req.signal,
    })
  } catch (err: any) {
    const message = err?.message || "stream_failed"
    return new Response(
      `retry: 5000\n\ndata: [error]<{"text":${JSON.stringify(message)}}>\n\n`,
      {
        status: 502,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      },
    )
  }

  if (!upstream.ok || !upstream.body) {
    const detail = await upstream.text().catch(() => `HTTP ${upstream.status}`)
    return new Response(
      `retry: 5000\n\ndata: [error]<{"text":${JSON.stringify(
        `upstream ${upstream.status}: ${detail.slice(0, 200)}`,
      )}}>\n\n`,
      {
        status: 502,
        headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      },
    )
  }

  // Pipe the upstream SSE body straight through to the browser.
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type":
        upstream.headers.get("content-type") || "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so events arrive in real time.
      "X-Accel-Buffering": "no",
    },
  })
}
