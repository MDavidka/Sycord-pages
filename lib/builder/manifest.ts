// ── Step 3: Manifest ────────────────────────────────────────────────
// Turn the plan into a deterministic project manifest. No AI call.

import type {
  IntakeBrief,
  PlanEntry,
  ProjectManifest,
  ManifestPage,
  ManifestTheme,
  ManifestChrome,
  ManifestDesign,
  VisualStyle,
  NavVariant,
  MotionLevel,
} from "./types"

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function pascalCase(s: string): string {
  return s
    .split(/[\s\-_]+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("")
}

function simpleHash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

const LAYOUT_HINTS: string[] = [
  "hero-features-cta",
  "hero-cards-testimonials",
  "hero-grid-stats",
  "cards-tabs-cta",
  "form-info-faq",
  "table-filters-actions",
  "grid-detail-cta",
  "hero-timeline-cta",
  "masonry-filter-detail",
  "split-hero-features",
]

const SECTION_SIGNATURES: Record<string, string[]> = {
  landing: ["hero", "features-grid", "social-proof", "cta-section"],
  catalog: ["search-filter", "product-grid", "product-card", "pagination"],
  promotions: ["deal-banner", "deal-cards", "countdown", "cta"],
  form: ["hero-text", "form-section", "info-cards", "faq"],
  transaction: ["cart-list", "summary-card", "promo-input", "checkout-cta"],
  support: ["search-bar", "faq-accordion", "contact-form", "category-cards"],
  informational: ["hero", "content-grid", "stats", "cta-section"],
  pricing: ["hero", "pricing-cards", "comparison-table", "faq"],
  "social-proof": ["hero", "testimonial-cards", "logo-bar", "case-study-links"],
  documentation: ["sidebar-nav", "content-area", "code-block", "pagination"],
  portfolio: ["hero", "project-grid", "filter-bar", "project-card"],
  "case-study": ["hero", "case-cards", "metrics", "cta"],
  settings: ["profile-form", "notification-toggles", "security-section", "save-bar"],
  dashboard: ["stats-cards", "chart-area", "data-table", "filters"],
  "data-table": ["toolbar", "data-table", "pagination", "bulk-actions"],
  services: ["hero", "service-cards", "process-steps", "cta"],
  blog: ["featured-post", "article-grid", "category-nav", "newsletter"],
}

export function buildProjectManifest(
  brief: IntakeBrief,
  plan: PlanEntry[],
): ProjectManifest {
  const hash = simpleHash(brief.rawPrompt)
  const projectName = brief.rawPrompt.split(/\s+/).slice(0, 4).join("-").toLowerCase().replace(/[^a-z0-9-]/g, "") || "generated-site"

  const pages: ManifestPage[] = plan.map((entry, i) => {
    const slug = entry.path === "/" ? "" : slugify(entry.path.replace(/^\//, ""))
    const componentName = entry.path === "/" ? "HomePage" : `${pascalCase(entry.title)}Page`
    const filePath = entry.path === "/" ? "app/page.tsx" : `app/${slug}/page.tsx`
    const contentType = entry.contentType || "informational"
    const layoutIdx = (hash + i) % LAYOUT_HINTS.length
    const sig = SECTION_SIGNATURES[contentType] || SECTION_SIGNATURES.informational

    return {
      route: entry.path,
      slug,
      title: entry.title,
      componentName,
      filePath,
      metadata: {
        title: entry.title,
        description: entry.description,
      },
      description: entry.description,
      features: entry.features,
      pageRole: contentType,
      layoutHint: LAYOUT_HINTS[layoutIdx],
      sectionSignature: sig,
      motionProfile: i === 0 ? "polished" : "subtle" as MotionLevel,
    }
  })

  const router: Record<string, string> = {}
  for (const p of pages) {
    router[p.route] = p.filePath
  }

  const theme = selectTheme(brief, hash)
  const chrome = selectChrome(brief, pages)
  const design = selectDesign(brief, hash)

  return {
    brief,
    projectName,
    pages,
    router,
    theme,
    chrome,
    design,
  }
}

function selectTheme(brief: IntakeBrief, hash: number): ManifestTheme {
  const hueMap: Record<string, number> = {
    commerce: 220,
    saas: 250,
    portfolio: 30,
    dashboard: 200,
    blog: 150,
    docs: 210,
    support: 180,
    agency: 340,
    general: 220,
  }
  const primaryHue = hueMap[brief.siteType] ?? 220
  const isDark = brief.styleHints.includes("dark")

  return {
    name: isDark ? "dark" : "default",
    primaryHue,
    primarySat: 80 + (hash % 20),
    radius: "0.5rem",
    headingFont: "Inter",
    bodyFont: "Inter",
  }
}

function selectChrome(brief: IntakeBrief, pages: ManifestPage[]): ManifestChrome {
  const navMap: Record<string, NavVariant> = {
    commerce: "commerce",
    saas: "saas",
    portfolio: "portfolio",
    dashboard: "app",
    blog: "editorial",
    docs: "docs",
    support: "saas",
    agency: "agency",
    general: "saas",
  }

  const brandName = brief.rawPrompt.split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
  const firstCta = pages.find(p => p.route !== "/")

  return {
    brandName: brandName.length > 30 ? brandName.slice(0, 30) : brandName,
    navVariant: navMap[brief.siteType] ?? "saas",
    headerLayout: "standard",
    mobileNav: "sheet",
    footerVariant: brief.siteType === "dashboard" ? "minimal" : "standard",
    primaryCtaLabel: firstCta ? `View ${firstCta.title}` : "Get Started",
    primaryCtaHref: firstCta ? firstCta.route : "/",
  }
}

function selectDesign(brief: IntakeBrief, hash: number): ManifestDesign {
  const styleMap: Record<string, VisualStyle> = {
    commerce: "premium-commerce",
    saas: "minimal-saas",
    portfolio: "portfolio",
    dashboard: "data-dashboard",
    blog: "editorial",
    docs: "technical-docs",
    support: "minimal-saas",
    agency: "bold-agency",
    general: "minimal-saas",
  }

  const heroOptions = ["gradient-hero", "split-hero", "centered-hero", "image-hero"]
  const rhythmOptions = ["spacious", "balanced", "compact"]

  return {
    visualStyle: styleMap[brief.siteType] ?? "minimal-saas",
    heroTreatment: heroOptions[hash % heroOptions.length],
    sectionRhythm: rhythmOptions[hash % rhythmOptions.length],
    cardTreatment: brief.siteType === "commerce" ? "elevated" : "flat",
    typographyScale: brief.siteType === "dashboard" ? "compact" : "standard",
    motionLevel: "polished" as MotionLevel,
  }
}
