import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"

// NOTE: Uses xAI API by default based on the model provided by frontend
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { prompt, model } = body

  if (!prompt) {
    return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
  }

  try {
    const prompts = await getSystemPrompts()

    let apiUrl = "https://api.x.ai/v1/chat/completions"
    let apiKey = process.env.XAI_API_KEY

    if (model?.provider === "OpenRouter") {
      apiUrl = "https://openrouter.ai/api/v1/chat/completions"
      apiKey = process.env.OPENROUTER_API_KEY
    }

    if (!apiKey) {
      return NextResponse.json({ message: "API key not configured" }, { status: 500 })
    }

    const messages = [
      {
        role: "system",
        content: `${prompts.builderPlan}\n\nHere is your UI Component Cheat Sheet (Available Components):\n${prompts.builderCheatSheet}`
      },
      {
        role: "user",
        content: `Create a frontend UI JSON plan for: ${prompt}`
      }
    ]

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model?.id || "grok-4-1-fast-non-reasoning",
        messages: messages,
        temperature: 0.1,
      })
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error("Architect AI API Error:", errText)
      return NextResponse.json({ message: "Architect API failed" }, { status: 500 })
    }

    const data = await response.json()
    let content = data.choices?.[0]?.message?.content || "[]"

    // Sanitize in case it includes markdown ticks
    content = content.replace(/```json/g, '').replace(/```/g, '').trim()

    let jsonPlan;
    try {
      jsonPlan = JSON.parse(content)
    } catch (e) {
      console.error("Failed to parse Architect JSON:", e, content)
      return NextResponse.json({ message: "Architect output invalid JSON" }, { status: 500 })
    }

    return NextResponse.json({ plan: jsonPlan })
  } catch (error) {
    console.error("Architect Error:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
