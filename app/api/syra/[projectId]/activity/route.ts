// GET /api/syra/[projectId]/activity[?since_id=&uuid=]
//
// Activity snapshot proxy. Because the Syte cloud runtime is durable and runs
// 24/7, the browser must recover every older message on open — it walks this
// endpoint from since_id=0 (paginating by the last seen id) to rebuild the full
// conversation, then resumes the live SSE stream from the last id. Proxies to
// Syte's GET /sycord/api/agent_activity.

import { NextResponse } from "next/server"
import { getActivitySnapshot, isSyteConfigured, resolveUuid } from "@/lib/syra-agent"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params

  if (!isSyteConfigured()) {
    return NextResponse.json(
      { ok: false, error: "syte_not_configured" },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const uuid = resolveUuid(projectId, url.searchParams.get("uuid"))
  if (!uuid) {
    return NextResponse.json({ ok: false, error: "missing_uuid" }, { status: 400 })
  }

  const sinceId = Number(url.searchParams.get("since_id") ?? 0) || 0
  const result = await getActivitySnapshot(uuid, sinceId)
  return NextResponse.json(result.data ?? { ok: result.ok, error: result.error }, {
    status: result.ok ? 200 : result.status,
  })
}
