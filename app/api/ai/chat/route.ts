// AI endpoint for the Glovix builder — backed by Google Gemini on Vertex AI.
//
// The Glovix client posts OpenAI-compatible chat-completion requests (streaming,
// with `tools` / `tool_calls`) to `/api/ai/chat`. Instead of forwarding to an
// external OpenAI-compatible "Vite AI" endpoint, this handler runs the request
// on Gemini Vertex AI (the same engine the previous "Syra" builder used) and
// streams the response back in OpenAI-compatible SSE so the client is unchanged.
//
// Configure via env (see .env.example):
//   GOOGLE_VERTEX_PROJECT / GOOGLE_VERTEX_LOCATION  -> full Vertex AI (ADC)
//   GOOGLE_AIAGENT_API                              -> API key (express/dev API)
//   GOOGLE_AIAGENT_MODEL                            -> model (default gemini-3.5-flash)

import { isConfigured, streamOpenAICompatible } from "@/lib/glovix-gemini"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

export async function POST(req: Request) {
  if (!isConfigured()) {
    return new Response(
      JSON.stringify({
        error:
          "Gemini is not configured. Set GOOGLE_VERTEX_PROJECT (Vertex AI) or GOOGLE_AIAGENT_API in your environment.",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const messages = Array.isArray(body?.messages) ? body.messages : null
  if (!messages) {
    return new Response(JSON.stringify({ error: "Missing 'messages' array" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  return streamOpenAICompatible({
    messages,
    tools: body?.tools,
    temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
    maxOutputTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
    model: typeof body?.model === "string" ? body.model : undefined,
  })
}
