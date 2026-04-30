// Top-level orchestrator for the AI website builder.
//
// Pipeline:
//   1. callPlannerModel(prompt, opts) → raw JSON string from selected model.
//   2. parse + normalize → GeneratedProjectManifest (deterministic fallbacks
//      kick in if any field is missing or malformed).
//   3. validate manifest → if errors, run a single repair pass against the AI.
//   4. render every page deterministically with sections.ts.
//   5. scaffold project files (configs, layout, header/footer, ui components).
//   6. file-level validation → quality score + diagnostics.
//
// `runAIWebsiteBuilder(prompt, opts?)` is the entry point used by the API
// route and by older callers that pass only a prompt.

import { callModel, extractJson, type ChatMessage, type ModelSelection } from "@/lib/ai-provider"

import type {
  BuilderFile,
  BuilderOptions,
  CtaPlan,
  DesignBrief,
  GeneratedProjectManifest,
  NavLink,
  PagePlan,
  PipelineLog,
  RequiredComponent,
  RunBuilderResult,
  SectionItem,
  SectionKind,
  SectionPlan,
  ThemePreset,
  ThemeTokens,
} from "./types"
import { buildTheme, detectPresetFromPrompt, THEME_PRESETS } from "./themes"
import { PLAN_SYSTEM_PROMPT, PAGE_REPAIR_PROMPT } from "./prompts"
import { computeQualityScore, runBuildValidation, validateManifest } from "./validate"
import { buildImportsPreamble, renderSection, type RenderedSection } from "./sections"
import { ALL_UI_COMPONENTS, buildUiComponentFiles, scaffoldBaseFiles } from "./scaffold"

// Re-export types so callers can `import { ... } from "@/lib/ai-website-builder"`.
export type {
  BuilderOptions,
  GeneratedProjectManifest,
  PagePlan,
  RunBuilderResult,
  SectionPlan,
  ThemeTokens,
} from "./types"

const FALLBACK_MODEL: ModelSelection = { id: "gemini-3.1-flash-preview", provider: "Google" }
const DEFAULT_BEST_MODEL: ModelSelection = { id: "gemini-3.1-pro-preview", provider: "Google" }

const ALLOWED_KINDS: ReadonlySet<SectionKind> = new Set<SectionKind>([
  "hero",
  "feature-grid",
  "stats",
  "testimonials",
  "pricing",
  "faq",
  "contact",
  "gallery",
  "product-grid",
  "comparison",
  "process",
  "cta",
  "logos",
  "team",
  "blog-preview",
])

function isProvidedModel(model: ModelSelection | undefined): model is ModelSelection {
  return Boolean(model && typeof model.id === "string" && typeof model.provider === "string")
}

function pickModel(opts: BuilderOptions, role: "planner" | "page" | "repair"): ModelSelection {
  if (isProvidedModel(opts.model)) return opts.model
  if (role === "page") return DEFAULT_BEST_MODEL
  return FALLBACK_MODEL
}

async function callAIAgent(
  messages: ChatMessage[],
  opts: { temperature?: number; retries?: number; model: ModelSelection },
): Promise<string> {
  const temperature = opts.temperature ?? 0.4
  const retries = opts.retries ?? 1

  let lastError = "Unknown AI error"
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await callModel({ model: opts.model, messages, temperature })
    if (res.ok) return res.content
    lastError = `${res.message}${res.details ? `: ${res.details}` : ""}`
    // If the selected model is not available (e.g. missing key), fall back
    // to Google so the pipeline still produces something useful.
    if (attempt === retries && opts.model.provider !== "Google") {
      const fallback = await callModel({ model: FALLBACK_MODEL, messages, temperature })
      if (fallback.ok) return fallback.content
    }
  }
  throw new Error(lastError)
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function sanitizeRoute(routePath: string): string {
  if (!routePath) return "/"
  let cleaned = routePath.trim().toLowerCase()
  if (!cleaned.startsWith("/")) cleaned = `/${cleaned}`
  cleaned = cleaned.replace(/\s+/g, "-").replace(/[^a-z0-9\-/]/g, "").replace(/\/+/g, "/")
  if (cleaned.length > 1 && cleaned.endsWith("/")) cleaned = cleaned.slice(0, -1)
  return cleaned || "/"
}

