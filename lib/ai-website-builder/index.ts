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
  ComponentNode,
  CtaPlan,
  DesignBrief,
  DesignDirection,
  EnvVarRequirement,
  GeneratedProjectManifest,
  IntegrationKind,
  IntegrationPlan,
  NavLink,
  PagePlan,
  PipelineLog,
  ProgressCallback,
  ProjectContext,
  RefineOptions,
  RefineResult,
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
import { DESIGN_DIRECTION_SYSTEM_PROMPT, fallbackDesignDirection, normalizeDesignDirection } from "./design-directions"
import { computeQualityScore, runBuildValidation, validateManifest } from "./validate"
import { buildImportsPreamble, renderSection, type RenderedSection } from "./sections"
import { ALL_UI_COMPONENTS, buildUiComponentFiles, computeInitials, scaffoldBaseFiles } from "./scaffold"

// Re-export types so callers can `import { ... } from "@/lib/ai-website-builder"`.
export type {
  BuilderOptions,
  DesignDirection,
  EnvVarRequirement,
  GeneratedProjectManifest,
  IntegrationPlan,
  PagePlan,
  ProgressCallback,
  ProjectContext,
  RefineOptions,
  RefineResult,
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

const ALLOWED_COMPONENTS: ReadonlySet<ComponentNode["component"]> = new Set<ComponentNode["component"]>([
  "Page",
  "Section",
  "Container",
  "Grid",
  "Stack",
  "Button",
  "Card",
  "CardHeader",
  "CardTitle",
  "CardDescription",
  "CardContent",
  "CardFooter",
  "Badge",
  "Accordion",
  "AccordionItem",
  "AccordionTrigger",
  "AccordionContent",
  "Tabs",
  "TabsList",
  "TabsTrigger",
  "TabsContent",
  "Input",
  "Textarea",
  "Label",
  "Avatar",
  "Separator",
  "Image",
  "Link",
  "Heading",
  "Text",
  "Stat",
  "PricingCard",
  "FeatureCard",
])

function isProvidedModel(model: ModelSelection | undefined): model is ModelSelection {
  return Boolean(model && typeof model.id === "string" && typeof model.provider === "string")
}

function pickModel(opts: BuilderOptions): ModelSelection {
  if (isProvidedModel(opts.model)) return opts.model
  return opts.quality === "fast" ? FALLBACK_MODEL : DEFAULT_BEST_MODEL
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

function jsonSafeProps(input: unknown): Record<string, unknown> | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) return undefined
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(key)) continue
    if (typeof value === "string") out[key] = safeText(value, "")
    else if (typeof value === "number" && Number.isFinite(value)) out[key] = value
    else if (typeof value === "boolean") out[key] = value
    else if (value === null) out[key] = null
    else if (Array.isArray(value)) {
      const arr = value.filter((v) => typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null)
      if (arr.length === value.length) out[key] = arr
    }
  }
  return Object.keys(out).length ? out : undefined
}

function normalizeComponentNode(raw: unknown, depth = 0): ComponentNode | undefined {
  if (depth > 8 || !raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const component = safeText(r.component, "")
  if (!ALLOWED_COMPONENTS.has(component as ComponentNode["component"])) return undefined
  const children = Array.isArray(r.children)
    ? r.children
        .map((child) => normalizeComponentNode(child, depth + 1))
        .filter((child): child is ComponentNode => Boolean(child))
        .slice(0, 40)
    : undefined
  const id = safeText(r.id, "") || `${component.toLowerCase()}-${depth}`
  return {
    id: id.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80),
    component: component as ComponentNode["component"],
    props: jsonSafeProps(r.props),
    text: safeText(r.text, "") || undefined,
    children: children?.length ? children : undefined,
  }
}

function normalizeSection(raw: unknown, fallbackKind: SectionKind = "hero"): SectionPlan {
  const r = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>
  const kindCandidate = safeText(r.kind, "") as SectionKind
  const kind: SectionKind = ALLOWED_KINDS.has(kindCandidate) ? kindCandidate : fallbackKind
  const items = normalizeSectionItems(r.items)
  const highlights = Array.isArray(r.highlights) ? (r.highlights as unknown[]).map((h) => safeText(h, "")).filter(Boolean) : undefined
  const variant = safeText(r.variant, "") || undefined
  return {
    kind,
    variant,
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
    componentTree: variant === "custom" ? normalizeComponentNode(r.componentTree) : undefined,
    anchor: safeText(r.anchor, "") || undefined,
  }
}

function defaultSectionsForRoute(routePath: string, brief: DesignBrief): SectionPlan[] {
  // Route-aware defaults so missing AI output still yields varied pages.
  if (routePath === "/") {
    return [
      {
        kind: "hero",
        variant: "cinematic",
        eyebrow: `Introducing ${brief.projectName}`,
        heading: brief.tagline,
        description: brief.description,
        primaryCta: brief.primaryCta,
        secondaryCta: brief.secondaryCta,
        anchor: "top",
      },
      { kind: "logos", heading: "Trusted by teams worldwide" },
      { kind: "feature-grid", variant: "asymmetric-bento", eyebrow: "Why teams choose us", heading: "Built for the way you work", description: brief.description },
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
        { kind: "hero", variant: "magazine-cover", heading: `About ${brief.projectName}`, description: brief.description },
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
        { kind: "feature-grid", variant: "proof-led" },
        { kind: "testimonials", variant: "spotlight" },
        { kind: "cta", variant: "split" },
      ]
  }
}

