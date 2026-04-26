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

import type { PlanEntry, PlanContentType } from "./plan-types"

// Layout structure hint. Each name maps to a concrete page-body skeleton the
// Style stage MUST honour, AND to a fallback builder (see buildFallbackTree)
// so the page is never blank.
export type LayoutHint =
  | "commerce-landing"
  | "commerce-catalog"
  | "split-hero"
  | "centered-hero"
  | "full-bleed-hero"
  | "bento-landing"
  | "feature-spotlight"
  | "pricing-table"
  | "contact-split"
  | "faq-stack"
  | "docs-sidebar"
  | "dashboard-grid"
  | "portfolio-masonry"
  | "case-study"
  | "testimonial-wall"
  | "support-center"
  | "two-column-article"
  | "media-gallery"
  | "sidebar-content"
  | "table-dashboard"

// High-level "what does this page DO" axis. Used by the architect to pick a
// layoutHint, and by the converter to choose a layout-aware fallback when
// the model output is rejected.
export type PageRole =
  | "landing"
  | "catalog"
  | "pricing"
  | "contact"
  | "support"
  | "about"
  | "dashboard"
  | "docs"
  | "blog"
  | "gallery"
  | "trade-in"
  | "cart"
  | "auth"

// Compact name for the canonical sequence of sections on a page (e.g. for
// commerce landing it's hero → product cards → trust row → CTA). The Style
// prompt surfaces this verbatim to the model so two pages with the same
// layout hint still emit different sequences when their signature differs.
export type SectionSignature =
  | "hero-products-trust-cta"
  | "hero-bento-features-proof"
  | "hero-article-aside-cta"
  | "stats-tabs-table-summary"
  | "form-info-map-hours"
  | "search-categories-articles-contact"
  | "gallery-case-studies-testimonials"
  | "hero-features-cta"
  | "hero-accordion-contact"
  | "hero-pricing-comparison"
  | "hero-grid-cta"

export type Density = "compact" | "balanced" | "spacious"

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
  /** Primary action ("happy path") for the page, e.g. "Shop now". */
  primaryAction?: string
  /** Optional secondary action, e.g. "View deals". */
  secondaryAction?: string
  /**
   * Layout structure hint set by the architect. The Style stage uses this to
   * render structurally different pages instead of repeating a single
   * template across every route.
   */
  layoutHint: LayoutHint
  /** Canonical section sequence label for this page. */
  sectionSignature: SectionSignature
  /** What this page DOES (drives layout & fallback selection). */
  pageRole: PageRole
  /** Visual density target for the page. */
  density: Density
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

// ---------------------------------------------------------------------------
// ProjectChrome — picked ONCE per website. Tells the Vite scaffold which
// site-shell variant to emit (header layout, mobile nav style, footer
// variant, brand label / CTA). Without this, every generated site got the
// same hardcoded SiteNav.
// ---------------------------------------------------------------------------

export type NavVariant =
  | "commerce"
  | "saas"
  | "editorial"
  | "portfolio"
  | "app"
  | "docs"
  | "agency"

export type HeaderLayout =
  | "left-brand-center-nav-right-actions"
  | "left-brand-right-nav"
  | "centered-brand-split-nav"
  | "commerce-search-nav"
  | "app-sidebar-topbar"

export type MobileNav = "fullscreen-sheet" | "bottom-drawer"
export type FooterVariant = "simple" | "multi-column" | "newsletter" | "minimal"

export interface ProjectChrome {
  brandName: string
  navVariant: NavVariant
  headerLayout: HeaderLayout
  mobileNav: MobileNav
  footerVariant: FooterVariant
  ctaLabel: string
  ctaHref: string
}

// ---------------------------------------------------------------------------
// DesignGenome — high-level visual fingerprint that prevents every site from
// having the same semantic look. The Style stage reads this and adapts copy
// rhythm + card treatment + hero treatment.
// ---------------------------------------------------------------------------

export type VisualStyle =
  | "minimal-saas"
  | "editorial"
  | "premium-commerce"
  | "playful-startup"
  | "technical-docs"
  | "bold-agency"
  | "calm-wellness"
  | "data-dashboard"

export type SectionRhythm =
  | "stacked"
  | "alternating"
  | "bento"
  | "sidebar"
  | "magazine"
  | "dashboard-grid"

export type CardTreatment = "flat" | "outlined" | "elevated" | "glass" | "dense"
export type HeroTreatment =
  | "split"
  | "centered"
  | "bento"
  | "media-led"
  | "dashboard"
  | "commerce"
export type TypographyScale = "compact" | "standard" | "display"
export type MotionLevel = "none" | "subtle"

export interface DesignGenome {
  visualStyle: VisualStyle
  sectionRhythm: SectionRhythm
  cardTreatment: CardTreatment
  heroTreatment: HeroTreatment
  typographyScale: TypographyScale
  motionLevel: MotionLevel
}

