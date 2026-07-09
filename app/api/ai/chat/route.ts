// Legacy endpoint retained only for backward compatibility messaging.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(): Promise<Response> {
  return new Response(
    JSON.stringify({
      error: 'Syra chat UI now uses POST /api/ai/agent. The model backend remains Gemini Vertex / DeepSeek via /api/continue/v1/chat/completions.',
    }),
    { status: 410, headers: { 'Content-Type': 'application/json' } },
  )
}
