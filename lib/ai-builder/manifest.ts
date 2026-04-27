// Deterministic projection of a SitePlan onto a SiteManifest.
// No AI calls happen here.

import type { ManifestPage, PagePlan, SiteManifest, SitePlan, SiteType } from "./types"
import { expandComponentSubset, type ComponentsCheatsheet } from "./components-context"

const STYLE_BY_SITE_TYPE: Record<SiteType, { nav: SiteManifest["navStyle"]; footer: SiteManifest["footerStyle"]; motion: SiteManifest["motionStyle"] }> = {
  commerce: { nav: "split", footer: "columns", motion: "subtle" },
  saas: { nav: "minimal", footer: "columns", motion: "playful" },
  portfolio: { nav: "centered", footer: "minimal", motion: "dramatic" },
  dashboard: { nav: "split", footer: "minimal", motion: "subtle" },
  blog: { nav: "minimal", footer: "columns", motion: "subtle" },
  docs: { nav: "split", footer: "columns", motion: "subtle" },
  agency: { nav: "centered", footer: "columns", motion: "dramatic" },
  other: { nav: "minimal", footer: "minimal", motion: "subtle" },
}

const HANDLER_KEYWORDS: Record<string, string[]> = {
  contact: ["submitContact"],
  newsletter: ["subscribeNewsletter"],
  cart: ["addToCart"],
  checkout: ["startCheckout"],
  search: ["searchSupport"],
  signup: ["submitContact"],
  signin: ["submitContact"],
  pricing: ["startCheckout"],
  shop: ["addToCart"],
  catalog: ["addToCart"],
  product: ["addToCart"],
  support: ["searchSupport"],
}

export function buildManifest(plan: SitePlan, cheatsheet: ComponentsCheatsheet): SiteManifest {
  const style = STYLE_BY_SITE_TYPE[plan.siteType] ?? STYLE_BY_SITE_TYPE.other

  const pages: ManifestPage[] = plan.pages.map((p) => projectPage(p, plan.projectName, cheatsheet))

  // Always offer at least one nav-friendly handler.
  return {
    projectName: plan.projectName,
    siteType: plan.siteType,
    targetAudience: plan.targetAudience,
    brandStyle: plan.brandStyle,
    navStyle: style.nav,
    footerStyle: style.footer,
    motionStyle: style.motion,
    theme: themeFromStyle(plan.brandStyle),
    pages,
  }
}

function projectPage(
  page: PagePlan,
  projectName: string,
  cheatsheet: ComponentsCheatsheet,
): ManifestPage {
  const filePath = filePathForRoute(page.path)
  const componentName = componentNameForPath(page.path)
  const description = `${projectName} — ${page.title}: ${page.purpose}`.slice(0, 240)
  const expanded = expandComponentSubset(cheatsheet, page.componentsNeeded.length > 0 ? page.componentsNeeded : ["Button"])
  const handlers = inferHandlers(page)
  return {
    ...page,
    filePath,
    componentName,
    metadataDescription: description,
    shadcnComponents: expanded.exports,
    handlers,
  }
}

export function filePathForRoute(routePath: string): string {
  if (routePath === "/" || routePath === "") return "app/page.tsx"
  const segs = routePath
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .map(slugify)
  return `app/${segs.join("/")}/page.tsx`
}

export function componentNameForPath(routePath: string): string {
  if (routePath === "/" || routePath === "") return "HomePage"
  const segs = routePath
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean)
    .map(slugify)
  return (
    segs
      .map((s) =>
        s
          .split("-")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(""),
      )
      .join("") + "Page"
  )
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function inferHandlers(page: PagePlan): string[] {
  const text = [page.path, page.title, page.purpose, ...page.sections, ...page.features, page.primaryAction]
    .join(" ")
    .toLowerCase()
  const handlers = new Set<string>()
  for (const [keyword, list] of Object.entries(HANDLER_KEYWORDS)) {
    if (text.includes(keyword)) {
      for (const h of list) handlers.add(h)
    }
  }
  return Array.from(handlers).sort()
}

function themeFromStyle(brandStyle: string): SiteManifest["theme"] {
  const lower = brandStyle.toLowerCase()
  let primary = "oklch(0.55 0.2 260)"
  if (lower.includes("warm") || lower.includes("orange") || lower.includes("amber")) {
    primary = "oklch(0.7 0.18 50)"
  } else if (lower.includes("green") || lower.includes("eco")) {
    primary = "oklch(0.65 0.15 145)"
  } else if (lower.includes("luxury") || lower.includes("dark") || lower.includes("black")) {
    primary = "oklch(0.3 0.04 260)"
  } else if (lower.includes("playful") || lower.includes("pink") || lower.includes("magenta")) {
    primary = "oklch(0.65 0.22 340)"
  }
  const radius = lower.includes("sharp") || lower.includes("brutal") ? "0.25rem" : "0.75rem"
  const font = lower.includes("serif") ? "Georgia, ui-serif, serif" : "Inter, ui-sans-serif, system-ui, sans-serif"
  return { primary, radius, font }
}
