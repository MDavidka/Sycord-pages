import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

const DEFAULT_SYCORD_BASE = "https://sycord.site"

function getSycordChatUrl() {
  const configuredBase = (process.env.DEPLOYER_API_URL || DEFAULT_SYCORD_BASE).replace(/\/+$/, "")
  const base = configuredBase.replace(/\/api\/?$/, "")
  const path = process.env.SYCORD_AI_CHAT_PATH || "/api/ai/chat"
  return `${base}${path.startsWith("/") ? path : `/${path}`}`
}

function buildSycordHeaders() {
  const headers: Record<string, string> = {
    Accept: "text/event-stream, application/json",
    "Content-Type": "application/json",
  }
  const apiKey = process.env.DEPLOYER_API_KEY
  if (apiKey) {
    headers["X-API-Key"] = apiKey
    headers.Authorization = `Bearer ${apiKey}`
  }
  return headers
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const rate = checkRateLimit(`ai-chat:${userId}`, { limit: 40, windowMs: 60_000 })
  if (!rate.allowed) {
    return Response.json(
      { error: "Too many AI requests. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!body || typeof body !== "object" || !Array.isArray((body as { messages?: unknown }).messages)) {
    return Response.json({ error: "Missing 'messages' array" }, { status: 400 })
  }

  if (!process.env.DEPLOYER_API_KEY) {
    return Response.json({ error: "Sycord API is not configured. Set DEPLOYER_API_KEY." }, { status: 503 })
  }

  try {
    const upstream = await fetch(getSycordChatUrl(), {
      method: "POST",
      headers: buildSycordHeaders(),
      body: JSON.stringify(body),
      signal: req.signal,
      cache: "no-store",
    })

    if (!upstream.ok) {
      const text = await upstream.text()
      let detail: unknown = text
      try { detail = JSON.parse(text) } catch { /* keep upstream text */ }
      return Response.json(
        { error: typeof detail === "object" && detail !== null ? (detail as { error?: string; message?: string }).error || (detail as { message?: string }).message || "Sycord AI request failed" : String(detail || "Sycord AI request failed") },
        { status: upstream.status },
      )
    }

    const headers = new Headers(upstream.headers)
    headers.set("Cache-Control", "no-cache, no-transform")
    headers.set("X-Accel-Buffering", "no")
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return new Response(null, { status: 499 })
    return Response.json({ error: error instanceof Error ? error.message : "Unable to reach Sycord AI." }, { status: 502 })
  }
}