function slugToComponentName(routePath: string): string {
  if (routePath === "/") return "HomePage"
  const parts = routePath.replace(/^\//, "").split("/").filter(Boolean)
  const camel = parts
    .map((segment) =>
      segment
        .split("-")
        .map((p) => (p[0]?.toUpperCase() ?? "") + p.slice(1))
        .join(""),
    )
    .join("")
  return `${camel || "Page"}Page`
}

function routeToFilePath(routePath: string): string {
  return routePath === "/" ? "app/page.tsx" : `app${routePath}/page.tsx`
}

function asNavLinks(value: unknown, pagePaths: string[]): NavLink[] {
  if (!Array.isArray(value)) {
    return pagePaths.slice(0, 5).map((p, i) => ({ label: i === 0 ? "Home" : prettifyPath(p), href: p }))
  }
  const cleaned: NavLink[] = []
  const seen = new Set<string>()
  for (const v of value) {
    const label = safeText((v as { label?: unknown })?.label, "")
    const href = safeText((v as { href?: unknown })?.href, "")
    if (!label || !href) continue
    if (seen.has(href)) continue
    seen.add(href)
    cleaned.push({ label, href: href.startsWith("#") || href.startsWith("http") ? href : sanitizeRoute(href) })
  }
  // Always include the home route
  if (!cleaned.some((l) => l.href === "/")) {
    cleaned.unshift({ label: "Home", href: "/" })
  }
  return cleaned.slice(0, 6)
}

function prettifyPath(path: string): string {
  if (path === "/") return "Home"
  const last = path.split("/").filter(Boolean).pop() ?? path
  return last
    .split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ")
}

function asCta(value: unknown, fallback: CtaPlan): CtaPlan {
  const obj = value as { label?: unknown; href?: unknown } | undefined
  const label = safeText(obj?.label, "")
  const href = safeText(obj?.href, "")
  if (!label) return fallback
  return {
    label,
    href: href.startsWith("#") || href.startsWith("http") ? href : sanitizeRoute(href || fallback.href),
  }
}

function asTheme(presetRaw: unknown): ThemeTokens {
  const candidate = (typeof presetRaw === "string" ? presetRaw.toLowerCase().replace(/\s+/g, "-") : "") as ThemePreset
  const final: ThemePreset = THEME_PRESETS.includes(candidate) ? candidate : "saas"
  return buildTheme(final)
}

function normalizeSectionItems(items: unknown): SectionItem[] | undefined {
  if (!Array.isArray(items)) return undefined
  const out: SectionItem[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== "object") continue
    const r = raw as Record<string, unknown>
    const item: SectionItem = {
      title: safeText(r.title, ""),
      subtitle: safeText(r.subtitle, ""),
      description: safeText(r.description, ""),
      icon: safeText(r.icon, ""),
      eyebrow: safeText(r.eyebrow, ""),
      badge: safeText(r.badge, ""),
      href: safeText(r.href, ""),
      label: safeText(r.label, ""),
      value: safeText(r.value, ""),
      suffix: safeText(r.suffix, ""),
      prefix: safeText(r.prefix, ""),
      price: safeText(r.price, ""),
      period: safeText(r.period, ""),
      features: Array.isArray(r.features) ? (r.features as unknown[]).map((f) => safeText(f, "")).filter(Boolean) : undefined,
      cta: r.cta ? asCta(r.cta, { label: "", href: "#" }) : undefined,
      image: safeText(r.image, ""),
      quote: safeText(r.quote, ""),
      author: safeText(r.author, ""),
      role: safeText(r.role, ""),
      avatar: safeText(r.avatar, ""),
      initials: safeText(r.initials, ""),
      highlighted: Boolean(r.highlighted),
      category: safeText(r.category, ""),
      tag: safeText(r.tag, ""),
      date: safeText(r.date, ""),
    }
    // Strip empty strings to keep JSON tidy.
    for (const k of Object.keys(item) as (keyof SectionItem)[]) {
      const v = item[k] as unknown
      if (typeof v === "string" && v === "") delete item[k]
    }
    out.push(item)
  }
  return out.length ? out : undefined
}

