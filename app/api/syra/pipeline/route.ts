import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { componentManifest } from "@/lib/syra/manifest"
import { StyleJsonSchema, FunctionJsonSchema } from "@/lib/syra/zod-schemas"
import { extractUsedComponents, assemble, validateTsx } from "@/lib/syra/orchestrator"

const MODEL        = "gemini-3.1-pro-preview"
const MAX_RETRIES  = 3
const MAX_REPAIRS  = 3

// ---------------------------------------------------------------------------
// System prompts (inline to keep the route self-contained)
// ---------------------------------------------------------------------------

const ARCHITECT_PROMPT = `You are a UI layout architect. Given a user prompt and a component cheatsheet, output a VALID Style JSON tree.

Rules:
- Use ONLY component names from the cheatsheet array.
- Every node must have: id, component.
- id format: lowercase_000 (e.g. card_001, button_001). Only lowercase letters then underscore then 3 digits.
- onClick values: handleXxx_001 pattern (handle + UpperCamelCase + _ + 3 digits).
- DO NOT write JavaScript logic, state, or imports.
- Output ONLY valid JSON, no markdown, no code blocks, no explanation.`

const DEVELOPER_PROMPT = `You are a React logic developer. Receive a Style JSON tree and component source code, output ONLY the React logic.

Output format (strict JSON, no markdown):
{
  "state": ["const [x, setX] = useState(value)"],
  "handlers": { "handleXxx_001": "const handleXxx_001 = () => { ... }" },
  "render_injections": { "node_id": { "propName": "{expr}" } }
}

Rules:
- state: complete useState declaration strings.
- handlers: every onClick ID in the Style JSON must be a key here.
- render_injections: use "{expression}" for dynamic values.
- DO NOT redesign the layout or add new components.
- Output ONLY valid JSON, no markdown, no code blocks, no explanation.`