export interface ProjectManifest {
  /** Full website brief the user typed into the builder. */
  brief: string
  pages: ManifestPage[]
  router: ManifestRouter
  /** Per-site theme fingerprint (set by buildProjectManifest). */
  theme: ProjectTheme
  /** Chosen ONCE per website — drives the Vite scaffold's site shell. */
  chrome: ProjectChrome
  /** High-level visual fingerprint applied to every page body. */
  design: DesignGenome
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

// ---------------------------------------------------------------------------
// Semantic detection — read the brief + plan to bias chrome / design
// selection. Pure function, no AI call.
// ---------------------------------------------------------------------------

interface SemanticHints {
  isCommerce: boolean
  isDocs: boolean
  isPortfolio: boolean
  isDashboard: boolean
  isWellness: boolean
  isSaas: boolean
  isAgency: boolean
  isEditorial: boolean
}

function detectHints(brief: string, plan: PlanEntry[]): SemanticHints {
  const text = (
    brief +
    " " +
    plan.map((p) => `${p.path} ${p.title} ${p.description ?? ""} ${(p.features ?? []).join(" ")}`).join(" ")
  ).toLowerCase()
  const has = (...words: string[]): boolean => words.some((w) => text.includes(w))
  return {
    isCommerce: has(
      "shop", "store", "cart", "product", "phone", "deal", "ecommerce", "checkout",
      "trade-in", "trade in", "buy", "purchase", "catalog", "catalogue", "sku",
    ),
    isDocs: has("docs", "documentation", "api reference", "knowledge base", "help center", "guide"),
    isPortfolio: has("portfolio", "gallery", "studio", "artist", "creator", "case study", "case-study"),
    isDashboard: has("dashboard", "admin", "analytics", "crm", "metrics", "reporting"),
    isWellness: has("yoga", "wellness", "clinic", "spa", "meditation", "therapy", "fitness"),
    isSaas: has("saas", "platform", "subscription", "tenant", "workspace", "dashboard for"),
    isAgency: has("agency", "branding", "creative", "design studio", "marketing agency"),
    isEditorial: has("blog", "magazine", "newsletter", "editorial", "journal", "writer"),
  }
}

function pickVisualStyle(hints: SemanticHints): VisualStyle {
  if (hints.isCommerce) return "premium-commerce"
  if (hints.isDocs) return "technical-docs"
  if (hints.isDashboard) return "data-dashboard"
  if (hints.isWellness) return "calm-wellness"
  if (hints.isAgency) return "bold-agency"
  if (hints.isPortfolio) return "editorial"
  if (hints.isEditorial) return "editorial"
  return "minimal-saas"
}

function pickSectionRhythm(style: VisualStyle): SectionRhythm {
  switch (style) {
    case "premium-commerce":   return "bento"
    case "technical-docs":     return "sidebar"
    case "data-dashboard":     return "dashboard-grid"
    case "editorial":          return "magazine"
    case "bold-agency":        return "alternating"
    case "calm-wellness":      return "stacked"
    case "playful-startup":    return "bento"
    case "minimal-saas":       return "stacked"
  }
}

function pickCardTreatment(style: VisualStyle): CardTreatment {
  switch (style) {
    case "premium-commerce":   return "elevated"
    case "technical-docs":     return "outlined"
    case "data-dashboard":     return "dense"
    case "editorial":          return "flat"
    case "bold-agency":        return "elevated"
    case "calm-wellness":      return "outlined"
    case "playful-startup":    return "glass"
    case "minimal-saas":       return "outlined"
  }
}

function pickHeroTreatment(style: VisualStyle): HeroTreatment {
  switch (style) {
    case "premium-commerce":   return "commerce"
    case "technical-docs":     return "centered"
    case "data-dashboard":     return "dashboard"
    case "editorial":          return "media-led"
    case "bold-agency":        return "split"
    case "calm-wellness":      return "centered"
    case "playful-startup":    return "bento"
    case "minimal-saas":       return "split"
  }
}

function pickTypography(style: VisualStyle): TypographyScale {
  if (style === "data-dashboard" || style === "technical-docs") return "compact"
  if (style === "bold-agency" || style === "editorial") return "display"
  return "standard"
}

export function pickDesignGenome(brief: string, plan: PlanEntry[]): DesignGenome {
  const hints = detectHints(brief, plan)
  const visualStyle = pickVisualStyle(hints)
  return {
    visualStyle,
    sectionRhythm: pickSectionRhythm(visualStyle),
    cardTreatment: pickCardTreatment(visualStyle),
    heroTreatment: pickHeroTreatment(visualStyle),
    typographyScale: pickTypography(visualStyle),
    motionLevel: visualStyle === "minimal-saas" || visualStyle === "calm-wellness" ? "subtle" : "subtle",
  }
}

function pickNavVariant(hints: SemanticHints): NavVariant {
  if (hints.isCommerce) return "commerce"
  if (hints.isDocs) return "docs"
  if (hints.isPortfolio) return "portfolio"
  if (hints.isDashboard) return "app"
  if (hints.isAgency) return "agency"
  if (hints.isEditorial) return "editorial"
  return "saas"
}

function pickHeaderLayout(navVariant: NavVariant): HeaderLayout {
  switch (navVariant) {
    case "commerce":  return "commerce-search-nav"
    case "saas":      return "left-brand-center-nav-right-actions"
    case "editorial": return "centered-brand-split-nav"
    case "portfolio": return "left-brand-right-nav"
    case "app":       return "app-sidebar-topbar"
    case "docs":      return "left-brand-center-nav-right-actions"
    case "agency":    return "left-brand-right-nav"
  }
}

function pickFooterVariant(navVariant: NavVariant): FooterVariant {
  switch (navVariant) {
    case "commerce":  return "multi-column"
    case "saas":      return "newsletter"
    case "editorial": return "newsletter"
    case "portfolio": return "minimal"
    case "app":       return "simple"
    case "docs":      return "multi-column"
    case "agency":    return "minimal"
  }
}

function pickBrandName(brief: string): string {
  // Try the first capitalised word that isn't an article. Falls back to a
  // friendly default so we never end up with an empty brand.
  const words = (brief.match(/[A-Z][A-Za-z0-9]+/g) ?? []).filter(
    (w) => !["A", "An", "The", "I", "It", "You"].includes(w),
  )
  if (words.length > 0) return words[0]
  // Otherwise pick the first non-trivial lowercase noun and capitalise it.
  const lower = brief.toLowerCase().match(/[a-z]{4,}/g) ?? []
  const stop = new Set(["with", "that", "this", "your", "from", "have", "create", "build", "make", "site", "website", "page", "app"])
  const noun = lower.find((w) => !stop.has(w))
  if (noun) return noun.charAt(0).toUpperCase() + noun.slice(1)
  return "Studio"
}

function pickCtaForChrome(navVariant: NavVariant, plan: PlanEntry[]): { ctaLabel: string; ctaHref: string } {
  // Prefer a plan-derived CTA: scan the plan for routes whose role hints at
  // "the action page" (cart / contact / pricing / signup).
  const candidates: Array<{ matches: RegExp; label: string }> = navVariant === "commerce"
    ? [
        { matches: /\/(cart|checkout)$/, label: "View cart" },
        { matches: /\/(deals?|offers?|sale)$/, label: "Shop deals" },
        { matches: /\/(shop|store|products?|phones?|catalog)$/, label: "Shop now" },
      ]
    : navVariant === "docs"
    ? [
        { matches: /\/(docs|guide|getting-started)$/, label: "Read docs" },
        { matches: /\/(api)$/, label: "API reference" },
      ]
    : navVariant === "portfolio" || navVariant === "agency"
    ? [
        { matches: /\/(contact|hire)$/, label: "Hire us" },
        { matches: /\/(work|projects?|case-stud(?:y|ies))$/, label: "See work" },
      ]
    : navVariant === "app"
    ? [
        { matches: /\/(login|sign-in|signin)$/, label: "Sign in" },
        { matches: /\/(dashboard)$/, label: "Open dashboard" },
      ]
    : [
        { matches: /\/(pricing|plans?)$/, label: "See pricing" },
        { matches: /\/(contact)$/, label: "Get in touch" },
        { matches: /\/(signup|register|start)$/, label: "Get started" },
      ]

  for (const c of candidates) {
    const match = plan.find((p) => c.matches.test(p.path))
    if (match) return { ctaLabel: c.label, ctaHref: match.path }
  }

  // Generic fallback: link to whichever non-root route exists, or just /.
  const fallback = plan.find((p) => p.path !== "/")
  return {
    ctaLabel:
      navVariant === "commerce"
        ? "Shop now"
        : navVariant === "docs"
        ? "Read docs"
        : navVariant === "portfolio" || navVariant === "agency"
        ? "Get in touch"
        : "Get started",
    ctaHref: fallback?.path ?? "/",
  }
}

export function pickChrome(brief: string, plan: PlanEntry[]): ProjectChrome {
  const hints = detectHints(brief, plan)
  const navVariant = pickNavVariant(hints)
  const { ctaLabel, ctaHref } = pickCtaForChrome(navVariant, plan)
  return {
    brandName: pickBrandName(brief),
    navVariant,
    headerLayout: pickHeaderLayout(navVariant),
    mobileNav: navVariant === "commerce" || navVariant === "app" ? "bottom-drawer" : "fullscreen-sheet",
    footerVariant: pickFooterVariant(navVariant),
    ctaLabel,
    ctaHref,
  }
}

// ---------------------------------------------------------------------------
// Page-role / layout-hint / section-signature assignment
// ---------------------------------------------------------------------------

const ROUTE_ROLE_PATTERNS: Array<{ matches: RegExp; role: PageRole; layoutHint: LayoutHint; signature: SectionSignature }> = [
  { matches: /^\/?$/,                                 role: "landing",   layoutHint: "full-bleed-hero",   signature: "hero-features-cta" },
  { matches: /\/(phones?|store|shop|products?|catalog|catalogue)$/, role: "catalog",  layoutHint: "commerce-catalog",  signature: "hero-grid-cta" },
  { matches: /\/(deals?|offers?|sale)$/,              role: "catalog",   layoutHint: "bento-landing",     signature: "hero-bento-features-proof" },
  { matches: /\/(trade-in|tradein)$/,                 role: "trade-in",  layoutHint: "contact-split",     signature: "form-info-map-hours" },
  { matches: /\/(cart|checkout|bag)$/,                role: "cart",      layoutHint: "table-dashboard",   signature: "stats-tabs-table-summary" },
  { matches: /\/(support|help|center|service)$/,      role: "support",   layoutHint: "support-center",    signature: "search-categories-articles-contact" },
  { matches: /\/(faq|questions?)$/,                   role: "support",   layoutHint: "faq-stack",         signature: "hero-accordion-contact" },
  { matches: /\/(pricing|plans?)$/,                   role: "pricing",   layoutHint: "pricing-table",     signature: "hero-pricing-comparison" },
  { matches: /\/(contact|reach-out)$/,                role: "contact",   layoutHint: "contact-split",     signature: "form-info-map-hours" },
  { matches: /\/(about|story|team)$/,                 role: "about",     layoutHint: "two-column-article",signature: "hero-article-aside-cta" },
  { matches: /\/(docs|documentation|guide)$/,         role: "docs",      layoutHint: "docs-sidebar",      signature: "search-categories-articles-contact" },
  { matches: /\/(api)$/,                              role: "docs",      layoutHint: "docs-sidebar",      signature: "search-categories-articles-contact" },
  { matches: /\/(blog|news|posts?|articles?)$/,       role: "blog",      layoutHint: "sidebar-content",   signature: "hero-grid-cta" },
  { matches: /\/(portfolio|work|projects?|gallery)$/, role: "gallery",   layoutHint: "portfolio-masonry", signature: "gallery-case-studies-testimonials" },
  { matches: /\/(case-stud(?:y|ies))$/,               role: "gallery",   layoutHint: "case-study",        signature: "gallery-case-studies-testimonials" },
  { matches: /\/(testimonials?)$/,                    role: "about",     layoutHint: "testimonial-wall",  signature: "gallery-case-studies-testimonials" },
  { matches: /\/(features?)$/,                        role: "landing",   layoutHint: "feature-spotlight", signature: "hero-bento-features-proof" },
  { matches: /\/(dashboard|admin|analytics)$/,        role: "dashboard", layoutHint: "dashboard-grid",    signature: "stats-tabs-table-summary" },
  { matches: /\/(login|sign-?in|signin|register|sign-?up|signup|auth)$/, role: "auth", layoutHint: "centered-hero", signature: "form-info-map-hours" },
]

// Layouts considered "interchangeable enough" for fallback rotation when
// there's no semantic match for a route. Ordering matters: we cycle through
// these in deterministic-but-varied order driven by the brief hash.
const FALLBACK_LAYOUTS_BY_VISUAL: Record<VisualStyle, LayoutHint[]> = {
  "premium-commerce": ["commerce-landing", "bento-landing", "feature-spotlight", "testimonial-wall", "support-center", "faq-stack"],
  "technical-docs":   ["docs-sidebar", "feature-spotlight", "faq-stack", "two-column-article"],
  "data-dashboard":   ["dashboard-grid", "table-dashboard", "feature-spotlight", "split-hero"],
  "editorial":        ["two-column-article", "media-gallery", "feature-spotlight", "testimonial-wall", "split-hero"],
  "bold-agency":      ["split-hero", "case-study", "portfolio-masonry", "feature-spotlight", "testimonial-wall"],
  "calm-wellness":    ["centered-hero", "feature-spotlight", "two-column-article", "faq-stack", "contact-split"],
  "playful-startup":  ["bento-landing", "feature-spotlight", "split-hero", "testimonial-wall"],
  "minimal-saas":     ["split-hero", "feature-spotlight", "pricing-table", "testimonial-wall", "faq-stack"],
}

function defaultPageRoleFromContentType(content?: PlanContentType, fallback: PageRole = "landing"): PageRole {
  switch (content) {
    case "commerce":   return "catalog"
    case "dashboard":  return "dashboard"
    case "docs":       return "docs"
    case "portfolio":  return "gallery"
    case "support":    return "support"
    case "blog":       return "blog"
    case "marketing":  return "landing"
    default:           return fallback
  }
}

function densityForRole(role: PageRole): Density {
  switch (role) {
    case "dashboard": case "catalog": case "support": return "compact"
    case "docs": case "blog":                          return "balanced"
    case "landing": case "about": case "contact":     return "spacious"
    default:                                           return "balanced"
  }
}

interface LayoutAssignment {
  pageRole: PageRole
  layoutHint: LayoutHint
  sectionSignature: SectionSignature
  density: Density
}

function assignLayoutForEntry(
  entry: PlanEntry,
  index: number,
  prev: LayoutAssignment | undefined,
  brief: string,
  design: DesignGenome,
): LayoutAssignment {
  const path = entry.path.toLowerCase()
  const matched = ROUTE_ROLE_PATTERNS.find((r) => r.matches.test(path))

  let pageRole: PageRole = matched?.role ?? defaultPageRoleFromContentType(entry.contentType, index === 0 ? "landing" : "landing")
  let layoutHint: LayoutHint = matched?.layoutHint ?? "full-bleed-hero"
  let signature: SectionSignature = matched?.signature ?? "hero-features-cta"

  if (!matched) {
    const pool = FALLBACK_LAYOUTS_BY_VISUAL[design.visualStyle]
    const offset = (hashBrief(brief) + index) % pool.length
    layoutHint = pool[offset]
  }

  // Avoid the same layout twice in a row even when the second route matched
  // a generic pattern — the spec calls this out explicitly.
  if (prev && prev.layoutHint === layoutHint) {
    const pool = FALLBACK_LAYOUTS_BY_VISUAL[design.visualStyle]
    const idx = pool.indexOf(layoutHint)
    if (idx >= 0) layoutHint = pool[(idx + 1) % pool.length]
  }

  // Override layoutHint for a commerce-styled landing so the home of a phone
  // shop doesn't accidentally use a generic SaaS hero.
  if (index === 0 && (design.visualStyle === "premium-commerce")) {
    layoutHint = "commerce-landing"
    signature = "hero-products-trust-cta"
  }

  return {
    pageRole,
    layoutHint,
    sectionSignature: signature,
    density: densityForRole(pageRole),
  }
}

// ---------------------------------------------------------------------------
// PascalCase / slug helpers
// ---------------------------------------------------------------------------

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
  const theme = pickTheme(brief)
  const design = pickDesignGenome(brief, plan)
  const chrome = pickChrome(brief, plan)

