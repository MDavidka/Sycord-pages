import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { componentManifest } from "@/lib/syra/manifest"
import { StyleJsonSchema } from "@/lib/syra/zod-schemas"

const ARCHITECT_MODEL = "gemini-3.1-pro-preview"
const MAX_RETRIES = 3

const SYSTEM_PROMPT = `You are a UI layout architect. Given a user prompt and a component cheatsheet, output a VALID Style JSON tree.

Rules:
- Use ONLY component names from the cheatsheet array.
- Every node must have: id, component.
- id format: lowercase_000 (e.g. card_001, button_001, cardheader_001). Only lowercase letters then underscore then three digits — no spaces, no hyphens.
- onClick values must be handler IDs in the format: handleAction_001 (handle + UpperCamelCase + underscore + 3 digits).
- DO NOT write any JavaScript logic, state, or imports.
- Output ONLY valid JSON, no markdown, no code blocks, no explanation.
- The root must be a single container element.`

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const rawPrompt: string = body?.prompt ?? ""

    if (rawPrompt.trim().length < 5) {
      return NextResponse.json({ message: "Prompt too short (min 5 chars)" }, { status: 400 })
    }

    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    const sanitizedPrompt = rawPrompt.trim().slice(0, 1000)
    const cheatsheet = Object.keys(componentManifest)

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: ARCHITECT_MODEL })

    const inputPayload = JSON.stringify({ prompt: sanitizedPrompt, cheatsheet })
    const fullPrompt = `${SYSTEM_PROMPT}\n\nINPUT:\n${inputPayload}`

    let lastError = ""
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(fullPrompt)
        const raw = result.response.text().trim()

        // Strip markdown fences if the model wraps the output
        const jsonStr = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim()

        const parsed = JSON.parse(jsonStr)
        const validated = StyleJsonSchema.parse(parsed)
        return NextResponse.json({ styleJson: validated, attempt })
      } catch (err: any) {
        lastError = err.message ?? "Validation failed"
      }
    }

    return NextResponse.json(
      { message: `Architect AI failed after ${MAX_RETRIES} attempts: ${lastError}` },
      { status: 422 },
    )
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
