import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { componentManifest } from "@/lib/syra/manifest"
import { StyleJsonSchema, FunctionJsonSchema } from "@/lib/syra/zod-schemas"
import { extractUsedComponents } from "@/lib/syra/orchestrator"

const DEVELOPER_MODEL = "gemini-3.1-pro-preview"
const MAX_RETRIES = 3

const SYSTEM_PROMPT = `You are a React logic developer. You receive:
1. A Style JSON tree describing the component structure.
2. The actual TypeScript source code of each used component.

Your job is to write ONLY the React logic needed to make the app work.

Output format (strict JSON, no markdown):
{
  "state": ["const [x, setX] = useState(initialValue)", ...],
  "handlers": {
    "handleXxx_001": "const handleXxx_001 = () => { ... }"
  },
  "render_injections": {
    "node_id": { "propName": "{expression}" }
  }
}

Rules:
- state: array of complete useState hook declaration strings.
- handlers: every onClick handler ID from the Style JSON must appear here as the key; the value is the full arrow-function definition string.
- render_injections: use "{expression}" (curly-brace wrapped) for dynamic values. Example: "children": "{count}"
- DO NOT redesign the layout. DO NOT add new components.
- Output ONLY valid JSON, no markdown, no code blocks, no explanation.`

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const validatedStyle = StyleJsonSchema.parse(body?.styleJson)

    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    // Stage 2 (Manifest Resolver) — gather sources for ONLY the used components
    const usedComponents = extractUsedComponents(validatedStyle.root as any)
    const componentSources = [...new Set(usedComponents)].map((name) => ({
      name,
      source: componentManifest[name] ?? "// source not available",
    }))

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: DEVELOPER_MODEL })

    const inputPayload = JSON.stringify({ styleJson: validatedStyle, componentSources })
    const fullPrompt = `${SYSTEM_PROMPT}\n\nINPUT:\n${inputPayload}`

    let lastError = ""
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const result = await model.generateContent(fullPrompt)
        const raw = result.response.text().trim()

        const jsonStr = raw
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim()

        const parsed = JSON.parse(jsonStr)
        const validated = FunctionJsonSchema.parse(parsed)
        return NextResponse.json({ functionJson: validated, componentSources, attempt })
      } catch (err: any) {
        lastError = err.message ?? "Validation failed"
      }
    }

    return NextResponse.json(
      { message: `Developer AI failed after ${MAX_RETRIES} attempts: ${lastError}` },
      { status: 422 },
    )
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
