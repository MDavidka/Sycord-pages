// POST /api/syra/[projectId]/change
//
// Submit a change message to the Syte cloud runtime. Async by default: returns
// a request_id immediately. The browser then follows the turn on
// GET /api/syra/[projectId]/stream. Proxies to Syte's POST /sycord/api/agent_change.
//
// Body: { message: string, model_profile?: "syra-nano"|"syra-base"|"syra-havy", uuid?: string }

import { NextResponse } from "next/server"
import {
  isSyteConfigured,
  resolveUuid,
  sendAgentChange,
  SYRA_MODEL_PROFILES,
  type SyraModelProfile,
} from "@/lib/syra-agent"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

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

  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 })
  }

  const message = typeof body?.message === "string" ? body.message.trim() : ""
  if (!message) {
    return NextResponse.json({ ok: false, error: "missing_message" }, { status: 400 })
  }

  const uuid = resolveUuid(projectId, body?.uuid)
  if (!uuid) {
    return NextResponse.json({ ok: false, error: "missing_uuid" }, { status: 400 })
  }

  const rawProfile = typeof body?.model_profile === "string" ? body.model_profile : undefined
  const modelProfile = SYRA_MODEL_PROFILES.includes(rawProfile as SyraModelProfile)
    ? (rawProfile as SyraModelProfile)
    : undefined

  const result = await sendAgentChange(uuid, message, modelProfile)
  return NextResponse.json(result.data ?? { ok: result.ok, error: result.error }, {
    status: result.ok ? 200 : result.status,
  })
}
