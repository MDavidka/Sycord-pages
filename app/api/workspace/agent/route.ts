/**
 * Syra → Syte cloud agent (VM agent) proxy.
 *
 * Syra does NOT generate with /api/ai/chat. Durable coding runs on the Syte
 * VM agent 24/7 via https://sycord.site/api/#agent.
 *
 * POST { action, projectId, ... }
 *   warm | change | settings | start | stop
 * GET  ?action=status|activity&projectId=...&since_id=
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import {
  isSyteConfigured,
  syteAgentActivity,
  syteAgentChange,
  syteAgentSettings,
  syteAgentStart,
  syteAgentStatus,
  syteAgentStop,
  syteAgentWarm,
  type SyteAgentModelProfile,
} from "@/lib/deploy/syte-client"
import {
  createSyteWorkspaceForProject,
  getStoredSyteUuid,
} from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const MODEL_PROFILES = new Set<SyteAgentModelProfile>(["syra-nano", "syra-base", "syra-havy"])

function normalizeModelProfile(value: unknown): SyteAgentModelProfile | undefined {
  if (typeof value !== "string") return undefined
  const raw = value.trim().toLowerCase()
  if (MODEL_PROFILES.has(raw as SyteAgentModelProfile)) {
    return raw as SyteAgentModelProfile
  }
  if (raw.includes("nano") || raw.includes("flash") || raw.includes("mimo")) return "syra-nano"
  if (raw.includes("havy") || raw.includes("heavy") || raw.includes("pro")) return "syra-havy"
  if (raw.includes("base") || raw.includes("deepseek")) return "syra-base"
  return undefined
}

async function resolveUuid(userId: string, projectId: string) {
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) return { db, project: null, uuid: null as string | null }

  let uuid = getStoredSyteUuid(project)
  if (!uuid) {
    const created = await createSyteWorkspaceForProject(db, userId, projectId, project)
    if (created.ok && created.data?.uuid) {
      uuid = created.data.uuid
    }
  }

  return { db, project, uuid }
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  if (!isSyteConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Syte VM agent is not configured. Set DEPLOYER_API_URL=https://sycord.site and DEPLOYER_API_KEY (syte_ token).",
      },
      { status: 503 },
    )
  }

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const action = String(body.action || "").trim()
  const projectId = String(body.projectId || "").trim()
  if (!action) return NextResponse.json({ ok: false, error: "Missing action" }, { status: 400 })
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing projectId" }, { status: 400 })
  }

  const { uuid } = await resolveUuid(userId, projectId)
  if (!uuid) {
    return NextResponse.json(
      {
        ok: false,
        error: "No Syte workspace UUID for this project. Open Syra once so the workspace can be created.",
        needsCreate: true,
      },
      { status: 409 },
    )
  }

  if (action === "warm") {
    const result = await syteAgentWarm(uuid)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, uuid }, { status: result.status || 502 })
    }
    return NextResponse.json({
      ok: true,
      uuid,
      status: (result.data as { status?: string } | null)?.status ?? "warming",
      already_warming: Boolean((result.data as { already_warming?: boolean } | null)?.already_warming),
      stream_path: `/api/workspace/agent/stream?projectId=${encodeURIComponent(projectId)}`,
    })
  }

  if (action === "start") {
    const result = await syteAgentStart(uuid)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, uuid }, { status: result.status || 502 })
    }
    return NextResponse.json({ ok: true, uuid, ...(result.data || {}) })
  }

  if (action === "stop") {
    const result = await syteAgentStop(uuid)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, uuid }, { status: result.status || 502 })
    }
    return NextResponse.json({ ok: true, uuid, ...(result.data as object) })
  }

  if (action === "settings") {
    const modelProfile = normalizeModelProfile(body.model_profile ?? body.modelProfile)
    if (!modelProfile) {
      return NextResponse.json(
        { ok: false, error: "model_profile must be syra-nano, syra-base, or syra-havy" },
        { status: 400 },
      )
    }
    const result = await syteAgentSettings(uuid, modelProfile)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, uuid }, { status: result.status || 502 })
    }
    return NextResponse.json({ ok: true, uuid, model_profile: modelProfile, ...(result.data as object) })
  }

  if (action === "change") {
    const message = typeof body.message === "string" ? body.message.trim() : ""
    if (!message) {
      return NextResponse.json({ ok: false, error: "Missing message" }, { status: 400 })
    }

    // Prefer a warm runtime before queuing work (non-blocking).
    void syteAgentWarm(uuid)

    const modelProfile = normalizeModelProfile(body.model_profile ?? body.modelProfile)
    const result = await syteAgentChange({
      uuid,
      message,
      ...(modelProfile ? { model_profile: modelProfile } : {}),
      wait: body.wait === true,
    })

    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, uuid }, { status: result.status || 502 })
    }

    const data = result.data
    return NextResponse.json({
      ok: true,
      uuid,
      request_id: data?.request_id ?? null,
      status: data?.status ?? "accepted",
      stream_url: data?.stream_url ?? null,
      stream_path: `/api/workspace/agent/stream?projectId=${encodeURIComponent(projectId)}`,
      reply: data?.reply ?? null,
      model_profile: data?.model_profile ?? modelProfile ?? null,
      change_applied: data?.change_applied ?? null,
    })
  }

  return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  if (!isSyteConfigured()) {
    return NextResponse.json(
      { ok: false, error: "Syte VM agent is not configured." },
      { status: 503 },
    )
  }

  const url = new URL(req.url)
  const action = (url.searchParams.get("action") || "status").trim()
  const projectId = (url.searchParams.get("projectId") || "").trim()
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "Missing projectId" }, { status: 400 })
  }

  const { uuid } = await resolveUuid(userId, projectId)
  if (!uuid) {
    return NextResponse.json(
      { ok: false, error: "No Syte workspace UUID for this project.", needsCreate: true },
      { status: 409 },
    )
  }

  if (action === "status") {
    const result = await syteAgentStatus(uuid)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, uuid }, { status: result.status || 502 })
    }
    return NextResponse.json({
      ok: true,
      uuid,
      ...(result.data || {}),
      stream_path: `/api/workspace/agent/stream?projectId=${encodeURIComponent(projectId)}`,
    })
  }

  if (action === "activity") {
    const sinceId = Number(url.searchParams.get("since_id") || "0") || 0
    const result = await syteAgentActivity(uuid, sinceId)
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error, uuid }, { status: result.status || 502 })
    }
    return NextResponse.json({
      ok: true,
      uuid,
      since_id: result.data?.since_id ?? sinceId,
      events: result.data?.events ?? [],
      stream_url: result.data?.stream_url ?? null,
      stream_path: `/api/workspace/agent/stream?projectId=${encodeURIComponent(projectId)}&since_id=${sinceId}`,
    })
  }

  return NextResponse.json({ ok: false, error: "action must be status or activity" }, { status: 400 })
}
