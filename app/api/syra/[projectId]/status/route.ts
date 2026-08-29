// GET /api/syra/[projectId]/status[?uuid=]
//
// Status snapshot for the per-project Syte cloud runtime (running/stopped/
// starting/error + health). Proxies to Syte's GET /sycord/api/agent_status.

import { NextResponse } from "next/server"
import { getAgentStatus, isSyteConfigured, resolveUuid } from "@/lib/syra-agent"

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

  const override = new URL(req.url).searchParams.get("uuid")
  const uuid = resolveUuid(projectId, override)
  if (!uuid) {
    return NextResponse.json({ ok: false, error: "missing_uuid" }, { status: 400 })
  }

  const result = await getAgentStatus(uuid)
  return NextResponse.json(result.data ?? { ok: result.ok, error: result.error }, {
    status: result.ok ? 200 : result.status,
  })
}
