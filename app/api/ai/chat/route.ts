// Legacy OpenAI-compatible chat route — superseded by Continue cloud agent.
// Kept temporarily so older clients get a clear migration error.

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(): Promise<Response> {
  return new Response(
    JSON.stringify({
      error:
        "Syra now uses the Continue cloud agent. Use POST /api/ai/agent instead of /api/ai/chat.",
    }),
    { status: 410, headers: { "Content-Type": "application/json" } },
  )
}
