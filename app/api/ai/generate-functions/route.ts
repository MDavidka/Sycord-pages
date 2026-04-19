import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"

const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const FUNCTION_MODEL = "gemini-3.1-flash-lite-preview"

function tryParseJson(text: string): any {
  const trimmed = (text || "").trim()
  if (!trimmed) return null
  try {
    return JSON.parse(trimmed)
  } catch {}

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {}
  }

  const objectMatch = trimmed.match(/\{[\s\S]*\}/)
  if (objectMatch?.[0]) {
    try {
      return JSON.parse(objectMatch[0])
    } catch {}
  }
  return null
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, styleJson } = await request.json()
    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured (Gemini)" }, { status: 500 })
    }

    const { builderFunction, builderCheatSheet } = await getSystemPrompts()
    const historyText = Array.isArray(messages)
      ? messages.map((m: any) => `${m.role?.toUpperCase?.() || "USER"}: ${m.content || ""}`).join("\n\n")
      : ""

    const finalPrompt = builderFunction
      .replace("{{CHEAT_SHEET}}", builderCheatSheet || "")

    const requestPrompt = `${finalPrompt}

[CONVERSATION HISTORY]
${historyText}

[STYLE JSON]
${typeof styleJson === "string" ? styleJson : JSON.stringify(styleJson, null, 2)}
`

    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: FUNCTION_MODEL,
        messages: [{ role: "user", content: requestPrompt }],
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Function generation error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content || ""
    const functionJson = tryParseJson(responseText)
    if (!functionJson) {
      throw new Error("Model did not return valid function JSON")
    }

    return NextResponse.json({ functionJson, raw: responseText })
  } catch (error: any) {
    console.error("[AI Function Generation] Error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate function JSON" }, { status: 500 })
  }
}