  let prevAssignment: LayoutAssignment | undefined
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

    const assignment = assignLayoutForEntry(p, i, prevAssignment, brief, design)
    prevAssignment = assignment

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
      primaryAction: p.primaryAction,
      secondaryAction: p.secondaryAction,
      ...assignment,
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

  return { brief, pages, router, theme, chrome, design }
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

// ---------------------------------------------------------------------------
// Layout-aware fallback builders
//
// When the model fails to produce a usable tree we deterministically build
// one from the manifest entry — but the OLD code used the same hero+grid+CTA
// skeleton for every page role. The spec calls out specifically that
// fallbacks must be layout-aware, so each page role gets its own builder.
// ---------------------------------------------------------------------------

type UiNode = { name: string; props?: Record<string, unknown>; text?: string; children?: UiNode[] }
type UiEnvelope = { type: "ui-tree"; version: "1.0"; component: UiNode }

function nonEmptyFeatures(page: ManifestPage): string[] {
  return (page.features ?? []).filter((f) => typeof f === "string" && f.trim().length > 0)
}

function heroNode(page: ManifestPage, primaryLabel = "Get started", secondaryLabel?: string): UiNode {
  return {
    name: "section",
    props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24" },
    children: [
      { name: "h1", props: { className: "text-4xl md:text-6xl font-bold tracking-tight" }, text: page.pageTitle },
      ...(page.description
        ? [{ name: "p", props: { className: "mt-6 max-w-2xl text-lg text-muted-foreground" }, text: page.description }]
        : []),
      {
        name: "div",
        props: { className: "mt-8 flex flex-wrap gap-3" },
        children: [
          { name: "Button", props: { size: "lg" }, children: [{ name: "span", text: page.primaryAction || primaryLabel }] },
          ...(secondaryLabel || page.secondaryAction
            ? [{ name: "Button", props: { size: "lg", variant: "outline" }, children: [{ name: "span", text: page.secondaryAction || secondaryLabel || "Learn more" }] }]
            : []),
        ],
      },
    ],
  }
}

function commerceLandingFallback(page: ManifestPage): UiEnvelope {
  const features = nonEmptyFeatures(page)
  const products = (features.length > 0 ? features.slice(0, 3) : ["Latest model", "Best value", "Trade-in deal"]).map(
    (label, i) => ({
      name: "Card",
      props: { className: "p-4" },
      children: [
        { name: "AspectRatio", props: { ratio: 4 / 5, className: "rounded-md bg-muted" }, children: [] },
        { name: "div", props: { className: "mt-3" }, children: [
          { name: "Badge", children: [{ name: "span", text: i === 0 ? "Featured" : i === 1 ? "Best value" : "Limited" }] },
        ] },
        { name: "h3", props: { className: "mt-2 text-lg font-semibold" }, text: label.split(/[.!?]/)[0].trim() || label },
        { name: "p", props: { className: "mt-1 text-sm text-muted-foreground" }, text: label },
        { name: "div", props: { className: "mt-3" }, children: [
          { name: "Button", props: { size: "sm" }, children: [{ name: "span", text: "Add to cart" }] },
        ] },
      ],
    }),
  )
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page, "Shop now", "View deals"),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 border-t border-border" },
          children: [
            { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-8" }, text: "Featured products" },
            { name: "div", props: { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" }, children: products },
          ],
        },
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16 border-t border-border" },
          children: [
            { name: "div", props: { className: "grid grid-cols-2 md:grid-cols-4 gap-6 text-center" }, children: [
              { name: "div", children: [{ name: "p", props: { className: "text-3xl font-bold" }, text: "1M+" }, { name: "p", props: { className: "text-sm text-muted-foreground" }, text: "Happy customers" }] },
              { name: "div", children: [{ name: "p", props: { className: "text-3xl font-bold" }, text: "30 days" }, { name: "p", props: { className: "text-sm text-muted-foreground" }, text: "Easy returns" }] },
              { name: "div", children: [{ name: "p", props: { className: "text-3xl font-bold" }, text: "24/7" }, { name: "p", props: { className: "text-sm text-muted-foreground" }, text: "Support" }] },
              { name: "div", children: [{ name: "p", props: { className: "text-3xl font-bold" }, text: "Free" }, { name: "p", props: { className: "text-sm text-muted-foreground" }, text: "Shipping over $50" }] },
            ] },
          ],
        },
      ],
    },
  }
}

