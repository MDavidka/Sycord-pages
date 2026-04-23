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

The downstream pipeline builds a complete Vite + React + TypeScript project with react-router-dom routing. Your "Plan" step produces the sitemap + per-page feature list that Style and Logic stages will consume. Do NOT emit any UI tree, component, or code — the later stages handle that.

Return strictly a JSON array of page objects, each with:
- "path":   URL path starting with "/" (e.g. "/", "/about", "/contact"). First entry SHOULD be "/".
- "title":  short human-readable page title (used as the React component name).
- "description": 1–2 sentence description of the page's purpose, key sections and overall tone.
- "features": array of short strings describing user-facing interactive features on the page (e.g. "Contact form posts to /api/contact", "Logout button clears localStorage and redirects to /", "Mobile nav toggle"). Keep each feature concrete enough for a developer to implement.

No markdown, no prose, no wrapping object — just the JSON array.`,
    },
    {
      role: "user" as const,
      content: `Plan a multi-page website for: ${prompt}

Return only the JSON array described above. Keep the plan to 3–6 pages unless the brief clearly requires more.`,
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
  interface PlanEntry {
    path: string
    title: string
    description?: string
    features?: string[]
  }
  let plan: PlanEntry[]
  if (Array.isArray(parsed)) {
    plan = parsed as PlanEntry[]
  } else if (parsed && typeof parsed === "object") {
    plan = [parsed as PlanEntry]
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
      features: Array.isArray(p.features)
        ? p.features.filter((f): f is string => typeof f === "string" && f.trim().length > 0)
        : undefined,
    }))

  await logAiDebug("Architect Parse Success", { pages: plan.length })
  return NextResponse.json({ plan })
}