function normalizeSection(raw: unknown, fallbackKind: SectionKind = "hero"): SectionPlan {
  const r = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>
  const kindCandidate = safeText(r.kind, "") as SectionKind
  const kind: SectionKind = ALLOWED_KINDS.has(kindCandidate) ? kindCandidate : fallbackKind
  const items = normalizeSectionItems(r.items)
  const highlights = Array.isArray(r.highlights) ? (r.highlights as unknown[]).map((h) => safeText(h, "")).filter(Boolean) : undefined
  return {
    kind,
    variant: safeText(r.variant, "") || undefined,
    eyebrow: safeText(r.eyebrow, "") || undefined,
    heading: safeText(r.heading, "") || undefined,
    subheading: safeText(r.subheading, "") || undefined,
    description: safeText(r.description, "") || undefined,
    highlights,
    primaryCta: r.primaryCta ? asCta(r.primaryCta, { label: "Learn more", href: "#" }) : undefined,
    secondaryCta: r.secondaryCta ? asCta(r.secondaryCta, { label: "", href: "#" }) : undefined,
    align: r.align === "center" || r.align === "left" ? r.align : undefined,
    tone: typeof r.tone === "string" ? (r.tone as SectionPlan["tone"]) : undefined,
    components: Array.isArray(r.components) ? (r.components as unknown[]).map((c) => safeText(c, "")).filter(Boolean) : undefined,
    items,
    imageHint: safeText(r.imageHint, "") || undefined,
    anchor: safeText(r.anchor, "") || undefined,
  }
}

