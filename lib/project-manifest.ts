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

/**
 * Build a deterministic, substantive UI tree for a page when the AI fails to
 * produce one. Uses the manifest entry (title / description / features /
 * layoutHint) to render a real hero + features grid + CTA so the page is
 * NEVER blank. The shape is the standard converter envelope.
 */
export function buildFallbackTree(
  page: ManifestPage,
): { type: "ui-tree"; version: "1.0"; component: Record<string, unknown> } {
  const features = (page.features ?? []).filter((f) => typeof f === "string" && f.trim().length > 0)
  const featureCards = features.length > 0
    ? features.slice(0, 6).map((f) => ({
        name: "Card",
        props: { className: "p-6" },
        children: [
          { name: "CardHeader", children: [
            { name: "CardTitle", text: f.split(/[.!?]/)[0].trim() || f },
          ] },
          { name: "CardContent", children: [
            { name: "p", props: { className: "text-sm text-muted-foreground" }, text: f },
          ] },
        ],
      }))
    : [
        { name: "Card", props: { className: "p-6" }, children: [
          { name: "CardHeader", children: [{ name: "CardTitle", text: "Get started" }] },
          { name: "CardContent", children: [
            { name: "p", props: { className: "text-sm text-muted-foreground" }, text: "Explore the site to learn more about what we offer." },
          ] },
        ] },
      ]

  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        // Hero section
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24" },
          children: [
            { name: "h1", props: { className: "text-4xl md:text-6xl font-bold tracking-tight" }, text: page.pageTitle },
            ...(page.description
              ? [{ name: "p", props: { className: "mt-6 max-w-2xl text-lg text-muted-foreground" }, text: page.description }]
              : []),
            {
              name: "div",
              props: { className: "mt-8 flex flex-wrap gap-4" },
              children: [
                { name: "Button", props: { size: "lg" }, children: [{ name: "span", text: "Get started" }] },
                { name: "Button", props: { size: "lg", variant: "outline" }, children: [{ name: "span", text: "Learn more" }] },
              ],
            },
          ],
        },
        // Features grid
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 border-t border-border" },
          children: [
            { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-8" }, text: "What you'll find here" },
            {
              name: "div",
              props: { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" },
              children: featureCards,
            },
          ],
        },
        // CTA section
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20" },
          children: [
            {
              name: "Card",
              props: { className: "p-8 md:p-12 text-center" },
              children: [
                { name: "CardTitle", props: { className: "text-2xl md:text-3xl" }, text: "Ready to start?" },
                { name: "p", props: { className: "mt-3 text-muted-foreground" }, text: "Reach out and we'll get back to you." },
                { name: "div", props: { className: "mt-6 flex justify-center" }, children: [
                  { name: "Button", props: { size: "lg" }, children: [{ name: "span", text: "Contact us" }] },
                ] },
              ],
            },
          ],
        },
      ],
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
  lines.push(`  pages:`)
  for (const p of manifest.pages) {
    lines.push(`    - component: ${p.componentName}`)
    lines.push(`      route: ${p.route}`)
    lines.push(`      pageFile: ${p.pageFile}`)
    lines.push(`      logicFile: ${p.logicFile}   (import specifier: ${p.logicModule})`)
    lines.push(`      pageTitle: ${JSON.stringify(p.pageTitle)}`)
    if (p.layoutHint) lines.push(`      layoutHint: ${p.layoutHint}`)
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
