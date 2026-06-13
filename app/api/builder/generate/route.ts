import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getAiClient, generate, type ProjectContextHandle } from "@/lib/syra/gemini"
import { GENERATION_PROMPT } from "@/lib/builder/generation-prompt"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Builder AI generation endpoint. Produces a complete JSON SiteConfig for the
 * drag-and-drop block builder from a natural-language prompt, using the same
 * Gemini/Vertex client the rest of Syra uses.
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let prompt = ""
  try {
    const body = await request.json()
    prompt = String(body?.prompt || "").trim()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }
  if (!prompt) return Response.json({ error: "A prompt is required" }, { status: 400 })
  if (prompt.length > 8000) return Response.json({ error: "Prompt is too long" }, { status: 400 })

  let client
  try {
    client = getAiClient()
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "AI not configured" }, { status: 500 })
  }

  // Minimal inline context handle (no Vertex cache needed for one-shot generation).
  const handle: ProjectContextHandle = {
    cacheName: null,
    cached: false,
    text: "",
    mode: client.mode,
    tokens: 0,
  }

  try {
    const response = await generate({
      client,
      handle,
      systemInstruction: GENERATION_PROMPT,
      contents: [{ role: "user", parts: [{ text: `Generate a website configuration for: ${prompt}` }] }],
      responseJson: true,
      temperature: 0.8,
      maxOutputTokens: 16384,
    })

    const text =
      (response as { text?: string }).text ??
      response.candidates?.[0]?.content?.parts?.map((p) => (p as { text?: string }).text || "").join("") ??
      ""

    if (!text) {
      return Response.json({ error: "Empty response from AI" }, { status: 502 })
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch {
      // Strip code fences if the model wrapped the JSON.
      const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim()
      parsed = JSON.parse(cleaned)
    }

    return Response.json(parsed, { status: 200 })
  } catch (err) {
    console.error("[builder/generate] failed", err)
    return Response.json({ error: err instanceof Error ? err.message : "Generation failed" }, { status: 500 })
  }
}