function fallbackBriefFromPrompt(prompt: string, project?: ProjectContext): DesignBrief {
  const seedName = (prompt.split(/\s+/).slice(0, 3).join(" ").trim() || "Sycord Site").replace(/[^A-Za-z0-9 ]/g, "")
  const derivedName = seedName.length > 2 ? seedName : "Sycord Studio"
  const projectName = project?.name?.trim() || derivedName
  const description = project?.description?.trim()
    || (prompt.length > 30 ? prompt : "A polished, mobile-first website tuned for the brand and audience.")
  return {
    projectName,
    tagline: "Beautiful, fast, on-brand websites.",
    description,
    audience: "Modern teams that care about craft.",
    voice: "Confident, warm, specific.",
    themePreset: detectPresetFromPrompt(`${prompt} ${project?.category ?? ""} ${project?.description ?? ""}`),
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
    logoUrl: project?.logoUrl,
    logoInitials: computeInitials(projectName),
    category: project?.category,
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

function normalizeManifest(raw: unknown, prompt: string, project?: ProjectContext, direction?: DesignDirection): GeneratedProjectManifest {
  const fallbackBrief = fallbackBriefFromPrompt(prompt, project)
  const root = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>
  const briefRaw = (root.brief as Record<string, unknown> | undefined) ?? {}
  const designDirection = normalizeDesignDirection(root.designDirection, direction || fallbackDesignDirection(prompt, project))

  const themePreset = (() => {
    const fromAi = safeText(briefRaw.themePreset, "")
    const candidate = fromAi.toLowerCase().replace(/\s+/g, "-") as ThemePreset
    if (THEME_PRESETS.includes(candidate)) return candidate
    return detectPresetFromPrompt(`${prompt} ${project?.category ?? ""} ${project?.description ?? ""}`)
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

  // Host-project branding always wins over AI-invented names/descriptions.
  // If the planner proposed a different name, keep the real project name
  // and fold the AI's suggestion into the tagline instead (less disruptive
  // than renaming the user's business).
  const aiProjectName = safeText(briefRaw.projectName, "")
  const resolvedProjectName = project?.name?.trim() || aiProjectName || fallbackBrief.projectName
  const aiTagline = safeText(briefRaw.tagline, "")
  const resolvedTagline = aiTagline
    || (aiProjectName && project?.name && aiProjectName !== project.name ? aiProjectName : fallbackBrief.tagline)
  const resolvedDescription = project?.description?.trim() || safeText(briefRaw.description, fallbackBrief.description)

  // Fill empty sections from defaults and de-dup consecutive variants.
  const briefSeed: DesignBrief = {
    ...fallbackBrief,
    projectName: resolvedProjectName,
    tagline: resolvedTagline,
    description: resolvedDescription,
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
    logoUrl: project?.logoUrl || fallbackBrief.logoUrl,
    logoInitials: computeInitials(resolvedProjectName),
    category: project?.category || fallbackBrief.category,
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

  const { needsDatabase, integrations, databaseProvider, unconnectedRequested } = resolveIntegrations(
    root,
    prompt,
    project,
  )
  const requiredEnvVars = buildRequiredEnvVars(integrations, needsDatabase)

  return {
    brief: briefSeed,
    theme: buildTheme(themePreset),
    designDirection,
    pages,
    deploymentMode: "next-server",
    needsDatabase,
    databaseProvider,
    integrations,
    requiredEnvVars,
    unconnectedIntegrations: unconnectedRequested,
  }
}

// Keywords that unambiguously point at features requiring persistent data.
const DB_KEYWORDS = [
  "booking",
  "reservation",
  "appointment",
  "schedule",
  "dashboard",
  "account",
  "sign up",
  "signup",
  "login",
  "admin",
  "cms",
  "editor",
  "marketplace",
  "orders",
  "order",
  "cart",
  "checkout",
  "ecommerce",
  "e-commerce",
  "storefront",
  "inventory",
  "product",
  "submission",
  "form",
  "blog post",
  "content",
  "save",
  "persist",
]

const INTEGRATION_KINDS: ReadonlySet<IntegrationKind> = new Set<IntegrationKind>([
  "database",
  "auth",
  "email",
  "analytics",
  "storage",
  "payments",
  "other",
])

function promptSuggestsDatabase(prompt: string, project?: ProjectContext): boolean {
  const blob = `${prompt} ${project?.description ?? ""} ${project?.category ?? ""}`.toLowerCase()
  return DB_KEYWORDS.some((kw) => blob.includes(kw))
}

function envKeyLooksLikeSecret(key: string): boolean {
  return /^[A-Z][A-Z0-9_]*$/.test(key.trim())
}

function normalizeIntegration(raw: unknown): IntegrationPlan | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const name = safeText(r.name, "")
  const providerRaw = safeText(r.provider, "").toLowerCase()
  if (!name) return null
  const kindCandidate = safeText(r.kind, "").toLowerCase() as IntegrationKind
  const kind: IntegrationKind = INTEGRATION_KINDS.has(kindCandidate) ? kindCandidate : "other"
  const envVars = Array.isArray(r.envVars)
    ? (r.envVars as unknown[])
        .map((e) => safeText(e, ""))
        .filter(envKeyLooksLikeSecret)
    : []
  return {
    kind,
    name,
    provider: providerRaw || name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    reason: safeText(r.reason, ""),
    envVars,
  }
}

function tursoIntegration(reason: string): IntegrationPlan {
  return {
    kind: "database",
    name: "Turso",
    provider: "turso",
    reason: reason || "SQLite database for persistent app data",
    envVars: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  }
}

// Map integration provider keys (what the planner/us emit) to Sycord
// integration IDs (what the user has connected in the dashboard).
// Both sides get normalized to the same dash-separated lowercase form
// before lookup.
const INTEGRATION_ID_ALIASES: Record<string, string> = {
  "turso": "turso",
  "mongodb": "mongodb",
  "supabase": "supabase",
  "supabase-auth": "supabase-auth",
  "firebase": "firebase",
  "upstash": "upstash",
  "upstash-redis": "upstash",
  "redis": "upstash",
  "nextauth": "nextauth",
  "auth-js": "nextauth",
  "clerk": "clerk",
  "stripe": "stripe",
  "paypal": "paypal",
  "openai": "openai",
  "resend": "resend",
  "github": "github",
  "sendgrid": "resend",
  "postmark": "resend",
}

function normalizeId(raw: string | undefined | null): string {
  return (raw ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function integrationId(plan: IntegrationPlan): string {
  const p = normalizeId(plan.provider)
  return INTEGRATION_ID_ALIASES[p] ?? p
}

function resolveIntegrations(
  root: Record<string, unknown>,
  prompt: string,
  project?: ProjectContext,
): {
  needsDatabase: boolean
  integrations: IntegrationPlan[]
  databaseProvider?: "turso" | "none"
  unconnectedRequested: string[]
} {
  const rawIntegrations = Array.isArray(root.integrations)
    ? (root.integrations as unknown[]).map(normalizeIntegration).filter((i): i is IntegrationPlan => i !== null)
    : []

  const aiNeedsDb = typeof root.needsDatabase === "boolean" ? (root.needsDatabase as boolean) : undefined
  // If AI said true, or the prompt clearly implies persistence, we need a DB.
  const needsDatabase = aiNeedsDb === true || (aiNeedsDb !== false && promptSuggestsDatabase(prompt, project))

  // Connected integration id set. Turso is always treated as "connectable"
  // because it's the platform's default DB — but we still warn if the env
  // vars aren't resolved.
  const connected = new Set<string>(["turso"])
  for (const id of project?.connectedIntegrationIds ?? []) {
    const norm = normalizeId(id)
    if (norm) connected.add(INTEGRATION_ID_ALIASES[norm] ?? norm)
  }
  for (const projectInt of project?.integrations ?? []) {
    const provider = normalizeId(projectInt.provider || projectInt.name)
    if (provider) connected.add(INTEGRATION_ID_ALIASES[provider] ?? provider)
  }

  // Dedup planner-requested integrations by normalized id.
  const byProvider = new Map<string, IntegrationPlan>()
  const unconnectedRequested: string[] = []
  for (const integration of rawIntegrations) {
    const id = integrationId(integration)
    if (!connected.has(id)) {
      // Planner asked for a non-connected integration — drop it but
      // remember the name so we can surface a "not connected" warning
      // and render a safe UI placeholder instead of real SDK code.
      if (!unconnectedRequested.includes(integration.name)) {
        unconnectedRequested.push(integration.name)
      }
      continue
    }
    if (!byProvider.has(id)) byProvider.set(id, integration)
  }

  // Promote every connected project integration into the plan so the UI
  // can echo them back (even if the planner didn't mention them).
  for (const projectInt of project?.integrations ?? []) {
    const provider = normalizeId(projectInt.provider || projectInt.name)
    const id = INTEGRATION_ID_ALIASES[provider] ?? provider
    if (!id || byProvider.has(id)) continue
    byProvider.set(id, {
      kind: "other",
      name: projectInt.name,
      provider: id,
      reason: "Already connected to this project",
      envVars: [],
    })
  }

  if (needsDatabase) {
    const existingDb = Array.from(byProvider.values()).find((i) => i.kind === "database")
    if (!existingDb || existingDb.provider !== "turso") {
      // Force Turso as the default database even if the planner proposed
      // another provider — the host infra only has Turso wired up.
      byProvider.set("turso", tursoIntegration(existingDb?.reason ?? ""))
      if (existingDb && existingDb.provider !== "turso") {
        byProvider.delete(existingDb.provider)
      }
    } else {
      // Ensure env var list is correct for Turso.
      byProvider.set("turso", tursoIntegration(existingDb.reason))
    }
  } else {
    // Strip any database integrations the planner may have added erroneously.
    for (const [k, v] of Array.from(byProvider.entries())) {
      if (v.kind === "database") byProvider.delete(k)
    }
  }

  return {
    needsDatabase,
    integrations: Array.from(byProvider.values()),
    databaseProvider: needsDatabase ? "turso" : "none",
    unconnectedRequested,
  }
}

function buildRequiredEnvVars(integrations: IntegrationPlan[], needsDatabase: boolean): EnvVarRequirement[] {
  const out: EnvVarRequirement[] = []
  const seen = new Set<string>()
  for (const integration of integrations) {
    for (const key of integration.envVars) {
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        key,
        purpose: `${integration.name} — ${integration.reason || "integration env var"}`.trim(),
        provider: integration.provider,
        required: integration.kind === "database" || needsDatabase,
        integration: integration.name,
      })
    }
  }
  return out
}

function computeMissingEnvVars(
  required: EnvVarRequirement[],
  existingKeys: string[] | undefined,
  resolvedValues?: Record<string, string>,
): EnvVarRequirement[] {
  const present = new Set((existingKeys ?? []).filter(Boolean))
  return required.filter((env) => {
    // If we have a non-empty resolved value (from project envVars or the
    // server env), the key is no longer missing even if it wasn't in the
    // project's envVarKeys list.
    if (resolvedValues && resolvedValues[env.key] && resolvedValues[env.key].trim().length > 0) return false
    return !present.has(env.key)
  })
}

// Build a map of envKey -> real value, sourced from (in order):
//   1. project.envVars (the user's stored secrets)
//   2. process.env (server env on the host)
// Values are only used locally for missing-env checks and are never emitted
// into generated files.
function resolveRequiredEnvVarValues(
  required: EnvVarRequirement[],
  project: ProjectContext | undefined,
): Record<string, string> {
  const out: Record<string, string> = {}
  const projectValues = new Map<string, string>()
  for (const v of project?.envVars ?? []) {
    if (typeof v?.key === "string" && typeof v?.value === "string" && v.value.length > 0) {
      projectValues.set(v.key, v.value)
    }
  }
  for (const req of required) {
    const fromProject = projectValues.get(req.key)
    if (fromProject && fromProject.length > 0) {
      out[req.key] = fromProject
      continue
    }
    const fromServer = process.env[req.key]
    if (typeof fromServer === "string" && fromServer.length > 0) {
      out[req.key] = fromServer
    }
  }
  return out
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

function buildPlannerUserContent(prompt: string, project?: ProjectContext, direction?: DesignDirection): string {
  if (!project) return prompt
  const projectBits: string[] = []
  if (project.name) projectBits.push(`Project name: ${project.name}`)
  if (project.description) projectBits.push(`Project description: ${project.description}`)
  if (project.category) projectBits.push(`Category: ${project.category}`)
  if (project.envVarKeys?.length) projectBits.push(`Existing env var keys: ${project.envVarKeys.join(", ")}`)
  if (project.integrations?.length) {
    projectBits.push(
      `Connected integrations: ${project.integrations.map((i) => i.name).join(", ")}`,
    )
  }
  if (projectBits.length === 0) return prompt
  return `${prompt}\n\nHost project context (branding & existing setup — keep the project name/description consistent):\n${projectBits.join("\n")}`
}

async function planDesignDirection(prompt: string, opts: BuilderOptions, logs: PipelineLog[]): Promise<DesignDirection> {
  const fallback = fallbackDesignDirection(prompt, opts.project)
  if (opts.quality === "fast") {
    logs.push({ step: "design-direction", detail: `Fast mode using deterministic concept: ${fallback.concept}` })
    return fallback
  }

  const model = pickModel(opts)
  try {
    const raw = await callAIAgent(
      [
        { role: "system", content: DESIGN_DIRECTION_SYSTEM_PROMPT },
        { role: "user", content: buildPlannerUserContent(prompt, opts.project) },
      ],
      { model, temperature: 0.75, retries: 0 },
    )
    const parsed = extractJson<unknown>(raw)
    const direction = normalizeDesignDirection(parsed, fallback)
    logs.push({ step: "design-direction", detail: `Concept: ${direction.concept}` })
    return direction
  } catch (error) {
    logs.push({
      step: "design-direction",
      detail: `Direction planning failed: ${error instanceof Error ? error.message : String(error)}. Using deterministic concept: ${fallback.concept}`,
    })
    return fallback
  }
}

async function planManifest(prompt: string, opts: BuilderOptions, logs: PipelineLog[], direction?: DesignDirection): Promise<GeneratedProjectManifest> {
  const model = pickModel(opts)
  let raw = ""
  try {
    raw = await callAIAgent(
      [
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        { role: "user", content: buildPlannerUserContent(prompt, opts.project, direction) },
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
  const manifest = normalizeManifest(parsed, prompt, opts.project, direction)
  const validation = validateManifest(manifest)
  if (!validation.ok) {
    logs.push({ step: "plan-validate", detail: `Manifest invalid: ${validation.errors.join("; ")}. Repairing...` })
    const repaired = await repairManifest(prompt, raw, validation.errors, opts, logs, direction)
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
  direction?: DesignDirection,
): Promise<GeneratedProjectManifest | null> {
  const model = pickModel(opts)
  try {
    const raw = await callAIAgent(
      [
        { role: "system", content: PAGE_REPAIR_PROMPT },
        { role: "system", content: PLAN_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Original prompt:\n${buildPlannerUserContent(prompt, opts.project, direction)}\n\nErrors to fix:\n${errors.map((e) => `- ${e}`).join("\n")}\n\nPrevious malformed JSON:\n${previousRaw.slice(0, 4000)}`,
        },
      ],
      { model, temperature: 0.2, retries: 0 },
    )
    const parsed = extractJson<unknown>(raw)
    if (!parsed) return null
    const manifest = normalizeManifest(parsed, prompt, opts.project, direction)
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
  const emit = options.onProgress

  logs.push({
    step: "start",
    detail: `Builder started${options.model ? ` with ${options.model.provider}/${options.model.id}` : ""}`,
  })
  emit?.({ type: "step", step: "start", detail: logs[logs.length - 1].detail })

  const quality = options.quality || "best"
  logs.push({ step: "quality", detail: `${quality === "fast" ? "Fast" : "Best"} generation pipeline selected` })

  // 1. Design direction + plan (with repair).
  emit?.({ type: "step", step: "design-direction", detail: "Planning visual design direction..." })
  const direction = await planDesignDirection(prompt, { ...options, quality }, logs)
  emit?.({ type: "step", step: "planning", detail: "Creating website architecture plan..." })
  const manifest = await planManifest(prompt, { ...options, quality }, logs, direction)
  emit?.({ type: "manifest", manifest })
  logs.push({
    step: "plan",
    detail: `Manifest ready: ${manifest.pages.length} pages, theme=${manifest.theme.preset}, deployment=${manifest.deploymentMode}`,
  })
  emit?.({ type: "step", step: "plan-complete", detail: logs[logs.length - 1].detail })

  // 2. Render pages.
  emit?.({ type: "step", step: "rendering", detail: "Rendering pages..." })
  const required = pickRequiredUiComponents(manifest)
  const pageFiles: BuilderFile[] = []
  for (let i = 0; i < manifest.pages.length; i++) {
    const page = manifest.pages[i]
    const { file } = renderPageFile(manifest, page)
    pageFiles.push(file)
    logs.push({ step: "render", detail: `Rendered ${page.path} -> ${file.path} (${page.sections.length} sections)` })
    emit?.({ type: "page", path: page.path, fileName: file.path, sectionCount: page.sections.length })
  }

  // Resolve env var values (project envVars- server env fallback) for
  // missing-env checks only. Never echo or write these values to files.
  const resolvedEnv = resolveRequiredEnvVarValues(manifest.requiredEnvVars, options.project)

  // 3. Scaffold base + ui components (+ optional DB files).
  emit?.({ type: "step", step: "scaffolding", detail: "Scaffolding project files and UI components..." })
  const baseFiles = scaffoldBaseFiles(manifest, required, prompt)
  const uiFiles = buildUiComponentFiles(required.map((r) => r.slug))
  emit?.({ type: "scaffold", baseCount: baseFiles.length, uiCount: uiFiles.length })
  logs.push({ step: "scaffold", detail: `Scaffolded ${baseFiles.length} base files + ${uiFiles.length} UI components` })

  const allFiles: BuilderFile[] = [...baseFiles, ...uiFiles, ...pageFiles]

  // 4. File-level validation.
  emit?.({ type: "step", step: "validating", detail: "Running build validation..." })
  const connectedIntegrationIds = Array.from(new Set([
    ...(options.project?.connectedIntegrationIds ?? []),
    ...(options.project?.integrations?.map((i) => (i.provider || i.name)) ?? []),
  ].map((s) => (s ?? "").toLowerCase()).filter(Boolean)))
  const build = runBuildValidation(allFiles, {
    needsDatabase: manifest.needsDatabase,
    deploymentMode: manifest.deploymentMode,
    connectedIntegrationIds,
  })
  if (!build.ok) {
    logs.push({ step: "build-validate", detail: `Build validation failed: ${build.errors.join("; ")}` })
  } else {
    logs.push({ step: "build-validate", detail: `Build validation passed (${build.warnings.length} warnings)` })
  }

  // Missing env var calculation combines project.envVarKeys with the
  // resolved values map — a key is only "missing" if neither the project
  // nor the server provided a non-empty value.
  const missingEnvVars = computeMissingEnvVars(
    manifest.requiredEnvVars,
    options.project?.envVarKeys,
    resolvedEnv,
  )
  if (manifest.needsDatabase) {
    // NEVER include secret values in the log message — only key names.
    const missingNames = missingEnvVars.map((e) => e.key)
    if (missingNames.length) {
      logs.push({
        step: "integrations",
        detail: `Database required (Turso). Missing env vars: ${missingNames.join(", ")}`,
      })
    } else {
      logs.push({ step: "integrations", detail: "Database required (Turso). Turso env loaded." })
    }
  } else {
    logs.push({ step: "integrations", detail: "No database integration required" })
  }
  if (manifest.unconnectedIntegrations.length) {
    logs.push({
      step: "integrations",
      detail: `Skipped unconnected integrations: ${manifest.unconnectedIntegrations.join(", ")}`,
    })
  }

  const qualityScore = computeQualityScore(manifest, build)
  logs.push({ step: "done", detail: `Quality score ${qualityScore}/100, ${allFiles.length} deployable files, deployment=${manifest.deploymentMode}` })

  // Advisory warnings surfaced to the UI. Never include values here.
  const advisoryWarnings = [...build.warnings]
  if (manifest.needsDatabase && missingEnvVars.length) {
    advisoryWarnings.unshift(
      `Missing env vars: ${missingEnvVars.map((e) => e.key).join(", ")}`,
    )
  }
  if (manifest.unconnectedIntegrations.length) {
    advisoryWarnings.push(
      `Integrations not connected (UI placeholders used): ${manifest.unconnectedIntegrations.join(", ")}`,
    )
  }

  emit?.({ type: "complete", files: allFiles, qualityScore, pageCount: manifest.pages.length, fileCount: allFiles.length })

  return {
    manifest,
    files: allFiles,
    logs,
    build,
    warnings: advisoryWarnings,
    qualityScore,
    needsDatabase: manifest.needsDatabase,
    databaseProvider: manifest.databaseProvider,
    integrations: manifest.integrations,
    requiredEnvVars: manifest.requiredEnvVars,
    missingEnvVars,
    unconnectedIntegrations: manifest.unconnectedIntegrations,
    deploymentMode: manifest.deploymentMode,
  }
}

// ---- Multi-plan generation ----
// Generates multiple alternative plans in parallel, scores them, and picks the best.
// Dramatically improves quality by exploring different design directions.
export async function runMultiPlanBuilder(
  prompt: string,
  options: BuilderOptions = {},
  planCount = 3,
): Promise<RunBuilderResult> {
  const emit = options.onProgress
  emit?.({ type: "step", step: "multi-plan", detail: `Generating ${planCount} alternative website plans...` })

  const quality = options.quality || "best"
  const plans = await generateMultiplePlans(prompt, options, planCount)

  // Score plans and pick the best
  let bestManifest: GeneratedProjectManifest | null = null
  let bestScore = -Infinity

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i]
    const validation = validateManifest(plan)
    let score = 0
    if (validation.ok) {
      const home = plan.pages.find((p) => p.path === "/")
      if (home) {
        const kinds = new Set(home.sections.map((s) => s.kind))
        score += kinds.size * 10
        score += Math.min(20, home.sections.length * 3)
      }
      score += plan.pages.length * 6
      score -= validation.warnings.length * 5
      if (plan.designDirection.visualStyle !== "bold-saas") score += 2
      if (plan.brief.projectName.length > 0) score += 5
      if (plan.brief.tagline !== "Beautiful, fast, on-brand websites.") score += 8
      if (plan.brief.description.length > 50) score += 5
    } else {
      score -= 50
    }
    emit?.({ type: "step", step: "plan-score", detail: `Plan ${i + 1} scored ${score} (${plan.pages.length} pages, ${plan.brief.projectName})` })
    if (score > bestScore) {
      bestScore = score
      bestManifest = plan
    }
  }

  if (!bestManifest) {
    emit?.({ type: "step", step: "multi-plan-fallback", detail: "No valid plan generated. Using deterministic fallback." })
    return runAIWebsiteBuilder(prompt, options)
  }

  emit?.({ type: "step", step: "multi-plan-select", detail: `Selected best plan: "${bestManifest.brief.projectName}" (${bestManifest.pages.length} pages)` })
  emit?.({ type: "manifest", manifest: bestManifest })

  // Render the best plan
  const logs: PipelineLog[] = []

  emit?.({ type: "step", step: "rendering", detail: "Rendering pages from best plan..." })
  const required = pickRequiredUiComponents(bestManifest)
  const pageFiles: BuilderFile[] = []
  for (const page of bestManifest.pages) {
    const { file } = renderPageFile(bestManifest, page)
    pageFiles.push(file)
    emit?.({ type: "page", path: page.path, fileName: file.path, sectionCount: page.sections.length })
  }

  const resolvedEnv = resolveRequiredEnvVarValues(bestManifest.requiredEnvVars, options.project)

  emit?.({ type: "step", step: "scaffolding", detail: "Scaffolding project files..." })
  const baseFiles = scaffoldBaseFiles(bestManifest, required, prompt)
  const uiFiles = buildUiComponentFiles(required.map((r) => r.slug))
  emit?.({ type: "scaffold", baseCount: baseFiles.length, uiCount: uiFiles.length })

  const allFiles: BuilderFile[] = [...baseFiles, ...uiFiles, ...pageFiles]

  const connectedIntegrationIds = Array.from(new Set([
    ...(options.project?.connectedIntegrationIds ?? []),
    ...(options.project?.integrations?.map((i) => (i.provider || i.name)) ?? []),
  ].map((s) => (s ?? "").toLowerCase()).filter(Boolean)))
  const build = runBuildValidation(allFiles, {
    needsDatabase: bestManifest.needsDatabase,
    deploymentMode: bestManifest.deploymentMode,
    connectedIntegrationIds,
  })

  const missingEnvVars = computeMissingEnvVars(
    bestManifest.requiredEnvVars,
    options.project?.envVarKeys,
    resolvedEnv,
  )

  const qualityScore = computeQualityScore(bestManifest, build)

  const advisoryWarnings = [...build.warnings]
  if (bestManifest.needsDatabase && missingEnvVars.length) {
    advisoryWarnings.unshift(`Missing env vars: ${missingEnvVars.map((e) => e.key).join(", ")}`)
  }
  if (bestManifest.unconnectedIntegrations.length) {
    advisoryWarnings.push(`Integrations not connected: ${bestManifest.unconnectedIntegrations.join(", ")}`)
  }

  emit?.({ type: "complete", files: allFiles, qualityScore, pageCount: bestManifest.pages.length, fileCount: allFiles.length })

  return {
    manifest: bestManifest,
    files: allFiles,
    logs,
    build,
    warnings: advisoryWarnings,
    qualityScore,
    needsDatabase: bestManifest.needsDatabase,
    databaseProvider: bestManifest.databaseProvider,
    integrations: bestManifest.integrations,
    requiredEnvVars: bestManifest.requiredEnvVars,
    missingEnvVars,
    unconnectedIntegrations: bestManifest.unconnectedIntegrations,
    deploymentMode: bestManifest.deploymentMode,
  }
}

async function generateMultiplePlans(
  prompt: string,
  options: BuilderOptions,
  count: number,
): Promise<GeneratedProjectManifest[]> {
  const model = pickModel(options)
  const direction = options.quality !== "fast"
    ? await planDesignDirection(prompt, options, [])
    : fallbackDesignDirection(prompt, options.project)

  const plans: GeneratedProjectManifest[] = []
  const temperatureVars = [0.7, 0.85, 0.6]

  const tasks = Array.from({ length: count }, async (_, i) => {
    const temp = temperatureVars[i % temperatureVars.length]
    try {
      const raw = await callAIAgent(
        [
          { role: "system", content: PLAN_SYSTEM_PROMPT },
          { role: "user", content: buildPlannerUserContent(prompt, options.project, direction) },
        ],
        { model, temperature: temp, retries: 0 },
      )
      const parsed = extractJson<unknown>(raw)
      if (parsed) {
        return normalizeManifest(parsed, prompt, options.project, direction)
      }
    } catch {
      // Skip failed plan
    }
    return null
  })

  const results = await Promise.all(tasks)
  for (const plan of results) {
    if (plan) plans.push(plan)
  }

  if (plans.length === 0) {
    plans.push(normalizeManifest(null, prompt, options.project, direction))
  }

  return plans
}

// ---- Iterative Refinement ----
// Allows users to refine an existing generated website with follow-up prompts.
// The AI receives the current manifest + all files and produces a diff.
export async function refineAIWebsite(
  prompt: string,
  options: RefineOptions,
): Promise<RefineResult> {
  const logs: PipelineLog[] = []
  const emit = options.onProgress

  emit?.({ type: "step", step: "refine-planning", detail: "Analyzing refinement request..." })
  const model = pickModel({ model: options.model, quality: "best" })

  const fileSummary = options.existingFiles
    .map((f) => `${f.path} (${f.content.length} chars)`)
    .join("\n")

  const conversationContext = options.conversationHistory
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n\n")

  const manifestJson = JSON.stringify(
    {
      brief: options.existingManifest.brief,
      pages: options.existingManifest.pages.map((p) => ({
        path: p.path,
        title: p.title,
        sections: p.sections.map((s) => ({
          kind: s.kind,
          variant: s.variant,
          heading: s.heading,
          description: s.description,
        })),
      })),
      designDirection: options.existingManifest.designDirection,
      needsDatabase: options.existingManifest.needsDatabase,
    },
    null,
    2,
  )

  try {
    const raw = await callAIAgent(
      [
        {
          role: "system",
          content: REFINE_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Current website manifest:\n${manifestJson}\n\nExisting files:\n${fileSummary}\n\nConversation history:\n${conversationContext}\n\nRefinement request: ${prompt}\n\nReturn a JSON diff describing what to change.`,
        },
      ],
      { model, temperature: 0.4 },
    )

    const diff = extractJson<RefineDiff>(raw)
    logs.push({ step: "refine-plan", detail: `Refinement plan received: ${diff?.changes?.length ?? 0} changes` })

    if (diff && diff.changes) {
      // Apply changes to the manifest
      const updatedManifest = applyRefineDiff(options.existingManifest, diff)
      const validation = validateManifest(updatedManifest)
      if (validation.ok) {
        emit?.({ type: "manifest", manifest: updatedManifest })

        // Re-render pages
        emit?.({ type: "step", step: "rendering", detail: "Re-rendering pages..." })
        const required = pickRequiredUiComponents(updatedManifest)
        const baseFiles = scaffoldBaseFiles(updatedManifest, required, "")

        const pageFiles: BuilderFile[] = []
        for (const page of updatedManifest.pages) {
          const { file } = renderPageFile(updatedManifest, page)
          pageFiles.push(file)
          emit?.({ type: "page", path: page.path, fileName: file.path, sectionCount: page.sections.length })
        }

        const changedPaths = new Set(diff.changes.map((c) => c.path))
        const files: BuilderFile[] = [
          ...baseFiles.filter((f) => changedPaths.has(f.path) || changedPaths.has("*")),
          ...pageFiles,
        ]

        const allFiles = [...options.existingFiles]
        for (const newFile of files) {
          const existingIdx = allFiles.findIndex((f) => f.path === newFile.path)
          if (existingIdx >= 0) {
            allFiles[existingIdx] = newFile
          } else {
            allFiles.push(newFile)
          }
        }

        return {
          files: allFiles,
          manifest: updatedManifest,
          changes: diff.changes,
          logs,
          warnings: validation.warnings,
        }
      } else {
        logs.push({ step: "refine-validation", detail: `Validation failed: ${validation.errors.join("; ")}` })
      }
    }
  } catch (error) {
    logs.push({ step: "refine-error", detail: `Refinement failed: ${error instanceof Error ? error.message : String(error)}` })
  }

  return {
    files: options.existingFiles,
    manifest: options.existingManifest,
    changes: [],
    logs,
    warnings: ["Refinement could not be applied. The website remains unchanged."],
  }
}

interface RefineDiff {
  changes: Array<{
    path: string
    action: "created" | "modified" | "deleted"
    summary: string
  }>
  brief?: Partial<DesignBrief>
  pages?: Array<{
    path: string
    action?: "update" | "add" | "remove"
    title?: string
    sections?: SectionPlan[]
  }>
  themePreset?: ThemePreset
}

function applyRefineDiff(
  existing: GeneratedProjectManifest,
  diff: RefineDiff,
): GeneratedProjectManifest {
  const brief = diff.brief
    ? { ...existing.brief, ...diff.brief }
    : existing.brief

  let pages = [...existing.pages]

  if (diff.pages) {
    for (const pageDiff of diff.pages) {
      if (pageDiff.action === "remove") {
        pages = pages.filter((p) => p.path !== pageDiff.path)
      } else if (pageDiff.action === "add" && pageDiff.path) {
        const sections = pageDiff.sections || defaultSectionsForRoute(pageDiff.path, brief)
        pages.push({
          path: pageDiff.path,
          title: pageDiff.title || prettifyPath(pageDiff.path),
          metaTitle: `${pageDiff.title || prettifyPath(pageDiff.path)} — ${brief.projectName}`,
          metaDescription: brief.description,
          sections,
        })
      } else if (pageDiff.path && pageDiff.sections) {
        const existingIdx = pages.findIndex((p) => p.path === pageDiff.path)
        if (existingIdx >= 0) {
          pages[existingIdx] = { ...pages[existingIdx], sections: pageDiff.sections }
          if (pageDiff.title) pages[existingIdx].title = pageDiff.title
        }
      }
    }
  }

  const theme = diff.themePreset && THEME_PRESETS.includes(diff.themePreset)
    ? buildTheme(diff.themePreset)
    : existing.theme

  return {
    ...existing,
    brief,
    pages,
    theme,
  }
}

const REFINE_SYSTEM_PROMPT = `You are a senior product designer refining an existing website. You receive the current website manifest and a refinement request from the user.

Return ONLY one JSON object, no prose, no markdown fences:

{
  "changes": [{"path": "file/path", "action": "created" | "modified" | "deleted", "summary": "brief description"}],
  "brief": { partial DesignBrief fields to update },
  "pages": [{"path": "/route", "action": "update" | "add" | "remove", "title": "Page Title", "sections": [SectionPlan...]}],
  "themePreset": "saas" | "agency" | "ecommerce" | "portfolio" | "restaurant" | "nonprofit" | "event" | "creator" | "local-business"
}

Rules:
1. Only include fields that actually change
2. For page updates, include the FULL sections array (not just the changes)
3. When adding a page, provide the complete sections array
4. Section plans follow the same schema as the website planner
5. Keep the same project name and style unless the user explicitly asks to change them
6. Never output raw TSX, JSX, or code strings
7. Be surgical — prefer minimal changes over rewriting everything`
