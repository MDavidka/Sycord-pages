// POST /api/syra/[projectId]/warm
//
// Non-blocking prewarm of the per-project Syte cloud runtime. Call this the
// moment a user opens the Syra chat so the runtime is warm before the first
// message. Proxies to Syte's POST /api/agent_warm with the server-side token.

import { NextResponse } from "next/server"
import { isSyteConfigured, resolveUuid, warmAgent } from "@/lib/syra-agent"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(
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

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }

  const uuid = resolveUuid(projectId, body?.uuid)
  if (!uuid) {
    return NextResponse.json({ ok: false, error: "missing_uuid" }, { status: 400 })
  }

  const result = await warmAgent(uuid)
  return NextResponse.json(result.data ?? { ok: result.ok, error: result.error }, {
    status: result.ok ? 200 : result.status,
  })
}
