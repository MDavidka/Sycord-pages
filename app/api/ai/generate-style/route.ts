import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { callJsonModel, parseJsonResponse } from "@/lib/ai-builder/llm"
import { createStyleJsonSchema } from "@/lib/ai-builder/schemas"
import { prepareInput } from "@/lib/ai-builder/validation-gate"
import type { StyleJson } from "@/lib/ai-builder/types"

const MAX_RETRIES = 3
const FALLBACK_PROMPT = `You are a UI layout architect. Given a user prompt and a component cheatsheet, output a VALID Style JSON tree.

Rules:
- Use ONLY component names from the cheatsheet array.
- Every node must have: id, component.
- id format: lowercase_component_000 (e.g. card_001, button_001).
- onClick values must be handler IDs in the format: handleAction_001.
- DO NOT write any JavaScript logic, state, or imports.
- Output ONLY valid JSON, no markdown, no explanation.`

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const rawPrompt = typeof body.prompt === "string" ? body.prompt : ""
    const { prompt, cheatsheet } = prepareInput(rawPrompt)
    const { builderCheatSheet } = await getSystemPrompts()
    const systemPrompt = builderCheatSheet || FALLBACK_PROMPT
    const schema = createStyleJsonSchema(cheatsheet)

    let lastError: unknown = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        const responseText = await callJsonModel({
          systemPrompt,
          userPayload: { prompt, cheatsheet },
          model: body.model,
          temperature: 0.15,
        })

        const rawOutput = parseJsonResponse<StyleJson>(responseText)
        const styleJson = schema.parse(rawOutput)

        return NextResponse.json({
          prompt,
          cheatsheet,
          styleJson,
        })
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Style generation failed")
  } catch (error: any) {
    console.error("[ai-builder] generate-style error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate style JSON" }, { status: 500 })
  }
}