function catalogFallback(page: ManifestPage): UiEnvelope {
  const features = nonEmptyFeatures(page)
  const items = (features.length > 0 ? features : ["Item A", "Item B", "Item C", "Item D", "Item E", "Item F"]).slice(0, 8).map((f) => ({
    name: "Card",
    props: { className: "p-4" },
    children: [
      { name: "AspectRatio", props: { ratio: 1, className: "rounded-md bg-muted" }, children: [] },
      { name: "h3", props: { className: "mt-3 text-base font-semibold" }, text: f.split(/[.!?]/)[0].trim() || f },
      { name: "p", props: { className: "mt-1 text-xs text-muted-foreground" }, text: f },
      { name: "Button", props: { size: "sm", className: "mt-3 w-full" }, children: [{ name: "span", text: "View" }] },
    ],
  }))
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page, "Browse catalog"),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-8" },
          children: [
            { name: "div", props: { className: "flex flex-wrap gap-2 mb-6" }, children: [
              { name: "Badge", children: [{ name: "span", text: "All" }] },
              { name: "Badge", props: { variant: "outline" }, children: [{ name: "span", text: "New" }] },
              { name: "Badge", props: { variant: "outline" }, children: [{ name: "span", text: "Popular" }] },
              { name: "Badge", props: { variant: "outline" }, children: [{ name: "span", text: "Sale" }] },
            ] },
            { name: "div", props: { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" }, children: items },
          ],
        },
      ],
    },
  }
}

