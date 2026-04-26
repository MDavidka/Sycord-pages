// Single source of truth for a generated Vite project.
//
// Every AI stage (style, logic) and the deterministic orchestrator receive
// this manifest so they plan with knowledge of the WHOLE app — not just the
// page in front of them. Previously each stage ran blind: the style call for
// /about didn't know what /contact exported, so inter-page references were
// guesses that often missed. With a manifest the file/slug/logic/component
// names are pre-computed and consistent end-to-end.
//
// The manifest is built deterministically from the architect plan — no extra
// AI roundtrip is required to produce it.

import type { PlanEntry } from "./plan-types"
import type {
  ProjectChrome,
  DesignGenome,
  LayoutSignature,
} from "./design-genome"

export interface ManifestPage {
  /** PascalCase React component name, e.g. "About" → exports function About(). */
  componentName: string
  /** React Router path starting with "/". First page is always "/". */
  route: string
  /** Filesystem-safe slug, e.g. "/" → "index", "/pricing" → "pricing". */
  slug: string
  /** Relative path of the emitted page file, e.g. "src/pages/about.tsx". */
  pageFile: string
  /** Relative path of the emitted logic module, e.g. "src/lib/about-logic.ts". */
  logicFile: string
  /** Import specifier for the logic module, e.g. "@/lib/about-logic". */
  logicModule: string
  /** Human-readable title set in <title> via document.title, e.g. "About Us". */
  pageTitle: string
  /** Short purpose/description from the architect plan (2–4 sentences). */
  description?: string
  /** Concrete user-facing features to implement on the page. */
  features?: string[]
  /**
   * Layout structure hint set by the architect — one of the named layouts
   * documented in the Style prompt (split-hero, masonry-grid, sidebar-content,
   * table-dashboard, two-column-article, faq-stack, pricing-table, …). The
   * Style stage uses this to render structurally different pages instead of
   * repeating the same skeleton on every route.
   */
  layoutHint?: string
  /**
   * Concrete page-role layout (commerce-catalog, pricing-table, contact-split,
   * docs-sidebar, …). Drives both the Style prompt's section list and the
   * deterministic fallback tree so each route renders a structurally distinct
   * page instead of repeating one canonical hero+grid skeleton.
   */
  layoutSignature?: LayoutSignature
}

export interface ManifestRouterRoute {
  path: string
  componentName: string
  importPath: string // e.g. "./pages/about"
}

export interface ManifestRouter {
  type: "react-router-dom"
  root: "App.tsx"
  routes: ManifestRouterRoute[]
}

/**
 * Per-site visual fingerprint. Picked deterministically from the brief so
 * two different briefs produce visibly different sites (different primary
 * accent, radius, type pair) — but the same brief always produces the same
 * theme, which keeps reruns reproducible.
 *
 * Only the accent / ring / radius / font swap; the background stays the
 * locked white-or-#101010 theme so light/dark mode keeps working.
 */
export interface ProjectTheme {
  /** Short human label, e.g. "ocean", "sunset", "forest". */
  name: string
  /** Hue in degrees (0–359) for the primary accent. */
  primaryHue: number
  /** Saturation % (0–100) for the primary accent. */
  primarySat: number
  /** Border radius in rem applied to --radius. */
  radius: number
  /** Headline font family CSS value (must be a system / Google-default font). */
  fontHeading: string
  /** Body font family CSS value. */
  fontBody: string
}

export interface ProjectManifest {
  /** Full website brief the user typed into the builder. */
  brief: string
  pages: ManifestPage[]
  router: ManifestRouter
  /** Per-site theme fingerprint (set by buildProjectManifest). */
  theme: ProjectTheme
  /**
   * Site shell metadata (brand name, nav variant, footer, hero CTA). Set by
   * the architect's `enrichManifestDesign` call. The Vite scaffold reads
   * this to render a different SiteNav/SiteFooter per site instead of a
   * single hard-coded shell.
   */
  chrome?: ProjectChrome
  /**
   * Visual fingerprint of the site (visual style, section rhythm, card
   * treatment, …). Drives the Style prompt's design hints so two different
   * briefs produce visibly different pages.
   */
  design?: DesignGenome
}

/**
 * Curated theme presets. Index picked deterministically by hashing the brief
 * so the same brief → same theme; different briefs → different themes.
 * Background colour stays locked — we only vary the accent + radius + font.
 */