const REPAIR_PROMPT = `You are a React TypeScript expert. Fix the following TSX code so it compiles without errors.

ERRORS:
{{ERRORS}}

CURRENT TSX:
{{TSX}}

Output ONLY the corrected TSX file content, no markdown, no code blocks, no explanation.`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json|tsx|ts|typescript)?\s*/im, "")
    .replace(/\s*```$/m, "")
    .trim()
}

async function callGemini(apiKey: string, prompt: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: MODEL })
  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

// ---------------------------------------------------------------------------
// POST — SSE streaming pipeline
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!(session?.user as any)?.id) {
    return new Response(JSON.stringify({ message: "Unauthorized" }), { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const rawPrompt: string = body?.prompt ?? ""

  if (rawPrompt.trim().length < 5) {
    return new Response(JSON.stringify({ message: "Prompt too short" }), { status: 400 })
  }

  const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ message: "AI service not configured" }), { status: 500 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        // ----------------------------------------------------------------
        // STAGE 0 — Validation Gate
        // ----------------------------------------------------------------
        emit({ type: "stage", id: 0, name: "Validation Gate", status: "running" })
        const sanitizedPrompt = rawPrompt.trim().slice(0, 1000)
        const cheatsheet = Object.keys(componentManifest)
        emit({ type: "stage", id: 0, name: "Validation Gate", status: "done", detail: `${cheatsheet.length} components available` })

        // ----------------------------------------------------------------
        // STAGE 1 — Architect AI (Style JSON)
        // ----------------------------------------------------------------
        emit({ type: "stage", id: 1, name: "Architect AI", status: "running" })

        const architectInput = JSON.stringify({ prompt: sanitizedPrompt, cheatsheet })
        const architectFullPrompt = `${ARCHITECT_PROMPT}\n\nINPUT:\n${architectInput}`

        let styleJson: any = null
        let architectError = ""
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const raw = await callGemini(apiKey, architectFullPrompt)
            const parsed = JSON.parse(stripFences(raw))
            styleJson = StyleJsonSchema.parse(parsed)
            break
          } catch (err: any) {
            architectError = err.message ?? "Validation failed"
            emit({ type: "stage_retry", id: 1, attempt, error: architectError })
          }
        }

        if (!styleJson) {
          emit({ type: "stage", id: 1, name: "Architect AI", status: "error", detail: architectError })
          emit({ type: "error", message: `Architect AI failed: ${architectError}` })
          controller.close()
          return
        }

        emit({ type: "stage", id: 1, name: "Architect AI", status: "done", styleJson })

        // ----------------------------------------------------------------
        // STAGE 2 — Manifest Resolver (no AI)
        // ----------------------------------------------------------------
        emit({ type: "stage", id: 2, name: "Manifest Resolver", status: "running" })

        const usedComponents  = extractUsedComponents(styleJson.root)
        const componentSources = [...new Set(usedComponents)].map((name) => ({
          name,
          source: componentManifest[name] ?? "// source not available",
        }))

        emit({ type: "stage", id: 2, name: "Manifest Resolver", status: "done", detail: `${componentSources.length} component source(s) loaded` })

        // ----------------------------------------------------------------
        // STAGE 3 — Developer AI (Function JSON)
        // ----------------------------------------------------------------
        emit({ type: "stage", id: 3, name: "Developer AI", status: "running" })

        const developerInput = JSON.stringify({ styleJson, componentSources })
        const developerFullPrompt = `${DEVELOPER_PROMPT}\n\nINPUT:\n${developerInput}`

        let functionJson: any = null
        let developerError = ""
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            const raw = await callGemini(apiKey, developerFullPrompt)
            const parsed = JSON.parse(stripFences(raw))
            functionJson = FunctionJsonSchema.parse(parsed)
            break
          } catch (err: any) {
            developerError = err.message ?? "Validation failed"
            emit({ type: "stage_retry", id: 3, attempt, error: developerError })
          }
        }

        if (!functionJson) {
          emit({ type: "stage", id: 3, name: "Developer AI", status: "error", detail: developerError })
          emit({ type: "error", message: `Developer AI failed: ${developerError}` })
          controller.close()
          return
        }

        emit({ type: "stage", id: 3, name: "Developer AI", status: "done", functionJson })

        // ----------------------------------------------------------------
        // STAGE 4 — Orchestrator (deterministic TSX assembly)
        // ----------------------------------------------------------------
        emit({ type: "stage", id: 4, name: "Orchestrator", status: "running" })
        let tsx = assemble(styleJson, functionJson)
        emit({ type: "stage", id: 4, name: "Orchestrator", status: "done" })

        // ----------------------------------------------------------------
        // STAGE 5 — Build Gate + optional Repair Loop
        // ----------------------------------------------------------------
        emit({ type: "stage", id: 5, name: "Build Gate", status: "running" })

        let { valid, errors } = validateTsx(tsx)
        let repairCount = 0

        while (!valid && repairCount < MAX_REPAIRS) {
          repairCount++
          emit({ type: "stage_retry", id: 5, attempt: repairCount, error: errors.join("; ") })

          const repairPrompt = REPAIR_PROMPT
            .replace("{{ERRORS}}", errors.join("\n"))
            .replace("{{TSX}}", tsx)

          try {
            tsx = stripFences(await callGemini(apiKey, repairPrompt))
          } catch {
            break
          }

          ;({ valid, errors } = validateTsx(tsx))
        }

        emit({
          type:   "stage",
          id:     5,
          name:   "Build Gate",
          status: valid ? "done" : "warn",
          detail: valid ? "Validation passed" : `Warnings: ${errors.join("; ")}`,
        })

        // ----------------------------------------------------------------
        // STAGE 6 — Ready to Deploy
        // ----------------------------------------------------------------
        emit({ type: "stage", id: 6, name: "Ready to Deploy", status: "done", detail: "TSX generated — add to Pages to deploy" })

        // Final complete event
        emit({ type: "complete", tsx, styleJson, functionJson, valid, warnings: errors })
      } catch (err: any) {
        emit({ type: "error", message: err.message ?? "Pipeline failed" })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      Connection:      "keep-alive",
    },
  })
}
