import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { logAiDebug } from "@/lib/logger"
import { callModel, extractJson, type ModelSelection } from "@/lib/ai-provider"

// Stage 1 of the pipeline: the "Plan" step.
//
// Takes a free-form prompt and asks the currently selected model (whichever
// provider — xAI, OpenRouter, …) to produce a high-level sitemap of pages.
// No UI trees, no components, no code — those come from the later style/logic
// stages. Keeping this step narrow makes it cheap and robust.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    prompt?: string
    model?: ModelSelection
  }
  const { prompt, model } = body

  await logAiDebug("Architect Request", {
    prompt,
    modelId: model?.id,
    provider: model?.provider,
  })

  if (!prompt) {
    return NextResponse.json({ message: "Prompt is required" }, { status: 400 })
  }
  if (!model?.id || !model?.provider) {
    return NextResponse.json({ message: "Model selection is required" }, { status: 400 })
  }

  const prompts = await getSystemPrompts()

  const messages = [
    {
      role: "system" as const,
      content: `${prompts.builderPlan}

For the Plan step you output ONLY a high-level sitemap. Do NOT emit any UI tree, component, or code — the later pipeline stages handle that.

Return strictly a JSON array of page objects, each with:
- "path":  URL path starting with "/" (e.g. "/", "/about")
- "title": short human-readable page title
- "description": 1–2 sentence description of the page's purpose and key sections

No markdown, no prose, no wrapping object.`,
    },
    {
      role: "user" as const,
      content: `Plan a multi-page website for: ${prompt}

Return only the JSON array described above.`,
    },
  ]

  const result = await callModel({
    model,
    messages,
    temperature: 0.1,
  })

  if (!result.ok) {
    await logAiDebug("Architect API Error", {
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
  let plan: Array<{ path: string; title: string; description?: string }>
  if (Array.isArray(parsed)) {
    plan = parsed as typeof plan
  } else if (parsed && typeof parsed === "object") {
    plan = [parsed as (typeof plan)[number]]
  } else {
    await logAiDebug("Architect Parse Error", { content: result.content })
    return NextResponse.json(
      { message: "AI failed to generate a valid plan. Please try a different prompt or model." },
      { status: 422 },
    )
  }

  // Ensure the plan entries have the required fields so downstream stages don't
  // crash on missing metadata.
  plan = plan
    .filter((p) => p && typeof p === "object")
    .map((p, i) => ({
      path: typeof p.path === "string" && p.path.trim() ? p.path.trim() : `/page-${i + 1}`,
      title: typeof p.title === "string" && p.title.trim() ? p.title.trim() : `Page ${i + 1}`,
      description: typeof p.description === "string" ? p.description.trim() : undefined,
    }))

  await logAiDebug("Architect Parse Success", { pages: plan.length })
  return NextResponse.json({ plan })
}
