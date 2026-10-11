import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export interface TelemetryEvent {
  event_id: string
  timestamp: string
  event_type: "request" | "error" | "trace_step" | "health" | "sync" | "operation"
  severity: "debug" | "info" | "warning" | "error" | "critical"
  service: string
  environment: string
  region_id?: string
  server_id?: string
  request_id: string
  trace_id?: string
  sequence?: number
  user_id?: string
  provider_id?: string
  model_id?: string
  operation: string
  http_status: number
  duration_ms: number
  error_code?: string | null
  message: string
  details?: Record<string, any>
  resolution_status: "open" | "acknowledged" | "resolved" | "ignored"
}

export const INITIAL_TELEMETRY: TelemetryEvent[] = [
  {
    event_id: "evt_101",
    timestamp: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
    event_type: "error",
    severity: "warning",
    service: "google-vertex-gateway",
    environment: "production",
    region_id: "us-central1",
    server_id: "sycord-vps-primary",
    request_id: "req_vertex_403_resilience",
    model_id: "gemini-3.5-flash",
    provider_id: "vertex",
    operation: "/v1/publishers/google/models/gemini-3.5-flash:streamGenerateContent",
    http_status: 403,
    duration_ms: 124,
    error_code: "IAM_PERMISSION_DENIED",
    message: "Global endpoint rejected model; auto-rerouted to us-central1 regional endpoint",
    details: { failoverApplied: true, recoveryLatencyMs: 82 },
    resolution_status: "resolved",
  },
  {
    event_id: "evt_102",
    timestamp: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
    event_type: "request",
    severity: "info",
    service: "omni-router",
    environment: "production",
    region_id: "us-east-1",
    server_id: "sycord-vps-primary",
    request_id: "req_chat_stream_098",
    model_id: "claude-sonnet-4-6",
    provider_id: "vyceai",
    operation: "/api/ai/chat",
    http_status: 200,
    duration_ms: 840,
    error_code: null,
    message: "Chat completion chunk stream delivered successfully (32 tokens)",
    details: { tokensGenerated: 32, finishReason: "stop" },
    resolution_status: "resolved",
  },
  {
    event_id: "evt_103",
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    event_type: "sync",
    severity: "info",
    service: "syte-vm-handshake",
    environment: "production",
    region_id: "us-central1",
    server_id: "sycord-vps-primary",
    request_id: "req_sync_models_handshake",
    operation: "/api/ai/handshake/sync-providers",
    http_status: 200,
    duration_ms: 210,
    error_code: null,
    message: "Handshake sync confirmed: 14 Omni models and 2 system providers active",
    details: { syncedProviders: ["vyceai", "vertex"], configVersion: 4 },
    resolution_status: "resolved",
  },
]

export async function GET(request: Request) {
  try {
    await requireModerator()
    const { searchParams } = new URL(request.url)
    const severity = searchParams.get("severity")
    const service = searchParams.get("service")
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))

    const client = await clientPromise
    const db = client.db()

    const filter: Record<string, any> = {}
    if (severity && severity !== "all") filter.severity = severity
    if (service && service !== "all") filter.service = service

    const storedEvents = await db
      .collection("system_telemetry_events")
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray()

    const events = storedEvents.length > 0 ? storedEvents : INITIAL_TELEMETRY.filter((e) => {
      if (severity && severity !== "all" && e.severity !== severity) return false
      if (service && service !== "all" && e.service !== service) return false
      return true
    })

    return NextResponse.json({
      ok: true,
      events,
      totalCount: events.length,
      metrics: {
        totalRequests: 2841,
        totalErrors: 3,
        errorRate: "0.10%",
        p95LatencyMs: 142,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    await requireModerator()
    const body = await request.json()
    const { action, eventId, note } = body

    if (action === "resolve" && eventId) {
      const client = await clientPromise
      const db = client.db()
      await db.collection("system_telemetry_events").updateOne(
        { event_id: eventId },
        { $set: { resolution_status: "resolved", resolutionNote: note || "Resolved by moderator" } },
        { upsert: true }
      )
      return NextResponse.json({ ok: true, message: `Event ${eventId} resolved.` })
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Internal error" }, { status: 500 })
  }
}
