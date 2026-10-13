// GET /api/syra/[projectId]/activity[?since_id=&uuid=&session=last]
//
// Activity snapshot proxy. By default this only returns the latest
// `[sessionN]` (`session=last`) — older completed sessions are already saved
// client-side and must not be re-fetched. Proxies to Syte's
// GET /sycord/api/agent_activity (https://sycord.site/api/#agent).

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
  const sessionParam = url.searchParams.get("session")
  // Default to last session only — never walk the full saved history.
  let session: "last" | number | undefined = "last"
  if (sessionParam === "all" || sessionParam === "*") {
    session = undefined
  } else if (sessionParam && sessionParam !== "last") {
    const n = Number(sessionParam)
    session = Number.isFinite(n) ? n : "last"
  }

  const result = await getActivitySnapshot(uuid, sinceId, { session })
  return NextResponse.json(result.data ?? { ok: result.ok, error: result.error }, {
    status: result.ok ? 200 : result.status,
  })
}
