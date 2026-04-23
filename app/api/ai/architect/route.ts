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

The downstream pipeline builds a complete Vite + React + TypeScript project with react-router-dom routing and a shared <SiteNav /> that auto-links every route. Your "Plan" step produces the sitemap + per-page feature list that Style and Logic stages will consume. Do NOT emit any UI tree, component, or code — the later stages handle that.

THINK CAREFULLY before emitting the array. For each page, decide:
1. WHY this page exists — which concrete user goal / question / action does it address?
2. WHO the visitor is at that point in the user journey (first-time visitor, returning customer, lead, authenticated user, etc.).
3. WHAT content the page MUST expose to achieve that goal (sections, forms, lists, social proof, stats, FAQ, pricing, CTAs).
4. WHAT the primary action ("happy path") is, and which OTHER page it links to afterwards.
Do NOT emit a page just because a template usually has it — every entry must earn its place in the user journey.

Return strictly a JSON array of page objects, each with:
- "path":   URL path starting with "/" (e.g. "/", "/about", "/pricing", "/contact"). First entry MUST be "/".
- "title":  short human-readable page title (used as the React component name and shown in the shared nav). PascalCase-friendly: "Home", "About", "Pricing", "Contact".
- "description": 2–4 sentences covering: (a) the page's purpose and target audience, (b) the key content sections it renders (hero, feature grid, testimonials, pricing table, form, etc.), (c) what the primary CTA does and where it sends the user. Be specific — "hero + 3-column feature grid with icons + testimonial carousel + CTA linking to /contact" is good; "about the product" is not.
- "features": array of short strings describing user-facing interactive features on the page (e.g. "Contact form posts to /api/contact", "Toggle between monthly/yearly pricing", "FAQ accordion with 6 entries", "Newsletter signup at the bottom"). Keep each feature concrete enough for a developer to implement.

No markdown, no prose, no wrapping object — just the JSON array.`,
    },
    {
      role: "user" as const,
      content: `Plan a multi-page website for: ${prompt}

Return only the JSON array described above. The sitemap MUST contain at least 3 distinct routes (ideally 4–6) so the shared <SiteNav /> has something to link to. Always include "/" as the first entry, plus enough additional pages (e.g. /about, /pricing, /contact, /docs, /blog) to give the site real structure.`,
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

  // Enforce "/" as the first entry so SiteNav renders it at position 0.
  const rootIdx = plan.findIndex((p) => p.path === "/")
  if (rootIdx > 0) {
    const [root] = plan.splice(rootIdx, 1)
    plan.unshift(root)
  } else if (rootIdx < 0 && plan.length > 0) {
    plan[0] = { ...plan[0], path: "/" }
  }

  // Guarantee a minimum of 3 routes so the generated site actually has
  // multi-page navigation (the user asked for pagination + reachable routes).
  const defaults: PlanEntry[] = [
    { path: "/", title: "Home", description: "Landing page with hero, highlights, and call-to-action linking to the rest of the site." },
    { path: "/about", title: "About", description: "Short story of the brand, mission and team; ends with a CTA back to Home or Contact." },
    { path: "/contact", title: "Contact", description: "Contact form with name / email / message plus a card summarizing other contact channels." },
  ]
  for (const d of defaults) {
    if (plan.length >= 3) break
    if (!plan.some((p) => p.path === d.path)) {
      plan.push(d)
    }
  }

  await logAiDebug("Architect Parse Success", { pages: plan.length })
  return NextResponse.json({ plan })
}
