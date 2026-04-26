// Phase 3 ("Designing") of the rebuilt AI website-builder pipeline.
//
// Deterministically derives the site-level design metadata (chrome + design
// genome + per-page layout signature) from the user's brief. This is the
// step that fixes the "every site looks the same" / "every page renders the
// same hero" problem — by the time the Style stage runs, every page already
// knows what visual style the site uses, what nav variant the shell uses,
// and what layout signature THIS specific page should follow.
//
// Same brief in ⇒ same chrome/design out (no AI roundtrip).

import type { ManifestPage, ProjectManifest } from "./project-manifest"

// ─── ProjectChrome ─────────────────────────────────────────────────────────
// Site shell: header layout, mobile nav style, footer style, brand name and
// the single primary CTA the entire shell drives toward.

export type NavVariant =
  | "commerce"
  | "saas"
  | "editorial"
  | "portfolio"
  | "app"
  | "docs"
  | "agency"

export type HeaderLayout =
  | "left-brand-right-nav"
  | "left-brand-center-nav-right-actions"
  | "centered-brand-split-nav"
  | "commerce-search-nav"
  | "app-topbar"

export type FooterVariant = "simple" | "multi-column" | "newsletter" | "minimal"

export interface ProjectChrome {
  brandName: string
  navVariant: NavVariant
  headerLayout: HeaderLayout
  /** Mobile nav is always a full-width sheet — never a narrow w-64 drawer. */
  mobileNav: "fullscreen-sheet"
  footerVariant: FooterVariant
  ctaLabel: string
  ctaHref: string
}

// ─── DesignGenome ──────────────────────────────────────────────────────────
// Visual fingerprint of the site (the "look"): which family of design the
// site falls into, how sections rhythm, how cards feel, how the hero is
// composed, and the typography scale.

export type VisualStyle =
  | "minimal-saas"
  | "premium-commerce"
  | "editorial"
  | "bold-agency"
  | "technical-docs"
  | "portfolio"
  | "data-dashboard"
  | "calm-wellness"

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
  | "commerce"
  | "dashboard"

export type TypographyScale = "compact" | "standard" | "display"

export interface DesignGenome {
  visualStyle: VisualStyle
  sectionRhythm: SectionRhythm
  cardTreatment: CardTreatment
  heroTreatment: HeroTreatment
  typographyScale: TypographyScale
}

// ─── Layout signatures ─────────────────────────────────────────────────────
// The Architect already assigns each page a `layoutHint` (split-hero, …).
// In addition we attach a "layoutSignature" — a richer label coming straight
// from the spec — used by the Style fallback / Style prompt to decide what
// concrete sections to render. They overlap but the layout signature is
// always anchored to the page's role rather than its index.

export type LayoutSignature =
  | "commerce-landing"
  | "commerce-catalog"
  | "pricing-table"
  | "contact-split"
  | "faq-stack"
  | "docs-sidebar"
  | "portfolio-masonry"
  | "dashboard-grid"
  | "support-center"
  | "saas-landing"
  | "editorial-article"
  | "media-gallery"
  | "feature-spotlight"
  | "testimonial-wall"
  | "two-column-article"

// ─── Brief categorisation ──────────────────────────────────────────────────

export type SiteCategory =
  | "commerce"
  | "saas"
  | "docs"
  | "portfolio"
  | "dashboard"
  | "blog"
  | "support"
  | "agency"
  | "wellness"
  | "editorial"

const CATEGORY_KEYWORDS: Record<SiteCategory, string[]> = {
  commerce: [
    "shop", "store", "ecommerce", "e-commerce", "cart", "checkout", "phone shop",
    "marketplace", "product catalog", "buy", "sell", "retail", "boutique",
  ],
  saas: [
    "saas", "platform", "analytics", "tooling", "dashboard for", "admin panel",
    "subscription", "ai analytics", "developer tool", "api product", "workspace",
  ],
  docs: [
    "docs", "documentation", "developer docs", "api reference", "guides",
    "knowledge base", "handbook", "manual",
  ],
  portfolio: [
    "portfolio", "designer", "studio", "agency portfolio", "case study",
    "interior design", "photographer", "freelance", "designer portfolio",
  ],
  dashboard: [
    "admin", "dashboard", "internal tool", "back office", "ops console",
    "metrics", "manage orders", "analytics view",
  ],
  blog: ["blog", "magazine", "news site", "editorial", "publication"],
  support: ["support", "help center", "faq site", "customer service", "ticketing"],
  agency: ["agency", "consulting", "marketing agency", "creative studio"],
  wellness: [
    "yoga", "wellness", "spa", "meditation", "health coach", "mindfulness",
    "fitness studio",
  ],
  editorial: ["magazine", "longform", "publication", "journalism"],
}

