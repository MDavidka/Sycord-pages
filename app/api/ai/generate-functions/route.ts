import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { callJsonModel, parseJsonResponse } from "@/lib/ai-builder/llm"
import { FunctionJsonSchema, createStyleJsonSchema } from "@/lib/ai-builder/schemas"
import { buildDeveloperContext, collectHandlerIds } from "@/lib/ai-builder/manifest-resolver"
import { componentManifest } from "@/lib/ai-builder/manifest"
import type { FunctionJson, StyleJson } from "@/lib/ai-builder/types"

const MAX_RETRIES = 3
const FALLBACK_PROMPT = `You are a React logic developer. You receive:
1. A Style JSON tree describing the component structure.
2. The actual source code of each used component.

Your job is to write ONLY the React logic needed to make the app work.

Rules:
- state[]: valid useState hook declarations as strings.
- handlers: object, keys = onClick IDs from Style JSON.
- render_injections: object, keys = node IDs. Override props for that node.
- DO NOT redesign the layout. DO NOT add components.
- Output ONLY valid JSON.`

function validateHandlerCoverage(styleJson: StyleJson, functionJson: FunctionJson) {
  const requiredHandlers = collectHandlerIds(styleJson.root)
  const missingHandlers = requiredHandlers.filter((handlerId) => !functionJson.handlers[handlerId])

  if (missingHandlers.length > 0) {
    throw new Error(`Missing handler implementations: ${missingHandlers.join(", ")}`)
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const styleSchema = createStyleJsonSchema(Object.keys(componentManifest))
    const styleJson = styleSchema.parse(body.styleJson) as StyleJson
    const developerContext = buildDeveloperContext(styleJson)
    const { builderFunction } = await getSystemPrompts()
    const systemPrompt = builderFunction || FALLBACK_PROMPT

    let lastError: unknown = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
      try {
        const responseText = await callJsonModel({
          systemPrompt,
          userPayload: developerContext,
          model: body.model,
          temperature: 0.2,
        })

        const rawOutput = parseJsonResponse<FunctionJson>(responseText)
        const functionJson = FunctionJsonSchema.parse(rawOutput)
        validateHandlerCoverage(styleJson, functionJson)

        return NextResponse.json({
          functionJson,
        })
      } catch (error) {
        lastError = error
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Function generation failed")
  } catch (error: any) {
    console.error("[ai-builder] generate-functions error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate function JSON" }, { status: 500 })
  }
}