function defaultSectionsForRoute(routePath: string, brief: DesignBrief): SectionPlan[] {
  // Route-aware defaults so missing AI output still yields varied pages.
  if (routePath === "/") {
    return [
      {
        kind: "hero",
        variant: "split",
        eyebrow: `Introducing ${brief.projectName}`,
        heading: brief.tagline,
        description: brief.description,
        primaryCta: brief.primaryCta,
        secondaryCta: brief.secondaryCta,
        anchor: "top",
      },
      { kind: "logos", heading: "Trusted by teams worldwide" },
      { kind: "feature-grid", variant: "cards", eyebrow: "Why teams choose us", heading: "Built for the way you work", description: brief.description },
      { kind: "stats", variant: "row", eyebrow: "By the numbers", heading: "Real results, week after week" },
      { kind: "testimonials", variant: "grid-cards", eyebrow: "Customer stories", heading: `What customers say about ${brief.projectName}` },
      { kind: "pricing", eyebrow: "Pricing", heading: "Simple pricing for every team" },
      { kind: "faq", variant: "accordion", eyebrow: "FAQ", heading: "Questions before you start?" },
      { kind: "cta", variant: "boxed-card", heading: "Ready to get started?", description: brief.description, primaryCta: brief.primaryCta },
    ]
  }
  const last = routePath.replace(/^\//, "").split("/").filter(Boolean).pop() ?? ""
  switch (last) {
    case "pricing":
      return [
        { kind: "hero", variant: "centered", heading: "Simple, predictable pricing", description: "Pick a plan that scales with you.", primaryCta: brief.primaryCta },
        { kind: "pricing" },
        { kind: "comparison", heading: "Compare every plan" },
        { kind: "faq", variant: "two-column", heading: "Pricing FAQ" },
        { kind: "cta", variant: "banner" },
      ]
    case "contact":
      return [
        { kind: "hero", variant: "centered", heading: "Let's talk", description: "Tell us about your project and we'll be in touch.", primaryCta: brief.primaryCta },
        { kind: "contact", variant: "split-form" },
        { kind: "faq", variant: "two-column", heading: "Common questions" },
      ]
    case "about":
      return [
        { kind: "hero", variant: "editorial", heading: `About ${brief.projectName}`, description: brief.description },
        { kind: "stats", variant: "split-callout" },
        { kind: "process", variant: "timeline", heading: "How we work" },
        { kind: "team" },
        { kind: "cta", variant: "split" },
      ]
    case "blog":
      return [
        { kind: "hero", variant: "centered", heading: "Stories, ideas, and behind-the-scenes", description: "Insights from our team.", primaryCta: { label: "Subscribe", href: "#" } },
        { kind: "blog-preview", variant: "feature-and-list" },
        { kind: "blog-preview", variant: "card-grid" },
        { kind: "cta", variant: "banner" },
      ]
    case "shop":
    case "store":
    case "menu":
      return [
        { kind: "hero", variant: "ecommerce", heading: "Crafted with care", description: brief.description, primaryCta: { label: "Shop now", href: "#" } },
        { kind: "product-grid", heading: "Bestsellers" },
        { kind: "stats", variant: "card-row" },
        { kind: "cta", variant: "boxed-card" },
      ]
    default:
      return [
        { kind: "hero", variant: "centered", heading: prettifyPath(routePath), description: brief.description, primaryCta: brief.primaryCta },
        { kind: "feature-grid", variant: "cards" },
        { kind: "testimonials", variant: "spotlight" },
        { kind: "cta", variant: "split" },
      ]
  }
}

function fallbackBriefFromPrompt(prompt: string): DesignBrief {
  const seedName = (prompt.split(/\s+/).slice(0, 3).join(" ").trim() || "Sycord Site").replace(/[^A-Za-z0-9 ]/g, "")
  return {
    projectName: seedName.length > 2 ? seedName : "Sycord Studio",
    tagline: "Beautiful, fast, on-brand websites.",
    description: prompt.length > 30 ? prompt : "A polished, mobile-first website tuned for the brand and audience.",
    audience: "Modern teams that care about craft.",
    voice: "Confident, warm, specific.",
    themePreset: detectPresetFromPrompt(prompt),
    navLinks: [
      { label: "Home", href: "/" },
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
    primaryCta: { label: "Get started", href: "/contact" },
    secondaryCta: { label: "Learn more", href: "/about" },
    footerCta: { label: "Talk to us", href: "/contact" },
    contact: { email: "hello@example.com" },
  }
}

function fallbackPagesFromBrief(brief: DesignBrief): PagePlan[] {
  return brief.navLinks.slice(0, 5).map((link, i) => ({
    path: link.href.startsWith("/") ? sanitizeRoute(link.href) : "/",
    title: i === 0 ? "Home" : link.label,
    metaTitle: `${i === 0 ? "Home" : link.label} — ${brief.projectName}`,
    metaDescription: brief.description,
    sections: defaultSectionsForRoute(i === 0 ? "/" : sanitizeRoute(link.href), brief),
  }))
}

function normalizeManifest(raw: unknown, prompt: string): GeneratedProjectManifest {
  const fallbackBrief = fallbackBriefFromPrompt(prompt)
  const root = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>
  const briefRaw = (root.brief as Record<string, unknown> | undefined) ?? {}

  const themePreset = (() => {
    const fromAi = safeText(briefRaw.themePreset, "")
    const candidate = fromAi.toLowerCase().replace(/\s+/g, "-") as ThemePreset
    if (THEME_PRESETS.includes(candidate)) return candidate
    return detectPresetFromPrompt(prompt)
  })()

  // Pre-normalize page paths to wire navLinks against real routes.
  const rawPages = Array.isArray(root.pages) ? (root.pages as unknown[]) : []
  const normalizedPaths: string[] = []
  const pages: PagePlan[] = []
  const seenPaths = new Set<string>()

  rawPages.forEach((rp, i) => {
    const r = (rp && typeof rp === "object" ? (rp as Record<string, unknown>) : {}) as Record<string, unknown>
    const rawPath = safeText(r.path, "")
    const normalized = i === 0 ? "/" : sanitizeRoute(rawPath || `/page-${i + 1}`)
    if (seenPaths.has(normalized)) return
    seenPaths.add(normalized)
    normalizedPaths.push(normalized)
    const sectionsRaw = Array.isArray(r.sections) ? (r.sections as unknown[]) : []
    const sections = sectionsRaw.length
      ? sectionsRaw.map((s) => normalizeSection(s))
      : []
    pages.push({
      path: normalized,
      title: safeText(r.title, prettifyPath(normalized)),
      metaTitle: safeText(r.metaTitle, `${prettifyPath(normalized)} — ${safeText(briefRaw.projectName, fallbackBrief.projectName)}`),
      metaDescription: safeText(r.metaDescription, fallbackBrief.description),
      sections,
    })
  })

  if (!pages.some((p) => p.path === "/")) {
    pages.unshift({
      path: "/",
      title: "Home",
      metaTitle: `${safeText(briefRaw.projectName, fallbackBrief.projectName)} — ${safeText(briefRaw.tagline, fallbackBrief.tagline)}`,
      metaDescription: safeText(briefRaw.description, fallbackBrief.description),
      sections: [],
    })
    normalizedPaths.unshift("/")
  }

  // If only the home page exists (e.g. the planner failed entirely), add
  // the standard secondary pages from the fallback brief so the generated
  // site still has a real internal structure.
  if (pages.length < 2) {
    const seedBrief: DesignBrief = {
      ...fallbackBrief,
      themePreset,
      projectName: safeText(briefRaw.projectName, fallbackBrief.projectName),
      tagline: safeText(briefRaw.tagline, fallbackBrief.tagline),
      description: safeText(briefRaw.description, fallbackBrief.description),
    }
    for (const extra of fallbackPagesFromBrief(seedBrief)) {
      if (extra.path === "/" || pages.some((p) => p.path === extra.path)) continue
      pages.push(extra)
      normalizedPaths.push(extra.path)
    }
  }

  // Fill empty sections from defaults and de-dup consecutive variants.
  const briefSeed: DesignBrief = {
    ...fallbackBrief,
    projectName: safeText(briefRaw.projectName, fallbackBrief.projectName),
    tagline: safeText(briefRaw.tagline, fallbackBrief.tagline),
    description: safeText(briefRaw.description, fallbackBrief.description),
    audience: safeText(briefRaw.audience, fallbackBrief.audience),
    voice: safeText(briefRaw.voice, fallbackBrief.voice),
    themePreset,
    navLinks: asNavLinks(briefRaw.navLinks, normalizedPaths),
    primaryCta: asCta(briefRaw.primaryCta, fallbackBrief.primaryCta),
    secondaryCta: briefRaw.secondaryCta ? asCta(briefRaw.secondaryCta, fallbackBrief.secondaryCta!) : fallbackBrief.secondaryCta,
    footerCta: briefRaw.footerCta ? asCta(briefRaw.footerCta, fallbackBrief.footerCta!) : fallbackBrief.footerCta,
    socialLinks: Array.isArray(briefRaw.socialLinks)
      ? (briefRaw.socialLinks as unknown[])
          .map((s) => {
            const r = (s && typeof s === "object" ? (s as Record<string, unknown>) : {}) as Record<string, unknown>
            const label = safeText(r.label, "")
            const href = safeText(r.href, "")
            if (!label || !href) return null
            return { label, href }
          })
          .filter((x): x is { label: string; href: string } => Boolean(x))
      : undefined,
    contact: (() => {
      const c = (briefRaw.contact as Record<string, unknown> | undefined) ?? undefined
      if (!c) return fallbackBrief.contact
      return {
        email: safeText(c.email, fallbackBrief.contact?.email ?? "") || undefined,
        phone: safeText(c.phone, "") || undefined,
        address: safeText(c.address, "") || undefined,
      }
    })(),
  }

  for (const page of pages) {
    if (page.sections.length === 0) {
      page.sections = defaultSectionsForRoute(page.path, briefSeed)
    }
    // Ensure home has a hero up front.
    if (page.path === "/" && page.sections[0]?.kind !== "hero") {
      page.sections.unshift({ kind: "hero", variant: "split", heading: briefSeed.tagline, description: briefSeed.description, primaryCta: briefSeed.primaryCta, secondaryCta: briefSeed.secondaryCta })
    }
    // De-dup consecutive identical kinds.
    page.sections = dedupConsecutive(page.sections)
  }

  return {
    brief: briefSeed,
    theme: buildTheme(themePreset),
    pages,
  }
}

function dedupConsecutive(sections: SectionPlan[]): SectionPlan[] {
  if (sections.length < 2) return sections
  const out: SectionPlan[] = []
  let prevSig = ""
  for (const s of sections) {
    const sig = `${s.kind}:${s.variant ?? ""}`
    if (sig === prevSig) continue
    out.push(s)
    prevSig = sig
  }
  return out
}

async function planManifest(prompt: string, opts: BuilderOptions, logs: PipelineLog[]): Promise<GeneratedProjectManifest> {
  const model = pickModel(opts, "planner")
  let raw = ""
  try {
    raw = await callAIAgent(
      [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { model, temperature: 0.6 },
    )
    logs.push({ step: "plan", detail: `Planner returned ${raw.length} chars from ${model.provider}/${model.id}` })
  } catch (error) {
    logs.push({
      step: "plan",
      detail: `Planner failed: ${error instanceof Error ? error.message : String(error)}. Using deterministic fallback.`,
    })
  }

  const parsed = extractJson<unknown>(raw)
  const manifest = normalizeManifest(parsed, prompt)

  const validation = validateManifest(manifest)
  if (!validation.ok) {
    logs.push({ step: "plan-validate", detail: `Manifest invalid: ${validation.errors.join("; ")}. Repairing...` })
    const repaired = await repairManifest(prompt, raw, validation.errors, opts, logs)
    if (repaired) return repaired
    logs.push({ step: "plan-repair", detail: "Repair failed, using normalized fallback." })
  } else if (validation.warnings.length) {
    logs.push({ step: "plan-validate", detail: `Manifest warnings: ${validation.warnings.join("; ")}` })
  }
  return manifest
}

async function repairManifest(
  prompt: string,
  previousRaw: string,
  errors: string[],
  opts: BuilderOptions,
  logs: PipelineLog[],
): Promise<GeneratedProjectManifest | null> {
  const model = pickModel(opts, "repair")
  try {
    const raw = await callAIAgent(
      [
        { role: "system", content: PAGE_REPAIR_PROMPT },
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Original prompt:\n${prompt}\n\nErrors to fix:\n${errors.map((e) => `- ${e}`).join("\n")}\n\nPrevious malformed JSON:\n${previousRaw.slice(0, 4000)}`,
        },
      ],
      { model, temperature: 0.2, retries: 0 },
    )
    const parsed = extractJson<unknown>(raw)
    if (!parsed) return null
    const manifest = normalizeManifest(parsed, prompt)
    const v = validateManifest(manifest)
    if (v.ok) {
      logs.push({ step: "plan-repair", detail: "Repair succeeded." })
      return manifest
    }
    logs.push({ step: "plan-repair", detail: `Repair still invalid: ${v.errors.join("; ")}` })
    return manifest // Even if not perfect, the normalized form is renderable.
  } catch (error) {
    logs.push({
      step: "plan-repair",
      detail: `Repair call failed: ${error instanceof Error ? error.message : String(error)}`,
    })
    return null
  }
}

// ---------- rendering ----------

function renderPageFile(manifest: GeneratedProjectManifest, page: PagePlan): {
  file: BuilderFile
  importsNeeded: Set<string>
  needsClient: boolean
} {
  const allImports: RenderedSection["imports"][] = []
  const tsxBlocks: string[] = []
  let needsClient = false
  const importsNeeded = new Set<string>()

  page.sections.forEach((section, sectionIndex) => {
    const rendered = renderSection(section, { sectionIndex, pagePath: page.path })
    allImports.push(rendered.imports)
    tsxBlocks.push(rendered.tsx)
    if (rendered.needsClient) needsClient = true
    for (const imp of rendered.imports) {
      const m = imp.from.match(/^@\/components\/ui\/([a-z-]+)$/)
      if (m) importsNeeded.add(m[1])
    }
  })

  const headerImports = [
    { from: "next", named: ["type Metadata"] },
    ...allImports.flat(),
  ]
  // Group header imports through buildImportsPreamble for ordering/dedup.
  const importBlock = buildImportsPreamble([headerImports])

  const clientHeader = needsClient ? '"use client"\n\n' : ""
  const componentName = slugToComponentName(page.path)
  const meta = `export const metadata: Metadata = {
  title: ${JSON.stringify(page.metaTitle)},
  description: ${JSON.stringify(page.metaDescription)},
}`

  // The renderer outputs `<section>` blocks at root; we just stack them inside
  // a wrapping fragment. App layout already provides <main>.
  const body = tsxBlocks.join("\n\n")

  const tsx = `${clientHeader}${importBlock}\n\n${meta}\n\nexport default function ${componentName}() {\n  return (\n    <>\n${body}\n    </>\n  )\n}\n`

  return {
    file: { path: routeToFilePath(page.path), content: tsx },
    importsNeeded,
    needsClient,
  }
}

function pickRequiredUiComponents(manifest: GeneratedProjectManifest): RequiredComponent[] {
  // Probe-render every page to know which @/components/ui/* slugs are needed,
  // then return matching component definitions to scaffold.
  const required = new Set<string>()
  for (const page of manifest.pages) {
    for (const section of page.sections) {
      for (const imp of renderSection(section, { sectionIndex: 0, pagePath: page.path }).imports) {
        const m = imp.from.match(/^@\/components\/ui\/([a-z-]+)$/)
        if (m) required.add(m[1])
      }
    }
  }
  // Always include button/badge/card/separator since the header/footer use them.
  required.add("button")
  required.add("badge")
  required.add("card")
  required.add("separator")
  return ALL_UI_COMPONENTS.filter((c) => required.has(c.slug))
}

// Public entry point.
export async function runAIWebsiteBuilder(
  prompt: string,
  options: BuilderOptions = {},
): Promise<RunBuilderResult> {
  const logs: PipelineLog[] = []
  logs.push({
    step: "start",
    detail: `Builder started${options.model ? ` with ${options.model.provider}/${options.model.id}` : ""}`,
  })

  // 1. Plan (with repair).
  const manifest = await planManifest(prompt, options, logs)
  logs.push({
    step: "plan",
    detail: `Manifest ready: ${manifest.pages.length} pages, theme=${manifest.theme.preset}`,
  })

  // 2. Render pages.
  const required = pickRequiredUiComponents(manifest)
  const pageFiles: BuilderFile[] = []
  for (const page of manifest.pages) {
    const { file } = renderPageFile(manifest, page)
    pageFiles.push(file)
    logs.push({ step: "render", detail: `Rendered ${page.path} -> ${file.path} (${page.sections.length} sections)` })
  }

  // 3. Scaffold base + ui components.
  const baseFiles = scaffoldBaseFiles(manifest, required)
  const uiFiles = buildUiComponentFiles(required.map((r) => r.slug))
  logs.push({ step: "scaffold", detail: `Scaffolded ${baseFiles.length} base files + ${uiFiles.length} UI components` })

  const allFiles: BuilderFile[] = [...baseFiles, ...uiFiles, ...pageFiles]

  // 4. File-level validation.
  const build = runBuildValidation(allFiles)
  if (!build.ok) {
    logs.push({ step: "build-validate", detail: `Build validation failed: ${build.errors.join("; ")}` })
  } else {
    logs.push({ step: "build-validate", detail: `Build validation passed (${build.warnings.length} warnings)` })
  }

  const qualityScore = computeQualityScore(manifest, build)
  logs.push({ step: "done", detail: `Quality score ${qualityScore}/100, ${allFiles.length} deployable files` })

  return {
    manifest,
    files: allFiles,
    logs,
    build,
    warnings: build.warnings,
    qualityScore,
  }
}