export function detectCategory(brief: string): SiteCategory {
  const lower = brief.toLowerCase()
  let bestMatch: { cat: SiteCategory; hits: number } = { cat: "saas", hits: 0 }
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS) as [SiteCategory, string[]][]) {
    let hits = 0
    for (const k of kws) {
      if (lower.includes(k)) hits += 1
    }
    if (hits > bestMatch.hits) bestMatch = { cat, hits }
  }
  return bestMatch.hits > 0 ? bestMatch.cat : "saas"
}

// Extract a brand name from the brief — first capitalised word that isn't a
// common stopword, otherwise the first 2 nouns Title-Cased.
const STOPWORDS = new Set([
  "Build", "Create", "Generate", "Make", "A", "An", "The", "For", "Website",
  "Site", "Page", "App", "With", "Using", "And", "Or", "Of", "To", "From",
  "About", "Into", "On", "By", "Multi", "Page", "Multipage", "Multi-page",
  "Single", "Modern", "Clean", "Beautiful", "Great", "Awesome",
])

export function deriveBrandName(brief: string): string {
  const words = brief
    .split(/[\s\n\.,!?:;()\[\]"']+/)
    .filter((w) => w.length > 0)

  // Look for an explicit "called X", "named X", "for X" pattern first.
  for (let i = 0; i < words.length - 1; i++) {
    const head = words[i].toLowerCase()
    if (head === "called" || head === "named" || head === "for") {
      const candidate = words[i + 1].replace(/[^A-Za-z0-9]/g, "")
      if (candidate.length > 1 && !STOPWORDS.has(toTitle(candidate))) {
        return toTitle(candidate)
      }
    }
  }

  // Otherwise use the first non-stopword Title-Cased token.
  for (const raw of words) {
    const w = raw.replace(/[^A-Za-z0-9]/g, "")
    if (!w) continue
    const titled = toTitle(w)
    if (!STOPWORDS.has(titled) && titled.length > 1) {
      return titled
    }
  }
  return "Studio"
}

function toTitle(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
}

// ─── Chrome derivation ─────────────────────────────────────────────────────

const CATEGORY_TO_NAV: Record<SiteCategory, NavVariant> = {
  commerce: "commerce",
  saas: "saas",
  docs: "docs",
  portfolio: "portfolio",
  dashboard: "app",
  blog: "editorial",
  support: "saas",
  agency: "agency",
  wellness: "saas",
  editorial: "editorial",
}

const NAV_TO_HEADER: Record<NavVariant, HeaderLayout> = {
  commerce: "commerce-search-nav",
  saas: "left-brand-center-nav-right-actions",
  editorial: "centered-brand-split-nav",
  portfolio: "left-brand-right-nav",
  app: "app-topbar",
  docs: "left-brand-right-nav",
  agency: "centered-brand-split-nav",
}

const NAV_TO_FOOTER: Record<NavVariant, FooterVariant> = {
  commerce: "multi-column",
  saas: "newsletter",
  editorial: "minimal",
  portfolio: "minimal",
  app: "simple",
  docs: "simple",
  agency: "newsletter",
}

const NAV_TO_CTA: Record<NavVariant, { label: string; href: string }> = {
  commerce: { label: "Shop now", href: "/" },
  saas: { label: "Get started", href: "/" },
  editorial: { label: "Subscribe", href: "/" },
  portfolio: { label: "Start a project", href: "/contact" },
  app: { label: "Open app", href: "/" },
  docs: { label: "Read docs", href: "/" },
  agency: { label: "Work with us", href: "/contact" },
}

export function deriveProjectChrome(brief: string, category?: SiteCategory): ProjectChrome {
  const cat = category ?? detectCategory(brief)
  const navVariant = CATEGORY_TO_NAV[cat]
  const headerLayout = NAV_TO_HEADER[navVariant]
  const footerVariant = NAV_TO_FOOTER[navVariant]
  const cta = NAV_TO_CTA[navVariant]
  return {
    brandName: deriveBrandName(brief),
    navVariant,
    headerLayout,
    mobileNav: "fullscreen-sheet",
    footerVariant,
    ctaLabel: cta.label,
    ctaHref: cta.href,
  }
}

// ─── Design genome derivation ──────────────────────────────────────────────

const NAV_TO_VISUAL: Record<NavVariant, VisualStyle> = {
  commerce: "premium-commerce",
  saas: "minimal-saas",
  editorial: "editorial",
  portfolio: "portfolio",
  app: "data-dashboard",
  docs: "technical-docs",
  agency: "bold-agency",
}

const VISUAL_TO_RHYTHM: Record<VisualStyle, SectionRhythm> = {
  "premium-commerce": "bento",
  "minimal-saas": "stacked",
  editorial: "magazine",
  portfolio: "alternating",
  "data-dashboard": "dashboard-grid",
  "technical-docs": "sidebar",
  "bold-agency": "alternating",
  "calm-wellness": "stacked",
}

const VISUAL_TO_CARDS: Record<VisualStyle, CardTreatment> = {
  "premium-commerce": "elevated",
  "minimal-saas": "outlined",
  editorial: "flat",
  portfolio: "glass",
  "data-dashboard": "dense",
  "technical-docs": "outlined",
  "bold-agency": "elevated",
  "calm-wellness": "flat",
}

const VISUAL_TO_HERO: Record<VisualStyle, HeroTreatment> = {
  "premium-commerce": "commerce",
  "minimal-saas": "split",
  editorial: "centered",
  portfolio: "media-led",
  "data-dashboard": "dashboard",
  "technical-docs": "split",
  "bold-agency": "bento",
  "calm-wellness": "centered",
}

const VISUAL_TO_TYPE: Record<VisualStyle, TypographyScale> = {
  "premium-commerce": "standard",
  "minimal-saas": "compact",
  editorial: "display",
  portfolio: "display",
  "data-dashboard": "compact",
  "technical-docs": "compact",
  "bold-agency": "display",
  "calm-wellness": "standard",
}

export function deriveDesignGenome(chrome: ProjectChrome): DesignGenome {
  const visualStyle = NAV_TO_VISUAL[chrome.navVariant]
  return {
    visualStyle,
    sectionRhythm: VISUAL_TO_RHYTHM[visualStyle],
    cardTreatment: VISUAL_TO_CARDS[visualStyle],
    heroTreatment: VISUAL_TO_HERO[visualStyle],
    typographyScale: VISUAL_TO_TYPE[visualStyle],
  }
}

// ─── Per-page layout signature ────────────────────────────────────────────

const ROUTE_SIGNATURE: Array<[RegExp, LayoutSignature]> = [
  [/^\/$/, "saas-landing"],
  [/^\/(home|index)$/i, "saas-landing"],
  [/(phones|catalog|catalogue|products|shop|store|menu|inventory)/i, "commerce-catalog"],
  [/(deals|sales|specials|offers|promotions)/i, "commerce-landing"],
  [/(trade-?in|exchange|return)/i, "feature-spotlight"],
  [/(cart|checkout|basket|bag)/i, "contact-split"],
  [/(support|help|faq|knowledge)/i, "support-center"],
  [/(pricing|plans|subscription)/i, "pricing-table"],
  [/(about|story|company|team)/i, "two-column-article"],
  [/(contact|reach|locations)/i, "contact-split"],
  [/(docs|documentation|guide|reference|api)/i, "docs-sidebar"],
  [/(portfolio|projects|work|case|gallery)/i, "portfolio-masonry"],
  [/(blog|news|articles|posts|magazine)/i, "editorial-article"],
  [/(dashboard|metrics|analytics|reports|orders)/i, "dashboard-grid"],
  [/(testimonials|customers|reviews|social-proof)/i, "testimonial-wall"],
  [/(features|product)/i, "feature-spotlight"],
  [/(media|press|gallery|videos)/i, "media-gallery"],
  [/(faq|questions)/i, "faq-stack"],
]

const NAV_TO_HOME_SIGNATURE: Record<NavVariant, LayoutSignature> = {
  commerce: "commerce-landing",
  saas: "saas-landing",
  editorial: "editorial-article",
  portfolio: "portfolio-masonry",
  app: "dashboard-grid",
  docs: "docs-sidebar",
  agency: "saas-landing",
}

export function deriveLayoutSignature(
  page: ManifestPage,
  chrome: ProjectChrome,
): LayoutSignature {
  // The home route's layout reflects the site's category so the very first
  // impression matches what the visitor expects.
  if (page.route === "/") return NAV_TO_HOME_SIGNATURE[chrome.navVariant]
  for (const [re, sig] of ROUTE_SIGNATURE) {
    if (re.test(page.route)) return sig
    if (page.pageTitle && re.test(`/${page.pageTitle.toLowerCase()}`)) return sig
  }
  // Fallback per nav variant — keeps unfamiliar routes on-brand.
  return NAV_TO_HOME_SIGNATURE[chrome.navVariant]
}

// ─── Public API: enrich a manifest in place with chrome + design + signatures ─

export function enrichManifestDesign(
  manifest: ProjectManifest,
): ProjectManifest {
  // Idempotent: if chrome/design are already set we still recompute to keep
  // them in sync with the brief (cheap, deterministic).
  const chrome = deriveProjectChrome(manifest.brief)
  const design = deriveDesignGenome(chrome)
  for (const p of manifest.pages) {
    p.layoutSignature = deriveLayoutSignature(p, chrome)
  }
  manifest.chrome = chrome
  manifest.design = design
  return manifest
}