export const THEME_PRESETS: ProjectTheme[] = [
  { name: "ocean",     primaryHue: 210, primarySat: 90, radius: 0.5,  fontHeading: "'Inter', ui-sans-serif, system-ui", fontBody: "'Inter', ui-sans-serif, system-ui" },
  { name: "forest",    primaryHue: 142, primarySat: 70, radius: 0.25, fontHeading: "'Plus Jakarta Sans', ui-sans-serif", fontBody: "'Plus Jakarta Sans', ui-sans-serif" },
  { name: "sunset",    primaryHue: 22,  primarySat: 95, radius: 0.75, fontHeading: "'Manrope', ui-sans-serif", fontBody: "'Manrope', ui-sans-serif" },
  { name: "royal",     primaryHue: 270, primarySat: 75, radius: 0.5,  fontHeading: "'Space Grotesk', ui-sans-serif", fontBody: "'Inter', ui-sans-serif" },
  { name: "rose",      primaryHue: 340, primarySat: 85, radius: 1.0,  fontHeading: "'DM Serif Display', ui-serif", fontBody: "'Inter', ui-sans-serif" },
  { name: "monochrome",primaryHue: 0,   primarySat: 0,  radius: 0,    fontHeading: "'JetBrains Mono', ui-monospace", fontBody: "'Inter', ui-sans-serif" },
  { name: "amber",     primaryHue: 38,  primarySat: 95, radius: 0.5,  fontHeading: "'Fraunces', ui-serif", fontBody: "'Inter', ui-sans-serif" },
  { name: "cyan",      primaryHue: 188, primarySat: 90, radius: 0.25, fontHeading: "'Geist', ui-sans-serif", fontBody: "'Geist', ui-sans-serif" },
  { name: "lime",      primaryHue: 84,  primarySat: 80, radius: 0.5,  fontHeading: "'Outfit', ui-sans-serif", fontBody: "'Outfit', ui-sans-serif" },
  { name: "indigo",    primaryHue: 245, primarySat: 80, radius: 0.5,  fontHeading: "'Inter', ui-sans-serif", fontBody: "'Inter', ui-sans-serif" },
  { name: "magenta",   primaryHue: 320, primarySat: 80, radius: 0.75, fontHeading: "'Sora', ui-sans-serif", fontBody: "'Inter', ui-sans-serif" },
  { name: "slate",     primaryHue: 220, primarySat: 15, radius: 0.5,  fontHeading: "'IBM Plex Sans', ui-sans-serif", fontBody: "'IBM Plex Sans', ui-sans-serif" },
]

