import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"

// Thinking/planning phase — fast path on Gemini Flash-Lite for all models
const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const PLAN_MODEL = "gemini-3.1-flash-lite-preview"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages } = await request.json()

    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      console.error("[v0] GOOGLE_AI_API / GOOGLE_API_KEY not configured")
      return NextResponse.json({ message: "AI service not configured (Gemini)" }, { status: 500 })
    }

    const lastUserMessage = messages[messages.length - 1]

    // Fetch Global Prompt
    const { builderPlan: systemContextTemplate } = await getSystemPrompts()

    // Combine history for context
    const historyText = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")

    const finalPrompt = systemContextTemplate
        .replace("{{HISTORY}}", historyText)
        .replace("{{REQUEST}}", lastUserMessage.content)

    console.log(`[v0] Generating plan with Gemini model: ${PLAN_MODEL}`)

    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PLAN_MODEL,
        messages: [
          { role: "user", content: finalPrompt },
        ],
        temperature: 0.45,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenRouter API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content || ""

    // Return the raw instruction text
    return NextResponse.json({
      instruction: responseText,
    })
  } catch (error: any) {
    console.error("[v0] Plan generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate plan" }, { status: 500 })
  }
}
