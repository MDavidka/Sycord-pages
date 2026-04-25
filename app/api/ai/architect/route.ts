import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { logAiDebug } from "@/lib/logger"
import { callModel, extractJson, type ModelSelection } from "@/lib/ai-provider"
import type { PlanEntry } from "@/lib/plan-types"
import { buildProjectManifest, type ProjectManifest } from "@/lib/project-manifest"

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
- "description": 3–5 sentences (REQUIRED, never empty) covering: (a) the page's purpose and target audience, (b) the SPECIFIC content sections it renders — be exhaustive (hero copy, feature grid, testimonials, pricing table, form fields, FAQ items, stats, etc.), (c) what the primary CTA does and where it sends the user. Tailor every description to THE BRIEF — a yoga studio's /about should mention the studio's story and instructors, NOT generic placeholder copy. Be specific — "hero + 3-column feature grid with icons + testimonial carousel + CTA linking to /contact" is good; "about the product" is not.
- "features": array of AT LEAST 4 short strings (REQUIRED, never fewer) describing user-facing interactive features on the page (e.g. "Contact form posts to /api/contact", "Toggle between monthly/yearly pricing", "FAQ accordion with 6 entries", "Newsletter signup at the bottom"). Every feature must be concrete enough for a developer to implement and specific to THIS brief.

ANTI-DUPLICATE RULE: Every page MUST be structurally and contextually distinct from every other page in the sitemap. If two pages would render the same skeleton (same hero + same grid), redesign one of them with a different content type (table, accordion, form, gallery, article, dashboard widgets). Empty / under-filled pages are a bug.

No markdown, no prose, no wrapping object — just the JSON array.`,
    },
    {
      role: "user" as const,
      content: `Plan a multi-page website for: ${prompt}

Return only the JSON array described above. The sitemap MUST contain at least 4 distinct routes (ideally 5–7) so the shared <SiteNav /> has something to link to. Always include "/" as the first entry, plus enough additional pages (e.g. /about, /pricing, /contact, /docs, /blog, /features, /faq) to give the site real structure. Each page must have its OWN distinct purpose and content — not a generic copy of the home page with different text.`,
    },
  ]

  const result = await callModel({
    model,
    messages,
    // Higher temperature so different briefs produce structurally different
    // sitemaps. Low temp here was making every plan converge to the same
    // 3 pages (Home / About / Contact) regardless of brief.
    temperature: 0.6,
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

  // Derive the project manifest deterministically from the plan. File
  // structure (componentName / slug / pageFile / logicFile) is fixed here
  // and cannot drift across stages. Each page is also assigned a layout
  // hint (split-hero, masonry-grid, sidebar-content, …) so the Style stage
  // varies the structure across routes instead of repeating a single
  // template — this addresses the "every page looks the same" problem.
  const manifest: ProjectManifest = buildProjectManifest(prompt, plan)
  assignLayoutHints(manifest)

  await logAiDebug("Architect Parse Success", {
    pages: plan.length,
    layouts: manifest.pages.map((p) => `${p.route}=${p.layoutHint ?? "?"}`),
  })
  return NextResponse.json({ plan, manifest })
}

// Distinct page layout structures. Each name maps to a concrete arrangement
// of sections the Style stage MUST follow. See the Style prompt for the
// per-layout section contract — the Architect's job here is just to ensure
// no two adjacent pages get the same layout, so the generated site doesn't
// feel like the same skeleton repeated.
const LAYOUT_HINTS = [
  "split-hero",         // 50/50 hero with text+CTA on one side, illustration/feature on the other
  "full-bleed-hero",    // Massive hero w/ background panel + 3-column features below
  "masonry-grid",       // Asymmetric tile grid (e.g. portfolio / showcase)
  "sidebar-content",    // Left sticky sidebar nav + scrolling main column
  "table-dashboard",    // Stats row + Table + Tabs (dashboard / data heavy)
  "two-column-article", // Long-form text in left column + sticky aside (TOC/CTA)
  "faq-stack",          // Hero + Accordion-driven FAQ + supporting cards
  "pricing-table",      // Hero + 3-column pricing cards + feature comparison table
  "contact-split",      // Form on one side + contact details / map / channels on the other
  "testimonial-wall",   // Hero + 3x3 testimonial grid + social proof bar
  "feature-spotlight",  // Hero + alternating left/right feature blocks (3 of them)
  "media-gallery",      // Hero + Carousel + Bento-style media tiles
] as const

function assignLayoutHints(manifest: ProjectManifest): void {
  const path = (p: string) => p.toLowerCase()
  const byRoute: Record<string, string> = {
    "/": "full-bleed-hero",
    "/about": "two-column-article",
    "/contact": "contact-split",
    "/pricing": "pricing-table",
    "/faq": "faq-stack",
    "/dashboard": "table-dashboard",
    "/blog": "sidebar-content",
    "/portfolio": "masonry-grid",
    "/gallery": "media-gallery",
    "/testimonials": "testimonial-wall",
    "/features": "feature-spotlight",
    "/team": "testimonial-wall",
  }

  // Track what each page got so we never assign the same layout to two
  // adjacent pages — even if their routes weren't in the seeded map.
  let prev = ""
  manifest.pages.forEach((p, i) => {
    let hint = byRoute[path(p.route)]
    if (!hint) {
      // Cycle through the remaining layouts in deterministic-but-varied order
      // so different briefs with similar route names still differ.
      const offset = (i + (manifest.brief.length % LAYOUT_HINTS.length)) % LAYOUT_HINTS.length
      hint = LAYOUT_HINTS[offset]
    }
    if (hint === prev) {
      // Bump to the next layout to break adjacent collisions.
      const idx = LAYOUT_HINTS.indexOf(hint as (typeof LAYOUT_HINTS)[number])
      hint = LAYOUT_HINTS[(idx + 1) % LAYOUT_HINTS.length]
    }
    p.layoutHint = hint
    prev = hint
  })
}
