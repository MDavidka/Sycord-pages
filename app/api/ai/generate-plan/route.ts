import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
const PLAN_MODEL = "liquid/lfm-2.5-1.2b-thinking:free"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages } = await request.json()

    // Use OpenRouter API key for the thinking model
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey) {
      console.error("[v0] OPENROUTER_API_KEY not configured")
      return NextResponse.json({ message: "AI service not configured (OpenRouter)" }, { status: 500 })
    }

    const lastUserMessage = messages[messages.length - 1]

    // Fetch Global Prompt
    const { builderPlan: systemContextTemplate } = await getSystemPrompts()

    // Combine history for context
    const historyText = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")

    const finalPrompt = systemContextTemplate
        .replace("{{HISTORY}}", historyText)
        .replace("{{REQUEST}}", lastUserMessage.content)

    console.log(`[v0] Generating plan with OpenRouter model: ${PLAN_MODEL}`)

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXTAUTH_URL || "https://sycord.com",
        "X-Title": "Sycord",
      },
      body: JSON.stringify({
        model: PLAN_MODEL,
        messages: [
          { role: "system", content: finalPrompt },
          { role: "user", content: lastUserMessage.content },
        ],
        temperature: 0.3,
      }),
    })

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "")
      console.error(`[v0] OpenRouter plan API error ${response.status}:`, errorBody)
      throw new Error(`Plan generation failed (OpenRouter ${response.status})`)
    }

    const data = await response.json()
    // Thinking models may return reasoning separately; we want the final content
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
