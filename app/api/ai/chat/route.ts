// AI proxy for the Glovix builder.
//
// The Glovix client posts OpenAI-compatible chat-completion requests (with
// `stream: true`) to `/api/ai/chat`. In the original Vite app this path was a
// dev-server proxy to `VITE_AI_ENDPOINT`. Here we replicate that behaviour as a
// Next.js route handler so the upstream endpoint and API key stay server-side.
//
// Configure via env:
//   AI_ENDPOINT  – full OpenAI-compatible chat-completions URL
//   AI_API_KEY   – bearer token injected when the client does not send one
//
// The client may also send its own `Authorization` header (set from the
// in-app Settings → AI panel); when present and non-placeholder it takes
// precedence over the server key.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_ENDPOINT = "https://api.openai.com/v1/chat/completions"

function resolveAuthorization(req: Request): string | null {
  const incoming = req.headers.get("authorization")
  const isUsable =
    incoming &&
    incoming.trim() !== "" &&
    incoming.trim().toLowerCase() !== "bearer" &&
    !incoming.includes("your_api_key_here")

  if (isUsable) return incoming

  const serverKey = process.env.AI_API_KEY
  if (serverKey && serverKey !== "your_api_key_here") {
    return `Bearer ${serverKey}`
  }
  return null
}

export async function POST(req: Request) {
  const endpoint = process.env.AI_ENDPOINT || DEFAULT_ENDPOINT
  const authorization = resolveAuthorization(req)

  if (!authorization) {
    return new Response(
      JSON.stringify({
        error:
          "Missing API key. Set AI_API_KEY in your environment, or configure a provider key in Settings → AI.",
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    )
  }

  let body: string
  try {
    body = await req.text()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  let upstream: Response
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authorization,
      },
      body,
      // @ts-expect-error - duplex is required by undici for streaming bodies
      duplex: "half",
    })
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Upstream request failed: ${err?.message || "unknown error"}` }),
      { status: 502, headers: { "Content-Type": "application/json" } },
    )
  }

  // Stream the upstream response straight back to the client, preserving the
  // SSE content type so the Glovix stream parser keeps working.
  const headers = new Headers()
  const contentType = upstream.headers.get("content-type")
  if (contentType) headers.set("Content-Type", contentType)
  headers.set("Cache-Control", "no-cache, no-transform")

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}