function contactFallback(page: ManifestPage): UiEnvelope {
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page, "Send a message"),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-2 gap-10" },
          children: [
            {
              name: "Card",
              props: { className: "p-6" },
              children: [
                { name: "h2", props: { className: "text-xl font-semibold mb-4" }, text: "Get in touch" },
                { name: "form", props: { className: "space-y-4", onSubmit: "$handler.onSubmitContact" }, children: [
                  { name: "div", children: [
                    { name: "Label", props: { htmlFor: "name" }, children: [{ name: "span", text: "Name" }] },
                    { name: "Input", props: { id: "name", name: "name", placeholder: "Your name" } },
                  ] },
                  { name: "div", children: [
                    { name: "Label", props: { htmlFor: "email" }, children: [{ name: "span", text: "Email" }] },
                    { name: "Input", props: { id: "email", name: "email", type: "email", placeholder: "you@example.com" } },
                  ] },
                  { name: "div", children: [
                    { name: "Label", props: { htmlFor: "message" }, children: [{ name: "span", text: "Message" }] },
                    { name: "Textarea", props: { id: "message", name: "message", rows: 5 } },
                  ] },
                  { name: "Button", props: { type: "submit" }, children: [{ name: "span", text: "Send" }] },
                ] },
              ],
            },
            {
              name: "Card",
              props: { className: "p-6" },
              children: [
                { name: "h2", props: { className: "text-xl font-semibold mb-4" }, text: "Other ways to reach us" },
                { name: "ul", props: { className: "space-y-2 text-sm text-muted-foreground" }, children: [
                  { name: "li", text: "Email: hello@example.com" },
                  { name: "li", text: "Phone: +1 (555) 123-4567" },
                  { name: "li", text: "Hours: Mon–Fri, 9–6" },
                ] },
              ],
            },
          ],
        },
      ],
    },
  }
}

