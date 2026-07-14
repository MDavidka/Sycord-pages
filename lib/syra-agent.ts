// Server-side Syte agent client for Syra.
//
// This is the rebuilt Syra backend. Instead of running a client-side agent loop
// against a raw chat-completions endpoint, Syra now delegates the whole coding
// turn to the Syte cloud runtime and consumes its durable activity stream,
// exactly as documented at https://sycord.site/api/#agent.
//
// The browser never talks to Syte directly (it can't set an Authorization
// header on an EventSource, and the API key must stay on the server). Instead
// the Next.js routes in app/api/syra/[projectId]/* use the helpers here to:
//
//   1. warm the per-project runtime          POST {base}/api/agent_warm
//   2. submit a change (async, returns id)    POST {base}/sycord/api/agent_change
//   3. read a status snapshot                 GET  {base}/sycord/api/agent_status
//   4. proxy the live activity SSE stream     GET  {base}/api/projects/{uuid}/agent/activity/stream
//
// Turn lifecycle emitted on the stream (correlate by payload.request_id):
//   request_started → processing → thinking? → (tool_call_started/finished)* →
//   request_completed | request_failed
//
// Configuration (see .env.example — reuses the existing Syte token):
//   SYTE_API_URL / DEPLOYER_API_URL   base URL, e.g. https://sycord.site
//   SYTE_API_KEY / DEPLOYER_API_KEY   token, prefix syte_ (X-API-Key / Bearer)

export type SyraModelProfile = "syra-nano" | "syra-base" | "syra-havy"

export const SYRA_MODEL_PROFILES: SyraModelProfile[] = ["syra-nano", "syra-base", "syra-havy"]

const DEFAULT_BASE_URL = "https://sycord.site"

export interface SyteConfig {
  baseUrl: string
  apiKey: string
}

/** Resolve the Syte base URL + API key from env, preferring SYTE_* then DEPLOYER_*. */
export function readSyteConfig(): SyteConfig {
  const rawBase =
    process.env.SYTE_API_URL ||
    process.env.DEPLOYER_API_URL ||
    DEFAULT_BASE_URL
  const apiKey = process.env.SYTE_API_KEY || process.env.DEPLOYER_API_KEY || ""
  // Normalise: strip a trailing slash so we can concatenate paths safely.
  const baseUrl = rawBase.replace(/\/+$/, "")
  return { baseUrl, apiKey }
}

export function isSyteConfigured(): boolean {
  const { baseUrl, apiKey } = readSyteConfig()
  return !!baseUrl && !!apiKey
}

function authHeaders(apiKey: string): Record<string, string> {
  // Syte accepts the same token as X-API-Key or Bearer. We send both so the
  // request works against external (/api/agent_*) and sycord public
  // (/sycord/api/*) routes alike.
  return {
    "X-API-Key": apiKey,
    Authorization: `Bearer ${apiKey}`,
  }
}

/**
 * Normalise a project identifier into the Syte workspace uuid. The dashboard
 * uses its own site id; callers may pass an explicit override via the request.
 * By default we treat the project id as the uuid.
 */
export function resolveUuid(projectId: string, override?: string | null): string {
  const uuid = (override || projectId || "").trim()
  return uuid
}

export interface SyteResult<T = any> {
  ok: boolean
  status: number
  data: T | null
  error?: string
}

async function postJson<T = any>(
  path: string,
  body: Record<string, unknown>,
): Promise<SyteResult<T>> {
  const { baseUrl, apiKey } = readSyteConfig()
  if (!baseUrl || !apiKey) {
    return { ok: false, status: 503, data: null, error: "syte_not_configured" }
  }
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...authHeaders(apiKey),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    })
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    if (!res.ok) {
      const error =
        data?.error || data?.message || `HTTP ${res.status}: ${text.slice(0, 200)}`
      return { ok: false, status: res.status, data, error }
    }
    return { ok: true, status: res.status, data }
  } catch (err: any) {
    const message = err?.name === "TimeoutError" ? "timeout" : err?.message || "request_failed"
    return { ok: false, status: 502, data: null, error: message }
  }
}

