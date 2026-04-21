import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { extractStyleComponents, readComponentSources, safeParseJsonBlock, type StyleJson } from "@/lib/ai-builder"

const XAI_API_URL = "https://api.x.ai/v1/chat/completions"
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
const DEFAULT_FUNCTION_MODEL = "grok-4-1-fast-non-reasoning"

const MODEL_CONFIGS: Record<string, { url: string; envVar: string; provider: string }> = {
  "grok-4-1-fast-non-reasoning": { url: XAI_API_URL, envVar: "XAI_API_KEY", provider: "xAI" },
  "openai/gpt-oss-20b:free": { url: OPENROUTER_API_URL, envVar: "OPENROUTER_API_KEY", provider: "OpenRouter" },
}

function resolveModel(model?: string) {
  const modelId = typeof model === "string" && model.trim() ? model.trim() : DEFAULT_FUNCTION_MODEL
  if (MODEL_CONFIGS[modelId]) {
    return { modelId, config: MODEL_CONFIGS[modelId] }
  }
  return { modelId: DEFAULT_FUNCTION_MODEL, config: MODEL_CONFIGS[DEFAULT_FUNCTION_MODEL] }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { style, messages, model } = await request.json() as { style: StyleJson; messages?: Array<{ content?: string }>; model?: string }
    if (!style?.root) {
      return NextResponse.json({ message: "Missing style.root" }, { status: 400 })
    }

    const { modelId, config } = resolveModel(model)
    const apiKey = process.env[config.envVar]
    if (!apiKey) {
      return NextResponse.json({ message: `AI service not configured (${config.provider})` }, { status: 500 })
    }

    const componentNames = Array.from(extractStyleComponents(style.root))
    const componentSources = await readComponentSources(componentNames)
    const { builderFunction } = await getSystemPrompts()
    const userRequest = Array.isArray(messages) ? messages[messages.length - 1]?.content || "" : ""

    const finalPrompt = builderFunction
      .replace("{{STYLE_JSON}}", JSON.stringify(style, null, 2))
      .replace("{{COMPONENT_SOURCES}}", JSON.stringify(componentSources, null, 2))
      .replace("{{REQUEST}}", userRequest)

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
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`${config.provider} API error ${response.status}: ${errText}`)
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
