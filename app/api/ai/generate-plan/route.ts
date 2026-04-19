import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// Thinking/planning phase — fast path on Gemini Flash-Lite for all models
const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const PLAN_MODEL = "gemini-3.1-flash-lite-preview"

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
    const { messages, implementation, projectId } = await request.json()

    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      console.error("[v0] GOOGLE_AI_API / GOOGLE_API_KEY not configured")
      return NextResponse.json({ message: "AI service not configured (Gemini)" }, { status: 500 })
    }

    const lastUserMessage = messages[messages.length - 1]

    let integrationImplementation: any = null
    if (projectId) {
      try {
        const mongo = await clientPromise
        const db = mongo.db()
        const user = await db.collection("users").findOne(
          { "projects._id": new ObjectId(projectId) },
          { projection: { "projects.$": 1 } }
        )
        const project = user?.projects?.[0]
        if (Array.isArray(project?.envVars)) {
          const envVars = project.envVars
            .filter((v: any) => typeof v?.key === "string" && v.key.trim())
            .map((v: any) => ({
              env_key: v.key.trim(),
              integration: typeof v?.integration === "string" ? v.integration : null,
            }))
          integrationImplementation = {
            env_file: ".env",
            env_keys: Array.from(new Set(envVars.map((v: any) => v.env_key))),
            integration_bindings: envVars.filter((v: any) => !!v.integration),
          }
        }
      } catch (err) {
        console.warn("[v0] Failed to load project env context for planning:", err)
      }
    }

    const mergedImplementation = (() => {
      if (implementation && integrationImplementation) {
        if (typeof implementation === "object") {
          return { ...implementation, ...integrationImplementation }
        }
        return { user_implementation: implementation, ...integrationImplementation }
      }
      return implementation || integrationImplementation || null
    })()

    const implementationBlock = mergedImplementation
      ? `\n\n[IMPLEMENTATION JSON]\n${typeof mergedImplementation === "string" ? mergedImplementation : JSON.stringify(mergedImplementation, null, 2)}\n`
      : ""

    // Fetch Global Prompt
    const { builderPlan: systemContextTemplate, builderCheatSheet } = await getSystemPrompts()

    // Combine history for context
    const historyText = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")

    const finalPrompt = systemContextTemplate
        .replace("{{HISTORY}}", historyText)
        .replace("{{REQUEST}}", `${lastUserMessage.content}${implementationBlock}`)
      + `

You MUST output STYLE JSON ONLY (no markdown, no explanation).
STYLE JSON rules:
- include pageId, path, layout[]
- each interactive block must include unique id
- add blank function placeholders in props as string names where logic is needed (example: "__FN_handleMainClick__")

CHEAT_SHEET:
${builderCheatSheet || ""}
`

    console.log(`[AI Plan Generation] Generating style JSON with model: ${PLAN_MODEL}`)

    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: PLAN_MODEL,
        messages: [
          { role: "user", content: finalPrompt },
        ],
        temperature: 0.45,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`OpenRouter API error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content || ""
    const styleJson = tryParseJson(responseText)
    if (!styleJson) {
      throw new Error("Plan model did not return valid style JSON")
    }

    // Keep `instruction` for downstream compatibility.
    return NextResponse.json({
      instruction: JSON.stringify(styleJson, null, 2),
      styleJson,
      raw: responseText,
    })
  } catch (error: any) {
    console.error("[v0] Plan generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate plan" }, { status: 500 })
  }
}