function pricingFallback(page: ManifestPage): UiEnvelope {
  const tiers = [
    { name: "Starter", price: "$0", desc: "For trying things out.", primary: false },
    { name: "Pro", price: "$19", desc: "Most popular plan.", primary: true },
    { name: "Team", price: "$49", desc: "For growing teams.", primary: false },
  ]
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page, "See pricing"),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-3 gap-6" },
          children: tiers.map((t) => ({
            name: "Card",
            props: { className: t.primary ? "p-6 border-primary" : "p-6" },
            children: [
              ...(t.primary ? [{ name: "Badge", children: [{ name: "span", text: "Most popular" }] }] : []),
              { name: "h3", props: { className: "mt-2 text-2xl font-semibold" }, text: t.name },
              { name: "p", props: { className: "mt-2 text-3xl font-bold" }, text: t.price + "/mo" },
              { name: "p", props: { className: "mt-2 text-sm text-muted-foreground" }, text: t.desc },
              { name: "Button", props: { className: "mt-6 w-full", variant: t.primary ? "default" : "outline" }, children: [{ name: "span", text: "Choose " + t.name }] },
            ],
          })),
        },
      ],
    },
  }
}

function faqFallback(page: ManifestPage): UiEnvelope {
  const items = nonEmptyFeatures(page).slice(0, 8).map((f, i) => ({
    name: "AccordionItem",
    props: { value: `q-${i + 1}` },
    children: [
      { name: "AccordionTrigger", children: [{ name: "span", text: f.split(/[.!?]/)[0].trim() || f }] },
      { name: "AccordionContent", children: [{ name: "p", text: f }] },
    ],
  }))
  if (items.length < 4) {
    const filler = ["How do I get started?", "Is there a free trial?", "How does billing work?", "Can I cancel any time?"]
    while (items.length < 4) {
      const text = filler[items.length] ?? "Frequently asked"
      items.push({
        name: "AccordionItem",
        props: { value: `q-${items.length + 1}` },
        children: [
          { name: "AccordionTrigger", children: [{ name: "span", text }] },
          { name: "AccordionContent", children: [{ name: "p", text: "We'll get back to you with details soon." }] },
        ],
      })
    }
  }
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page, "Browse FAQ"),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 max-w-3xl" },
          children: [
            { name: "Accordion", props: { type: "single", collapsible: true }, children: items },
          ],
        },
      ],
    },
  }
}

