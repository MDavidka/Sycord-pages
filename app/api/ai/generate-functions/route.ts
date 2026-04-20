import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { extractStyleComponents, readComponentSources, safeParseJsonBlock, type StyleJson } from "@/lib/ai-builder"

const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const FUNCTION_MODEL = "gemini-3.1-pro-preview"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { style, messages } = await request.json() as { style: StyleJson; messages?: Array<{ content?: string }> }
    if (!style?.root) {
      return NextResponse.json({ message: "Missing style.root" }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured (Gemini)" }, { status: 500 })
    }

    const componentNames = Array.from(extractStyleComponents(style.root))
    const componentSources = await readComponentSources(componentNames)
    const { builderFunction } = await getSystemPrompts()
    const userRequest = Array.isArray(messages) ? messages[messages.length - 1]?.content || "" : ""

    const finalPrompt = builderFunction
      .replace("{{STYLE_JSON}}", JSON.stringify(style, null, 2))
      .replace("{{COMPONENT_SOURCES}}", JSON.stringify(componentSources, null, 2))
      .replace("{{REQUEST}}", userRequest)

    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FUNCTION_MODEL,
        messages: [{ role: "user", content: finalPrompt }],
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Gemini API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content || ""
    const functions = safeParseJsonBlock(responseText)

    return NextResponse.json({
      functions,
      componentSources,
    })
  } catch (error: any) {
    console.error("[AI builder] Function generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate function JSON" }, { status: 500 })
  }
}