async function getJson<T = any>(path: string): Promise<SyteResult<T>> {
  const { baseUrl, apiKey } = readSyteConfig()
  if (!baseUrl || !apiKey) {
    return { ok: false, status: 503, data: null, error: "syte_not_configured" }
  }
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", ...authHeaders(apiKey) },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    })
    const text = await res.text()
    let data: any = null
    try {
      data = text ? JSON.parse(text) : null
    } catch {
      data = { raw: text }
    }
    if (!res.ok) {
      const error =
        data?.error || data?.message || `HTTP ${res.status}: ${text.slice(0, 200)}`
      return { ok: false, status: res.status, data, error }
    }
    return { ok: true, status: res.status, data }
  } catch (err: any) {
    const message = err?.name === "TimeoutError" ? "timeout" : err?.message || "request_failed"
    return { ok: false, status: 502, data: null, error: message }
  }
}

// ---------------------------------------------------------------------------
// Lifecycle controls
// ---------------------------------------------------------------------------

/**
 * Non-blocking prewarm. Recommended when a user opens a project/chat: it returns
 * immediately while the Syte cloud runtime starts in the background. Repeated
 * calls are deduplicated by Syte.
 */
export function warmAgent(uuid: string): Promise<SyteResult> {
  return postJson("/api/agent_warm", { uuid })
}

/** Status snapshot: running/stopped/starting/error + runtime health. */
export function getAgentStatus(uuid: string): Promise<SyteResult> {
  return getJson(`/sycord/api/agent_status?uuid=${encodeURIComponent(uuid)}`)
}

export interface AgentChangeResult {
  ok: boolean
  request_id?: string
  status?: string
  stream_url?: string
  change_applied?: unknown
}

/**
 * Submit a change message (async by default). Returns a request_id immediately;
 * subscribe to the activity stream to follow the turn. Correlate every streamed
 * frame by payload.request_id.
 */
export function sendAgentChange(
  uuid: string,
  message: string,
  modelProfile?: SyraModelProfile,
): Promise<SyteResult<AgentChangeResult>> {
  const body: Record<string, unknown> = { uuid, message }
  if (modelProfile) body.model_profile = modelProfile
  return postJson<AgentChangeResult>("/sycord/api/agent_change", body)
}

// ---------------------------------------------------------------------------
// Activity stream proxy
// ---------------------------------------------------------------------------

export interface ActivityStreamOptions {
  sinceId?: number
  /** sse | tagged | text | jsonl — defaults to tagged for the browser client. */
  format?: "sse" | "tagged" | "text" | "jsonl"
  /** Comma-separated event_type allow-list (tagged/text/jsonl only). */
  types?: string
  signal?: AbortSignal
}

/**
 * Open the upstream durable activity SSE stream and return the raw Response so a
 * Next.js route can pipe it straight to the browser. The api key is injected
 * here (server-side) via the x-api-key header, which the browser EventSource
 * cannot do. On connect Syte replays persisted events with id > sinceId, then
 * stays open and forwards live events — so resuming with the last seen id
 * recovers every missed event with no gaps and no duplicates.
 */
export async function openActivityStream(
  uuid: string,
  opts: ActivityStreamOptions = {},
): Promise<Response> {
  const { baseUrl, apiKey } = readSyteConfig()
  const params = new URLSearchParams({ live: "1" })
  params.set("format", opts.format || "tagged")
  if (opts.sinceId && opts.sinceId > 0) params.set("since_id", String(opts.sinceId))
  if (opts.types) params.set("types", opts.types)

  const url = `${baseUrl}/api/projects/${encodeURIComponent(uuid)}/agent/activity/stream?${params.toString()}`

  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      "Cache-Control": "no-cache",
      ...authHeaders(apiKey),
    },
    signal: opts.signal,
    cache: "no-store",
  })
}