function docsSidebarFallback(page: ManifestPage): UiEnvelope {
  const features = nonEmptyFeatures(page)
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page, "Read docs"),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-8" },
          children: [
            {
              name: "aside",
              props: { className: "lg:sticky lg:top-24 self-start" },
              children: [
                { name: "h3", props: { className: "text-sm font-semibold mb-3" }, text: "On this page" },
                { name: "ul", props: { className: "space-y-2 text-sm text-muted-foreground" }, children: features.slice(0, 6).map((f) => ({ name: "li", text: f.split(/[.!?]/)[0].trim() || f })) },
              ],
            },
            {
              name: "article",
              props: { className: "prose prose-neutral max-w-none dark:prose-invert" },
              children: features.map((f) => ({
                name: "section",
                props: { className: "mb-8" },
                children: [
                  { name: "h2", props: { className: "text-xl font-semibold mb-2" }, text: f.split(/[.!?]/)[0].trim() || f },
                  { name: "p", props: { className: "text-muted-foreground" }, text: f },
                ],
              })),
            },
          ],
        },
      ],
    },
  }
}

function portfolioFallback(page: ManifestPage): UiEnvelope {
  const works = (nonEmptyFeatures(page).length > 0 ? nonEmptyFeatures(page) : ["Project Alpha", "Project Beta", "Project Gamma", "Project Delta", "Project Epsilon", "Project Zeta"]).slice(0, 6)
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page, "See work"),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" },
          children: works.map((w, i) => ({
            name: "Card",
            props: { className: i % 5 === 0 ? "p-0 overflow-hidden lg:col-span-2" : "p-0 overflow-hidden" },
            children: [
              { name: "AspectRatio", props: { ratio: i % 5 === 0 ? 21 / 9 : 4 / 3, className: "bg-muted" }, children: [] },
              { name: "div", props: { className: "p-4" }, children: [
                { name: "h3", props: { className: "text-base font-semibold" }, text: w.split(/[.!?]/)[0].trim() || w },
                { name: "p", props: { className: "mt-1 text-sm text-muted-foreground" }, text: w },
              ] },
            ],
          })),
        },
      ],
    },
  }
}

function dashboardFallback(page: ManifestPage): UiEnvelope {
  const stats = ["Active users", "Revenue", "Conversion", "Sessions"].map((label, i) => ({
    name: "Card",
    props: { className: "p-4" },
    children: [
      { name: "p", props: { className: "text-xs text-muted-foreground" }, text: label },
      { name: "p", props: { className: "mt-1 text-2xl font-bold" }, text: ["12,438", "$48.2k", "3.4%", "84,902"][i] },
    ],
  }))
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page, "Open dashboard"),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-8" },
          children: [
            { name: "div", props: { className: "grid grid-cols-2 md:grid-cols-4 gap-4 mb-6" }, children: stats },
            { name: "Card", props: { className: "p-4" }, children: [
              { name: "h3", props: { className: "font-semibold mb-3" }, text: "Recent activity" },
              { name: "Table", children: [
                { name: "TableHeader", children: [{ name: "TableRow", children: [
                  { name: "TableHead", children: [{ name: "span", text: "User" }] },
                  { name: "TableHead", children: [{ name: "span", text: "Action" }] },
                  { name: "TableHead", children: [{ name: "span", text: "Time" }] },
                ] }] },
                { name: "TableBody", children: nonEmptyFeatures(page).slice(0, 5).map((f, i) => ({
                  name: "TableRow",
                  children: [
                    { name: "TableCell", children: [{ name: "span", text: `User ${i + 1}` }] },
                    { name: "TableCell", children: [{ name: "span", text: f.split(/[.!?]/)[0].trim() || f }] },
                    { name: "TableCell", children: [{ name: "span", text: `${i + 1}m ago` }] },
                  ],
                })) },
              ] },
            ] },
          ],
        },
      ],
    },
  }
}

