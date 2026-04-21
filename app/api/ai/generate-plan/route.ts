import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { BUILDER_COMPONENT_CHEATSHEET, safeParseJsonBlock } from "@/lib/ai-builder"

const XAI_API_URL = "https://api.x.ai/v1/chat/completions"
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
const DEFAULT_PLAN_MODEL = "grok-4-1-fast-non-reasoning"

const MODEL_CONFIGS: Record<string, { url: string; envVar: string; provider: string }> = {
  "grok-4-1-fast-non-reasoning": { url: XAI_API_URL, envVar: "XAI_API_KEY", provider: "xAI" },
  "openai/gpt-oss-20b:free": { url: OPENROUTER_API_URL, envVar: "OPENROUTER_API_KEY", provider: "OpenRouter" },
}

function resolveModel(model?: string) {
  const modelId = typeof model === "string" && model.trim() ? model.trim() : DEFAULT_PLAN_MODEL
  if (MODEL_CONFIGS[modelId]) {
    return { modelId, config: MODEL_CONFIGS[modelId] }
  }
  return { modelId: DEFAULT_PLAN_MODEL, config: MODEL_CONFIGS[DEFAULT_PLAN_MODEL] }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, cheatsheet, model } = await request.json()
    const { modelId, config } = resolveModel(model)
    const apiKey = process.env[config.envVar]
    if (!apiKey) {
      return NextResponse.json({ message: `AI service not configured (${config.provider})` }, { status: 500 })
    }

    const finalCheatsheet = Array.isArray(cheatsheet) && cheatsheet.length > 0 ? cheatsheet : BUILDER_COMPONENT_CHEATSHEET
    const lastUserMessage = Array.isArray(messages) ? messages[messages.length - 1] : { content: "" }
    const { builderPlan, builderCheatSheet } = await getSystemPrompts()

    const finalPrompt = `${builderCheatSheet}\n\n${builderPlan}`
      .replace("{{REQUEST}}", lastUserMessage?.content || "")
      .replace("{{CHEATSHEET}}", JSON.stringify(finalCheatsheet))

    const headers: Record<string, string> = {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }
    if (config.provider === "OpenRouter") {
      headers["HTTP-Referer"] = process.env.NEXTAUTH_URL || "https://sycord.pages.dev"
      headers["X-Title"] = "Sycord AI Builder"
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: finalPrompt }],
        temperature: 0.25,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`${config.provider} API error ${response.status}: ${errText}`)
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
