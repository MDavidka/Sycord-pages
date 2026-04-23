import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { logAiDebug } from "@/lib/logger"
import { callModel, extractJson, type ModelSelection } from "@/lib/ai-provider"
import fs from "fs"
import path from "path"

// Stage 2 of the pipeline: "Raw JSON for style".
//
// For a single page from the plan, ask the selected model to produce a UI
// tree JSON that strictly follows:
//   - the shadcn/ui component catalogue in cheat_sheat.json
//   - the generator contract documented in generation.md
//
// The output is fed unchanged to the deterministic converter
// (sample-conveter.ts). Dynamic props reference $state.* and $handler.* — the
// logic stage fills in those handler bodies.

function readHelperFile(fileName: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), fileName), "utf-8")
  } catch {
    return ""
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    page?: { path?: string; title?: string; description?: string }
    prompt?: string
    model?: ModelSelection
  }
  const { page, prompt, model } = body

  if (!page?.title || !page?.path) {
    return NextResponse.json({ message: "page { path, title } is required" }, { status: 400 })
  }
  if (!model?.id || !model?.provider) {
    return NextResponse.json({ message: "Model selection is required" }, { status: 400 })
  }

  await logAiDebug("Style Request", {
    page,
    modelId: model.id,
    provider: model.provider,
  })

  const prompts = await getSystemPrompts()
  const generationGuide = readHelperFile("generation.md")
  const cheatSheet = readHelperFile("cheat_sheat.json")

  const messages = [
    {
      role: "system" as const,
      content: `You are the "Style JSON" stage of a deterministic web-app build pipeline.

Your only job is to emit a single JSON UI tree describing the visual layout of ONE page. A deterministic converter will turn this JSON into .tsx — so follow the contract exactly.

STRICT CONTRACT (from generation.md):
${generationGuide || "No generation.md available"}

COMPONENT CATALOGUE — you MUST only use components listed here (anything else will fail the converter):
${cheatSheet || prompts.builderCheatSheet}

OUTPUT FORMAT:
Return ONLY a raw JSON object (no markdown, no prose, no code fence). The root shape is:
{
  "type": "ui-tree",
  "version": "1.0",
  "component": { "name": "...", "props": { ... }, "children": [ ... ] }
}

RULES:
- Use component names EXACTLY as they appear in the catalogue (PascalCase) or standard HTML tags (div, span, p, h1…h6, a, img, ul, li, section, header, footer, main, nav, form, etc.).
- Dynamic values use "$state.<name>" / "$handler.<name>" strings. Never invent JSX or raw code inside the JSON.
- className strings should use Tailwind utility classes consistent with a modern dark-mode shadcn/ui aesthetic.
- Keep the tree rich enough to look complete (hero, content, footer etc. where appropriate) but do not add components not in the catalogue.
- No comments inside the JSON.`,
    },
    {
      role: "user" as const,
      content: `Overall website brief: ${prompt ?? "(no extra context)"}

Generate the UI tree JSON for this page:
- path: ${page.path}
- title: ${page.title}
- description: ${page.description ?? "(no description)"}

Return only the JSON object described in the contract.`,
    },
  ]

  const result = await callModel({
    model,
    messages,
    temperature: 0.1,
  })

  if (!result.ok) {
    await logAiDebug("Style API Error", {
      status: result.status,
      message: result.message,
      details: result.details,
    })
    return NextResponse.json(
      { message: result.message, details: result.details },
      { status: result.status },
    )
  }

  const parsed = extractJson<unknown>(result.content)
  if (!parsed || typeof parsed !== "object") {
    await logAiDebug("Style Parse Error", { content: result.content })
    return NextResponse.json(
      { message: "AI failed to produce a valid style JSON tree." },
      { status: 422 },
    )
  }

  // The converter requires either the {type,component} envelope or at least a
  // bare node. Normalize both shapes to the envelope here.
  const envelope = parsed as Record<string, unknown>
  const tree =
    typeof envelope.component === "object" && envelope.component
      ? envelope
      : { type: "ui-tree", version: "1.0", component: parsed }

  await logAiDebug("Style Parse Success", { path: page.path })
  return NextResponse.json({ tree })
}