function genericFallback(page: ManifestPage): UiEnvelope {
  const features = nonEmptyFeatures(page)
  const featureCards = features.length > 0
    ? features.slice(0, 6).map((f) => ({
        name: "Card",
        props: { className: "p-6" },
        children: [
          { name: "CardHeader", children: [{ name: "CardTitle", text: f.split(/[.!?]/)[0].trim() || f }] },
          { name: "CardContent", children: [{ name: "p", props: { className: "text-sm text-muted-foreground" }, text: f }] },
        ],
      }))
    : [{
        name: "Card",
        props: { className: "p-6" },
        children: [
          { name: "CardHeader", children: [{ name: "CardTitle", text: "Get started" }] },
          { name: "CardContent", children: [{ name: "p", props: { className: "text-sm text-muted-foreground" }, text: "Explore the site to learn more about what we offer." }] },
        ],
      }]
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: [
        heroNode(page),
        {
          name: "section",
          props: { className: "container mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20 border-t border-border" },
          children: [
            { name: "h2", props: { className: "text-2xl md:text-3xl font-semibold mb-8" }, text: "What you'll find here" },
            { name: "div", props: { className: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" }, children: featureCards },
          ],
        },
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
 * Build a deterministic, layout-aware UI tree for a page when the AI fails
 * to produce one. Selection is driven by the page role so a contact page
 * doesn't fall back to a hero+grid skeleton meant for a landing page.
 */
export function buildFallbackTree(page: ManifestPage): UiEnvelope {
  switch (page.pageRole) {
    case "catalog":   return catalogFallback(page)
    case "cart":      return dashboardFallback(page)
    case "contact":   return contactFallback(page)
    case "trade-in":  return contactFallback(page)
    case "pricing":   return pricingFallback(page)
    case "support":   return faqFallback(page)
    case "docs":      return docsSidebarFallback(page)
    case "blog":      return docsSidebarFallback(page)
    case "gallery":   return portfolioFallback(page)
    case "dashboard": return dashboardFallback(page)
    case "auth":      return contactFallback(page)
    case "landing":
      if (page.layoutHint === "commerce-landing") return commerceLandingFallback(page)
      return genericFallback(page)
    case "about":
    default:
      return genericFallback(page)
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
  lines.push(`  chrome:`)
  lines.push(`    brandName:    ${manifest.chrome.brandName}`)
  lines.push(`    navVariant:   ${manifest.chrome.navVariant}`)
  lines.push(`    headerLayout: ${manifest.chrome.headerLayout}`)
  lines.push(`    mobileNav:    ${manifest.chrome.mobileNav}`)
  lines.push(`    footerVariant:${manifest.chrome.footerVariant}`)
  lines.push(`    cta:          ${manifest.chrome.ctaLabel} → ${manifest.chrome.ctaHref}`)
  lines.push(`  design:`)
  lines.push(`    visualStyle:     ${manifest.design.visualStyle}`)
  lines.push(`    sectionRhythm:   ${manifest.design.sectionRhythm}`)
  lines.push(`    cardTreatment:   ${manifest.design.cardTreatment}`)
  lines.push(`    heroTreatment:   ${manifest.design.heroTreatment}`)
  lines.push(`    typographyScale: ${manifest.design.typographyScale}`)
  lines.push(`    motionLevel:     ${manifest.design.motionLevel}`)
  lines.push(`  pages:`)
  for (const p of manifest.pages) {
    lines.push(`    - component: ${p.componentName}`)
    lines.push(`      route: ${p.route}`)
    lines.push(`      pageFile: ${p.pageFile}`)
    lines.push(`      logicFile: ${p.logicFile}   (import specifier: ${p.logicModule})`)
    lines.push(`      pageTitle: ${JSON.stringify(p.pageTitle)}`)
    lines.push(`      pageRole:  ${p.pageRole}`)
    lines.push(`      layoutHint: ${p.layoutHint}`)
    lines.push(`      sectionSignature: ${p.sectionSignature}`)
    lines.push(`      density: ${p.density}`)
    if (p.primaryAction)   lines.push(`      primaryAction: ${p.primaryAction}`)
    if (p.secondaryAction) lines.push(`      secondaryAction: ${p.secondaryAction}`)
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
