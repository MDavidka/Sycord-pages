import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { logAiDebug } from "@/lib/logger"
import { callModel, extractJson, type ModelSelection } from "@/lib/ai-provider"
import type { PlanEntry } from "@/lib/plan-types"
import {
  buildProjectManifest,
  DESIGN_FINGERPRINT_OPTIONS,
  defaultDesignFingerprint,
  sanitizeDesignFingerprint,
  sanitizeSiteDesign,
  type ProjectManifest,
} from "@/lib/project-manifest"

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
  // and cannot drift across stages. The DESIGN portion (per-page Aceternity
  // component picks + site-wide vibe) is then layered on top via a second
  // AI call so each generated site looks unique even for similar briefs.
  const manifest: ProjectManifest = buildProjectManifest(prompt, plan)

  // ── Stage 1.5: AI design fingerprint ────────────────────────────────────
  // Asks the model to pick — for the whole site and for each page — which
  // Aceternity components to lean on. Output is sanitized against
  // DESIGN_FINGERPRINT_OPTIONS so we can never inject a hallucinated
  // component name into the Style stage.
  await applyAiDesignFingerprint(manifest, prompt, model)

  await logAiDebug("Architect Parse Success", {
    pages: plan.length,
    palette: manifest.design?.paletteName,
  })
  return NextResponse.json({ plan, manifest })
}

async function applyAiDesignFingerprint(
  manifest: ProjectManifest,
  brief: string,
  model: ModelSelection,
): Promise<void> {
  // The strict menu we hand to the AI — same data DESIGN_FINGERPRINT_OPTIONS
  // exposes, formatted for prompt readability.
  const menu = (Object.entries(DESIGN_FINGERPRINT_OPTIONS) as Array<
    [string, readonly string[]]
  >)
    .map(([slot, opts]) => `- ${slot}: ${opts.join(" | ")}`)
    .join("\n")

  const pagesHint = manifest.pages
    .map(
      (p, i) =>
        `${i + 1}. ${p.componentName} @ ${p.route} — ${p.description ?? p.pageTitle}`,
    )
    .join("\n")

  const messages = [
    {
      role: "system" as const,
      content: `You are the "Design Fingerprint" stage of a Vite + React + TypeScript site generator. The generator ships shadcn/ui (structural components) PLUS a curated set of free Aceternity UI components (modern animated primitives — backgrounds, text effects, 3D cards, hover effects).

Your job is to make every generated site UNIQUE. Given the user's brief and the page list, you pick which Aceternity components each page should lean on, plus a site-wide palette name and one-line vibe.

Output STRICT JSON (no prose, no markdown) with this shape:
{
  "siteDesign": {
    "paletteName": "<short label, e.g. 'noir SaaS', 'playful indie', 'retro terminal', 'high-end agency'>",
    "paletteVibe": "<1–2 sentences describing the look + feel — what makes THIS site different from a generic template>",
    "aceternityNorth": ["<2-4 Aceternity component names the site leans on overall>"]
  },
  "pages": [
    {
      "route": "/",
      "design": {
        "heroVariant": "<one of heroVariant options>",
        "backgroundEffect": "<one of backgroundEffect options>",
        "textEffect": "<one of textEffect options>",
        "cardStyle": "<one of cardStyle options>",
        "ctaStyle": "<one of ctaStyle options>",
        "vibe": "<short page-specific tone hint, e.g. 'cinematic landing', 'data-dense dashboard'>"
      }
    }
    // … one entry per page, in the order they were given to you …
  ]
}

ALLOWED OPTIONS PER SLOT (you MUST pick from these — anything else is silently ignored):
${menu}

DESIGN PRINCIPLES:
- Lean into ONE strong identity per site (don't mix every effect on every page).
- Vary the picks across pages so the site feels like a coherent product, not a single template repeated.
- Pages with form/data content (contact, dashboard) usually want a calmer hero (Spotlight, BackgroundGradient) than the marketing landing (AuroraBackground, BackgroundBeamsWithCollision).
- Set "none" rather than forcing a slot when an effect would distract.
- Pick a paletteName that genuinely matches the brief — a yoga studio shouldn't become a "noir SaaS".`,
    },
    {
      role: "user" as const,
      content: `Brief: ${brief}

Pages (in order):
${pagesHint}

Return only the JSON object described above.`,
    },
  ]

  let aiPicked = false
  try {
    const result = await callModel({ model, messages, temperature: 0.6 })
    if (result.ok) {
      const parsed = extractJson<unknown>(result.content) as {
        siteDesign?: unknown
        pages?: Array<{ route?: string; design?: unknown }>
      } | null
      if (parsed && typeof parsed === "object") {
        manifest.design = sanitizeSiteDesign(parsed.siteDesign)
        const byRoute = new Map<string, unknown>()
        if (Array.isArray(parsed.pages)) {
          for (const entry of parsed.pages) {
            if (entry && typeof entry === "object" && typeof entry.route === "string") {
              byRoute.set(entry.route.trim(), (entry as { design?: unknown }).design)
            }
          }
        }
        manifest.pages.forEach((p, i) => {
          const raw = byRoute.get(p.route)
          p.design = raw ? sanitizeDesignFingerprint(raw) : defaultDesignFingerprint(i)
        })
        aiPicked = true
      }
    } else {
      await logAiDebug("Architect Design Fingerprint API Error", {
        status: result.status,
        message: result.message,
      })
    }
  } catch (err) {
    await logAiDebug("Architect Design Fingerprint Threw", {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  if (!aiPicked) {
    // Deterministic fallback so downstream stages always have a fingerprint.
    manifest.design = {
      paletteName: "modern",
      paletteVibe:
        "Clean, modern, animation-forward landing page leaning on Aceternity backgrounds and text effects.",
      aceternityNorth: ["BackgroundBeams", "TextGenerateEffect", "GlareCard"],
    }
    manifest.pages.forEach((p, i) => (p.design = defaultDesignFingerprint(i)))
  }
}
