const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const DEFAULT_MODEL = "gemini-3.1-flash"

function cleanJsonBlock(text: string): string {
  const trimmed = text.trim()
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenceMatch) {
    return fenceMatch[1].trim()
  }
  return trimmed
}

export function parseJsonResponse<T>(content: string): T {
  const normalized = cleanJsonBlock(content)
  return JSON.parse(normalized) as T
}

export async function callJsonModel(options: {
  systemPrompt: string
  userPayload: unknown
  model?: string
  temperature?: number
}): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    throw new Error("AI service not configured (Gemini)")
  }

  const response = await fetch(GOOGLE_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model || DEFAULT_MODEL,
      temperature: options.temperature ?? 0.2,
      messages: [
        { role: "system", content: options.systemPrompt },
        { role: "user", content: JSON.stringify(options.userPayload) },
      ],
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (!content || typeof content !== "string") {
    throw new Error("Empty model response")
  }

  return content
}
