import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { BUILDER_COMPONENT_CHEATSHEET, safeParseJsonBlock } from "@/lib/ai-builder"

const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const PLAN_MODEL = "gemini-3.1-flash-lite-preview"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, cheatsheet } = await request.json()
    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured (Gemini)" }, { status: 500 })
    }

    const finalCheatsheet = Array.isArray(cheatsheet) && cheatsheet.length > 0 ? cheatsheet : BUILDER_COMPONENT_CHEATSHEET
    const lastUserMessage = Array.isArray(messages) ? messages[messages.length - 1] : { content: "" }
    const { builderPlan, builderCheatSheet } = await getSystemPrompts()

    const finalPrompt = `${builderCheatSheet}\n\n${builderPlan}`
      .replace("{{REQUEST}}", lastUserMessage?.content || "")
      .replace("{{CHEATSHEET}}", JSON.stringify(finalCheatsheet))

    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PLAN_MODEL,
        messages: [{ role: "user", content: finalPrompt }],
        temperature: 0.25,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Gemini API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content || ""
    const style = safeParseJsonBlock(responseText)

    return NextResponse.json({
      style,
      instruction: JSON.stringify(style, null, 2),
      cheatsheet: finalCheatsheet,
    })
  } catch (error: any) {
    console.error("[AI builder] Style generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate style JSON" }, { status: 500 })
  }
}
