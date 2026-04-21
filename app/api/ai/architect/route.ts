import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { logAiDebug } from "@/lib/logger"

// NOTE: Uses xAI API by default based on the model provided by frontend
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { prompt, model } = body

  await logAiDebug('Architect Request', { prompt, modelId: model?.id, provider: model?.provider })

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
      await logAiDebug('Architect API Error', { status: response.status, errText })
      return NextResponse.json({ message: "Architect API failed" }, { status: 500 })
    }

    const data = await response.json()
    await logAiDebug('Architect API Success', { choicesLength: data.choices?.length })
    let content = data.choices?.[0]?.message?.content || "[]"

    // Robust JSON extraction
    let jsonString = content;
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    } else {
      // Fallback: Find first [ or { and last ] or }
      const firstBracket = content.indexOf('[');
      const firstBrace = content.indexOf('{');
      const firstIndex = [firstBracket, firstBrace].filter(i => i >= 0).sort((a, b) => a - b)[0];

      const lastBracket = content.lastIndexOf(']');
      const lastBrace = content.lastIndexOf('}');
      const lastIndex = [lastBracket, lastBrace].filter(i => i >= 0).sort((a, b) => b - a)[0];

      if (firstIndex !== undefined && lastIndex !== undefined && lastIndex >= firstIndex) {
        jsonString = content.substring(firstIndex, lastIndex + 1);
      }
    }

    jsonString = jsonString.trim();

    let jsonPlan;
    try {
      jsonPlan = JSON.parse(jsonString)
      // Ensure the result is an array
      if (!Array.isArray(jsonPlan)) {
        jsonPlan = [jsonPlan];
      }
      await logAiDebug('Architect Parse Success', { pages: jsonPlan.length })
    } catch (e: any) {
      console.error("Failed to parse Architect JSON:", e, content)
      await logAiDebug('Architect Parse Error', { error: e.message, content })
      return NextResponse.json({ message: "Architect output invalid JSON" }, { status: 500 })
    }

    return NextResponse.json({ plan: jsonPlan })
  } catch (error: any) {
    console.error("Architect Error:", error)
    await logAiDebug('Architect Fatal Error', { error: error.message, stack: error.stack })
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