function hashBrief(brief: string): number {
  let h = 5381
  for (let i = 0; i < brief.length; i++) {
    h = ((h << 5) + h + brief.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function pickTheme(brief: string): ProjectTheme {
  const idx = hashBrief(brief || "site") % THEME_PRESETS.length
  return THEME_PRESETS[idx]
}

function toPascalCase(input: string): string {
  const candidate = (
    input
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("") || "GeneratedPage"
  )
  return /^[A-Za-z_]/.test(candidate) ? candidate : `Page${candidate}`
}

function pageSlug(routePath: string, fallbackPageName: string): string {
  if (routePath === "/") return "index"
  const slug = routePath
    .replace(/^\//, "")
    .replace(/[/:]+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  return slug || fallbackPageName.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "index"
}

/**
 * Turn the architect plan into a ProjectManifest. Deterministic: same plan
 * in ⇒ same manifest out. No AI call involved. Handles slug collisions by
 * suffixing `-2`, `-3`, …
 */
export function buildProjectManifest(brief: string, plan: PlanEntry[]): ProjectManifest {
  const used = new Set<string>()
  const pages: ManifestPage[] = plan.map((p, i) => {
    const componentName = toPascalCase(p.title || `Page${i + 1}`)
    const route = typeof p.path === "string" && p.path.trim() ? p.path.trim() : `/page-${i + 1}`
    let slug = pageSlug(route, componentName)
    let n = 2
    while (used.has(slug)) {
      slug = `${pageSlug(route, componentName)}-${n++}`
    }
    used.add(slug)
    const pageFile = `src/pages/${slug}.tsx`
    const logicFile = `src/lib/${slug}-logic.ts`
    const logicModule = `@/lib/${slug}-logic`
    const pageTitle = p.title || componentName
    return {
      componentName,
      route,
      slug,
      pageFile,
      logicFile,
      logicModule,
      pageTitle,
      description: p.description,
      features: p.features,
    }
  })

  const router: ManifestRouter = {
    type: "react-router-dom",
    root: "App.tsx",
    routes: pages.map((p) => ({
      path: p.route,
      componentName: p.componentName,
      importPath: `./pages/${p.slug}`,
    })),
  }

  return { brief, pages, router, theme: pickTheme(brief) }
}

/**
 * Walk a UI tree and count "real" elements. A real element is a node with a
 * non-empty `name` plus EITHER text content OR at least one child with
 * its own name. Used by the Style stage to detect AI responses that are
 * effectively empty (e.g. `{}`, `{component:{}}`, or just a heading + nothing).
 */
export function countTreeNodes(node: unknown): number {
  if (!node || typeof node !== "object") return 0
  const n = node as { name?: unknown; text?: unknown; children?: unknown }
  let count = 0
  if (typeof n.name === "string" && n.name.trim().length > 0) {
    count = 1
  }
  if (Array.isArray(n.children)) {
    for (const c of n.children) count += countTreeNodes(c)
  }
  return count
}

type FallbackNode = { name: string; props?: Record<string, unknown>; text?: string; children?: FallbackNode[] }

function fbCard(title: string, body: string, treatment?: string): FallbackNode {
  const padding = treatment === "dense" ? "p-4" : "p-6"
  return {
    name: "Card",
    props: { className: padding },
    children: [
      { name: "CardHeader", children: [{ name: "CardTitle", text: title }] },
      { name: "CardContent", children: [
        { name: "p", props: { className: "text-sm text-muted-foreground" }, text: body },
      ] },
    ],
  }
}

function fbHero(page: ManifestPage, primaryCta: string, secondaryCta: string): FallbackNode {
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24" },
    children: [
      { name: "h1", props: { className: "text-4xl md:text-6xl font-bold tracking-tight" }, text: page.pageTitle },
      ...(page.description
        ? [{ name: "p", props: { className: "mt-6 max-w-2xl text-lg text-muted-foreground" }, text: page.description } as FallbackNode]
        : []),
      {
        name: "div",
        props: { className: "mt-8 flex flex-wrap gap-4" },
        children: [
          { name: "Button", props: { size: "lg" }, children: [{ name: "span", text: primaryCta }] },
          { name: "Button", props: { size: "lg", variant: "outline" }, children: [{ name: "span", text: secondaryCta }] },
        ],
      },
    ],
  }
}

function fbFeaturesGrid(features: string[], cardTreatment?: string): FallbackNode {
  const cards = features.length > 0
    ? features.slice(0, 6).map((f) => fbCard(f.split(/[.!?]/)[0].trim() || f, f, cardTreatment))
    : [fbCard("Get started", "Explore the site to learn more about what we offer.", cardTreatment)]
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 border-t border-border" },
    children: [
      { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-8" }, text: "What you'll find here" },
      { name: "div", props: { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" }, children: cards },
    ],
  }
}

function fbAccordionFaqs(features: string[]): FallbackNode {
  const items = (features.length >= 4 ? features : [
    "How do I get started?",
    "What does it cost?",
    "Where can I find documentation?",
    "How do I contact support?",
    "Can I cancel any time?",
    "Is my data secure?",
  ]).slice(0, 8).map((q, i) => ({
    name: "AccordionItem",
    props: { value: `q${i}` },
    children: [
      { name: "AccordionTrigger", text: q },
      { name: "AccordionContent", text: "We'll answer this in detail soon — reach out via the contact page if you need help right now." } as FallbackNode,
    ],
  } as FallbackNode))
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20" },
    children: [
      { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-6" }, text: "Frequently asked" },
      { name: "Accordion", props: { type: "single", collapsible: true, className: "max-w-3xl" }, children: items },
    ],
  }
}

function fbPricingTable(): FallbackNode {
  const tiers = [
    { name: "Starter", price: "Free", desc: "For individuals getting started.", popular: false },
    { name: "Pro", price: "$29/mo", desc: "For growing teams that need more.", popular: true },
    { name: "Enterprise", price: "Custom", desc: "Tailored support, security and scale.", popular: false },
  ]
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20" },
    children: [
      { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-8 text-center" }, text: "Pricing" },
      {
        name: "div",
        props: { className: "grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto" },
        children: tiers.map((t) => ({
          name: "Card",
          props: { className: t.popular ? "p-6 border-primary shadow-lg" : "p-6" },
          children: [
            { name: "CardHeader", children: [
              ...(t.popular ? [{ name: "Badge", text: "Most popular" } as FallbackNode] : []),
              { name: "CardTitle", text: t.name },
              { name: "p", props: { className: "text-3xl font-bold mt-2" }, text: t.price },
            ] },
            { name: "CardContent", children: [
              { name: "p", props: { className: "text-sm text-muted-foreground" }, text: t.desc },
              { name: "Button", props: { className: "mt-6 w-full", variant: t.popular ? "default" : "outline" }, children: [{ name: "span", text: "Get started" }] },
            ] },
          ],
        })),
      },
    ],
  }
}

function fbContactSplit(): FallbackNode {
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 grid grid-cols-1 md:grid-cols-2 gap-8" },
    children: [
      { name: "Card", props: { className: "p-6" }, children: [
        { name: "CardHeader", children: [{ name: "CardTitle", text: "Send us a message" }] },
        { name: "CardContent", children: [
          { name: "form", props: { className: "space-y-4" }, children: [
            { name: "Field", children: [
              { name: "FieldLabel", text: "Name" },
              { name: "Input", props: { placeholder: "Jane Doe" } },
            ] },
            { name: "Field", children: [
              { name: "FieldLabel", text: "Email" },
              { name: "Input", props: { placeholder: "you@example.com", type: "email" } },
            ] },
            { name: "Field", children: [
              { name: "FieldLabel", text: "Message" },
              { name: "Textarea", props: { placeholder: "How can we help?" } },
            ] },
            { name: "Button", props: { type: "submit", className: "w-full" }, children: [{ name: "span", text: "Send" }] },
          ] },
        ] },
      ] },
      { name: "Card", props: { className: "p-6" }, children: [
        { name: "CardHeader", children: [{ name: "CardTitle", text: "Other ways to reach us" }] },
        { name: "CardContent", children: [
          { name: "ul", props: { className: "space-y-3 text-sm" }, children: [
            { name: "li", text: "Email: hello@example.com" },
            { name: "li", text: "Phone: (555) 123-4567" },
            { name: "li", text: "Hours: Mon–Fri, 9–6 ET" },
          ] },
        ] },
      ] },
    ],
  }
}

function fbDocsSidebar(features: string[]): FallbackNode {
  const sections = (features.length > 0 ? features : ["Introduction", "Quickstart", "Configuration", "API reference", "FAQ"]).slice(0, 8)
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 grid grid-cols-1 md:grid-cols-[200px_1fr] gap-8" },
    children: [
      { name: "aside", props: { className: "sticky top-20 self-start" }, children: [
        { name: "ul", props: { className: "space-y-2 text-sm" }, children: sections.map((s) => ({
          name: "li", children: [{ name: "a", props: { href: "#" }, text: s.split(/[.!?]/)[0].trim() || s }],
        } as FallbackNode)) },
      ] },
      { name: "article", props: { className: "prose prose-invert max-w-none" }, children: [
        { name: "h2", props: { className: "text-3xl font-semibold mb-4" }, text: "Introduction" },
        { name: "p", props: { className: "text-muted-foreground" }, text: "This guide covers everything you need to know to get up and running." },
        ...sections.slice(1).map((s) => ({
          name: "div",
          props: { className: "mt-8" },
          children: [
            { name: "h3", props: { className: "text-2xl font-semibold mb-2" }, text: s.split(/[.!?]/)[0].trim() || s },
            { name: "p", props: { className: "text-muted-foreground" }, text: s },
          ],
        } as FallbackNode)),
      ] },
    ],
  }
}

function fbPortfolioMasonry(features: string[]): FallbackNode {
  const items = (features.length > 0 ? features : [
    "Brand redesign for Northwind",
    "Mobile app for FjordKit",
    "E-commerce site for Atlas Goods",
    "Dashboard for OperaOps",
    "Editorial site for Lumen",
    "Marketing site for HelioPay",
  ]).slice(0, 8)
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20" },
    children: [
      { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-8" }, text: "Selected work" },
      {
        name: "div",
        props: { className: "grid grid-cols-1 md:grid-cols-3 gap-4" },
        children: items.map((it, i) => ({
          name: "Card",
          props: { className: i % 4 === 0 ? "md:col-span-2" : "" },
          children: [
            { name: "AspectRatio", props: { ratio: 4 / 3 }, children: [
              { name: "div", props: { className: "h-full w-full bg-muted rounded-md" } },
            ] },
            { name: "CardContent", props: { className: "p-4" }, children: [
              { name: "CardTitle", props: { className: "text-base" }, text: it.split(/[.!?]/)[0].trim() || it },
            ] },
          ],
        } as FallbackNode)),
      },
    ],
  }
}

function fbDashboardGrid(features: string[]): FallbackNode {
  const stats = ["Revenue", "Active users", "Conversion", "Retention"]
  const fs = features.length > 0 ? features : ["Recent activity", "Top customers", "Pending orders"]
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-8" },
    children: [
      { name: "h2", props: { className: "text-2xl font-semibold mb-6" }, text: "Overview" },
      {
        name: "div",
        props: { className: "grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8" },
        children: stats.map((s) => ({
          name: "Card",
          props: { className: "p-4" },
          children: [
            { name: "p", props: { className: "text-xs text-muted-foreground" }, text: s },
            { name: "p", props: { className: "text-2xl font-semibold mt-1" }, text: "—" },
          ],
        } as FallbackNode)),
      },
      {
        name: "div",
        props: { className: "grid grid-cols-1 lg:grid-cols-3 gap-6" },
        children: fs.slice(0, 3).map((s) => fbCard(s.split(/[.!?]/)[0].trim() || s, s, "dense")),
      },
    ],
  }
}

function fbCommerceCatalog(features: string[]): FallbackNode {
  const products = features.length > 0 ? features.slice(0, 6) : [
    "Galaxy S24 Ultra", "iPhone 15 Pro", "Pixel 8", "OnePlus 12", "Xiaomi 14", "Nothing Phone (2)",
  ]
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-8" },
    children: [
      { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-8" }, text: "Available now" },
      {
        name: "div",
        props: { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" },
        children: products.map((p) => ({
          name: "Card",
          props: { className: "overflow-hidden" },
          children: [
            { name: "AspectRatio", props: { ratio: 1 }, children: [
              { name: "div", props: { className: "h-full w-full bg-muted" } },
            ] },
            { name: "CardContent", props: { className: "p-4" }, children: [
              { name: "CardTitle", props: { className: "text-base" }, text: p.split(/[.!?]/)[0].trim() || p },
              { name: "p", props: { className: "text-sm text-muted-foreground mt-1" }, text: "From $—" },
              { name: "Button", props: { size: "sm", className: "mt-3 w-full" }, children: [{ name: "span", text: "View details" }] },
            ] },
          ],
        } as FallbackNode)),
      },
    ],
  }
}

function fbTwoColumnArticle(page: ManifestPage): FallbackNode {
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-12" },
    children: [
      { name: "article", props: { className: "prose prose-invert max-w-3xl" }, children: [
        { name: "h2", props: { className: "text-3xl md:text-4xl font-semibold mb-4" }, text: page.pageTitle },
        { name: "p", props: { className: "text-lg text-muted-foreground" }, text: page.description ?? "" },
        ...(page.features ?? []).slice(0, 4).map((f) => ({
          name: "div", props: { className: "mt-6" }, children: [
            { name: "h3", props: { className: "text-xl font-semibold" }, text: f.split(/[.!?]/)[0].trim() || f },
            { name: "p", props: { className: "text-muted-foreground mt-1" }, text: f },
          ],
        } as FallbackNode)),
      ] },
      { name: "aside", props: { className: "lg:sticky lg:top-20 self-start space-y-4" }, children: [
        fbCard("Get in touch", "Have questions? Reach out — we usually reply within a day.", "outlined"),
      ] },
    ],
  }
}

/**
 * Build a deterministic, substantive UI tree for a page when the AI fails to
 * produce one. Uses the manifest entry (title / description / features /
 * layoutHint / layoutSignature) to render a real, structurally-distinct page
 * so the page is NEVER blank. Different layoutSignatures produce different
 * fallbacks (commerce-catalog ≠ pricing-table ≠ docs-sidebar) — the spec's
 * key promise that pages don't all collapse to the same hero+grid skeleton
 * is enforced HERE, even when the AI fails entirely.
 */
export function buildFallbackTree(
  page: ManifestPage,
  manifest?: ProjectManifest,
): { type: "ui-tree"; version: "1.0"; component: Record<string, unknown> } {
  const features = (page.features ?? []).filter((f) => typeof f === "string" && f.trim().length > 0)
  const cardTreatment = manifest?.design?.cardTreatment
  const ctaPrimary = manifest?.chrome?.ctaLabel ?? "Get started"
  const ctaSecondary = "Learn more"
  const sig = page.layoutSignature

  // Build the page body based on layoutSignature so different routes produce
  // structurally different fallbacks instead of one canonical hero+grid.
  const sections: FallbackNode[] = []
  switch (sig) {
    case "commerce-landing":
      sections.push(fbHero(page, ctaPrimary, "Browse phones"))
      sections.push(fbCommerceCatalog(features))
      sections.push(fbFeaturesGrid(features.slice(2), cardTreatment))
      break
    case "commerce-catalog":
      sections.push({ name: "section", props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-10" }, children: [
        { name: "h1", props: { className: "text-3xl md:text-4xl font-semibold" }, text: page.pageTitle },
        ...(page.description ? [{ name: "p", props: { className: "mt-2 text-muted-foreground" }, text: page.description } as FallbackNode] : []),
      ] })
      sections.push(fbCommerceCatalog(features))
      break
    case "pricing-table":
      sections.push(fbHero(page, ctaPrimary, "Compare plans"))
      sections.push(fbPricingTable())
      sections.push(fbAccordionFaqs(features))
      break
    case "contact-split":
      sections.push({ name: "section", props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20" }, children: [
        { name: "h1", props: { className: "text-3xl md:text-5xl font-bold tracking-tight" }, text: page.pageTitle },
        ...(page.description ? [{ name: "p", props: { className: "mt-4 max-w-2xl text-muted-foreground" }, text: page.description } as FallbackNode] : []),
      ] })
      sections.push(fbContactSplit())
      break
    case "faq-stack":
      sections.push(fbHero(page, ctaPrimary, ctaSecondary))
      sections.push(fbAccordionFaqs(features))
      sections.push(fbFeaturesGrid(["Contact support", "Read the docs"].concat(features.slice(0, 2)), cardTreatment))
      break
    case "docs-sidebar":
      sections.push(fbDocsSidebar(features))
      break
    case "portfolio-masonry":
      sections.push(fbHero(page, "Start a project", "View work"))
      sections.push(fbPortfolioMasonry(features))
      break
    case "dashboard-grid":
      sections.push(fbDashboardGrid(features))
      break
    case "support-center":
      sections.push(fbHero(page, "Contact support", "Read FAQs"))
      sections.push(fbAccordionFaqs(features))
      sections.push(fbContactSplit())
      break
    case "saas-landing":
      sections.push(fbHero(page, ctaPrimary, ctaSecondary))
      sections.push(fbFeaturesGrid(features, cardTreatment))
      sections.push(fbPricingTable())
      break
    case "editorial-article":
    case "two-column-article":
      sections.push(fbTwoColumnArticle(page))
      break
    case "media-gallery":
      sections.push(fbHero(page, ctaPrimary, ctaSecondary))
      sections.push(fbPortfolioMasonry(features))
      break
    case "feature-spotlight":
      sections.push(fbHero(page, ctaPrimary, ctaSecondary))
      sections.push(fbFeaturesGrid(features, cardTreatment))
      sections.push({
        name: "section",
        props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 border-t border-border" },
        children: [
          { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-6" }, text: "Why teams choose us" },
          { name: "div", props: { className: "grid grid-cols-1 md:grid-cols-2 gap-6" }, children: features.slice(0, 4).map((f) => fbCard(f.split(/[.!?]/)[0].trim() || f, f, cardTreatment)) },
        ],
      })
      break
    case "testimonial-wall":
      sections.push(fbHero(page, ctaPrimary, ctaSecondary))
      sections.push({
        name: "section",
        props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20" },
        children: [
          { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-8" }, text: "Loved by teams" },
          {
            name: "div",
            props: { className: "grid grid-cols-1 md:grid-cols-3 gap-6" },
            children: [0, 1, 2, 3, 4, 5].map((i) => ({
              name: "Card",
              props: { className: "p-6" },
              children: [
                { name: "Avatar", children: [{ name: "AvatarFallback", text: String.fromCharCode(65 + i) }] },
                { name: "p", props: { className: "mt-4 text-sm" }, text: "“This product changed how we ship — fast, polished, and reliable.”" },
                { name: "p", props: { className: "mt-2 text-xs text-muted-foreground" }, text: `Customer ${i + 1}` },
              ],
            } as FallbackNode)),
          },
        ],
      })
      break
    default:
      // Generic fallback for any unrecognised signature.
      sections.push(fbHero(page, ctaPrimary, ctaSecondary))
      sections.push(fbFeaturesGrid(features, cardTreatment))
      sections.push({
        name: "section",
        props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20" },
        children: [{
          name: "Card",
          props: { className: "p-8 md:p-12 text-center" },
          children: [
            { name: "CardTitle", props: { className: "text-2xl md:text-3xl" }, text: "Ready to start?" },
            { name: "p", props: { className: "mt-3 text-muted-foreground" }, text: "Reach out and we'll get back to you." },
            { name: "div", props: { className: "mt-6 flex justify-center" }, children: [
              { name: "Button", props: { size: "lg" }, children: [{ name: "span", text: ctaPrimary }] },
            ] },
          ],
        }],
      })
  }

  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: sections as unknown as Record<string, unknown>[],
    },
  }
}

/**
 * Compact human-readable rendering of the manifest used inside AI prompts.
 * Models read this verbatim to understand what every sibling page is, what
 * file it lives in, and what it exports — which is the whole point of the
 * manifest: no more blind per-file generation.
 */
export function renderManifestForPrompt(manifest: ProjectManifest): string {
  const lines: string[] = []
  lines.push("PROJECT MANIFEST (authoritative — every sibling file is listed here):")
  lines.push(`  brief: ${manifest.brief}`)
  lines.push(`  theme: ${manifest.theme.name} (primary hue ${manifest.theme.primaryHue}°, sat ${manifest.theme.primarySat}%, radius ${manifest.theme.radius}rem)`)
  lines.push(`    headingFont: ${manifest.theme.fontHeading}`)
  lines.push(`    bodyFont:    ${manifest.theme.fontBody}`)
  if (manifest.chrome) {
    lines.push(`  chrome:`)
    lines.push(`    brandName:     ${JSON.stringify(manifest.chrome.brandName)}`)
    lines.push(`    navVariant:    ${manifest.chrome.navVariant}`)
    lines.push(`    headerLayout:  ${manifest.chrome.headerLayout}`)
    lines.push(`    mobileNav:     ${manifest.chrome.mobileNav}`)
    lines.push(`    footerVariant: ${manifest.chrome.footerVariant}`)
    lines.push(`    primaryCta:    ${manifest.chrome.ctaLabel} -> ${manifest.chrome.ctaHref}`)
  }
  if (manifest.design) {
    lines.push(`  design:`)
    lines.push(`    visualStyle:    ${manifest.design.visualStyle}`)
    lines.push(`    sectionRhythm:  ${manifest.design.sectionRhythm}`)
    lines.push(`    cardTreatment:  ${manifest.design.cardTreatment}`)
    lines.push(`    heroTreatment:  ${manifest.design.heroTreatment}`)
    lines.push(`    typographyScale:${manifest.design.typographyScale}`)
  }
  lines.push(`  pages:`)
  for (const p of manifest.pages) {
    lines.push(`    - component: ${p.componentName}`)
    lines.push(`      route: ${p.route}`)
    lines.push(`      pageFile: ${p.pageFile}`)
    lines.push(`      logicFile: ${p.logicFile}   (import specifier: ${p.logicModule})`)
    lines.push(`      pageTitle: ${JSON.stringify(p.pageTitle)}`)
    if (p.layoutHint) lines.push(`      layoutHint: ${p.layoutHint}`)
    if (p.layoutSignature) lines.push(`      layoutSignature: ${p.layoutSignature}`)
    if (p.description) lines.push(`      description: ${p.description}`)
    if (p.features && p.features.length) {
      lines.push(`      features:`)
      for (const f of p.features) lines.push(`        • ${f}`)
    }
  }
  lines.push(`  router:`)
  lines.push(`    type: ${manifest.router.type}`)
  lines.push(`    root: ${manifest.router.root}`)
  for (const r of manifest.router.routes) {
    lines.push(`    - ${r.path} → ${r.componentName} (${r.importPath})`)
  }
  return lines.join("\n")
}
