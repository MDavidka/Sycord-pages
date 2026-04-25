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

/**
 * Per-page design fingerprint — picked by AI in the manifest stage so each
 * generated site looks distinct. The Style stage MUST honour these picks
 * (use the named Aceternity components in the corresponding sections).
 *
 * Values are component names from the Aceternity palette in IMPORT_MAP, or
 * "none" if the page should not use that slot.
 */
export interface DesignFingerprint {
  /**
   * Hero background wrapper. Choose from:
   *   AuroraBackground | BackgroundBeams | BackgroundBeamsWithCollision
   *   | WavyBackground | Spotlight | BackgroundGradient | Meteors
   *   | SparklesCore | HeroHighlight | none
   */
  heroVariant: string
  /**
   * Optional secondary background effect for sections below the hero.
   *   Meteors | SparklesCore | BackgroundGradient | Spotlight | none
   */
  backgroundEffect: string
  /**
   * Animated headline / paragraph treatment used in the hero copy.
   *   TextGenerateEffect | TypewriterEffect | TypewriterEffectSmooth
   *   | FlipWords | ColourfulText | Highlight | none
   */
  textEffect: string
  /**
   * Card style for feature/pricing/team grids.
   *   CardContainer | GlareCard | WobbleCard | HoverEffect
   *   | BackgroundGradient | none  (none = use plain shadcn Card)
   */
  cardStyle: string
  /**
   * Accent button style for primary CTAs.
   *   HoverBorderGradient | MovingBorderButton | none
   */
  ctaStyle: string
  /**
   * Free-form one-line "vibe" string the AI invents — purely descriptive,
   * embedded in the prompt to nudge tone.  e.g. "noir SaaS", "playful indie
   * studio", "retro terminal", "high-end agency".
   */
  vibe: string
}

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
   * AI-picked design choices for this specific page.  Optional because the
   * Architect stage may legitimately fall back to a deterministic palette
   * when the AI fingerprint call fails (network/parse error).
   */
  design?: DesignFingerprint
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

export interface ProjectManifest {
  /** Full website brief the user typed into the builder. */
  brief: string
  pages: ManifestPage[]
  router: ManifestRouter
  /**
   * Site-wide design tone produced by the AI manifest stage. Combined with
   * each page's per-page DesignFingerprint to keep individual pages varied
   * while still feeling like a single site.
   *
   *   - paletteName: short label, e.g. "noir SaaS", "playful indie".
   *   - paletteVibe: 1–2 sentence description of the look + feel.
   *   - aceternityNorth: list of Aceternity components the AI wants the
   *     entire site to lean on (e.g. ["AuroraBackground","TextGenerateEffect",
   *     "WobbleCard"]). Style stage uses this as a hint.
   */
  design?: {
    paletteName: string
    paletteVibe: string
    aceternityNorth: string[]
  }
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

  return { brief, pages, router }
}

/**
 * Allowed values for each design fingerprint slot. Validation in the
 * architect route uses these so a hallucinated component name from the AI
 * never reaches the Style stage (where it would silently demote to <div>).
 */
export const DESIGN_FINGERPRINT_OPTIONS = {
  heroVariant: [
    "AuroraBackground",
    "BackgroundBeams",
    "BackgroundBeamsWithCollision",
    "WavyBackground",
    "Spotlight",
    "BackgroundGradient",
    "Meteors",
    "SparklesCore",
    "HeroHighlight",
    "none",
  ],
  backgroundEffect: [
    "Meteors",
    "SparklesCore",
    "BackgroundGradient",
    "Spotlight",
    "none",
  ],
  textEffect: [
    "TextGenerateEffect",
    "TypewriterEffect",
    "TypewriterEffectSmooth",
    "FlipWords",
    "ColourfulText",
    "Highlight",
    "none",
  ],
  cardStyle: [
    "CardContainer",
    "GlareCard",
    "WobbleCard",
    "HoverEffect",
    "BackgroundGradient",
    "none",
  ],
  ctaStyle: ["HoverBorderGradient", "MovingBorderButton", "none"],
} as const

const FINGERPRINT_KEYS = Object.keys(DESIGN_FINGERPRINT_OPTIONS) as Array<
  keyof typeof DESIGN_FINGERPRINT_OPTIONS
>

/**
 * Validate + coerce a raw AI-emitted fingerprint into a clean DesignFingerprint
 * by snapping each value to an allowed option (or "none" if nonsense).
 */
export function sanitizeDesignFingerprint(raw: unknown): DesignFingerprint {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const pick = <K extends keyof typeof DESIGN_FINGERPRINT_OPTIONS>(key: K): string => {
    const candidate = String(obj[key] ?? "").trim()
    const opts = DESIGN_FINGERPRINT_OPTIONS[key] as readonly string[]
    return opts.includes(candidate) ? candidate : "none"
  }
  return {
    heroVariant: pick("heroVariant"),
    backgroundEffect: pick("backgroundEffect"),
    textEffect: pick("textEffect"),
    cardStyle: pick("cardStyle"),
    ctaStyle: pick("ctaStyle"),
    vibe: typeof obj.vibe === "string" ? obj.vibe.slice(0, 120) : "modern",
  }
}

/** Site-wide design — the AI-emitted variant gets sanitized too. */
export function sanitizeSiteDesign(raw: unknown): {
  paletteName: string
  paletteVibe: string
  aceternityNorth: string[]
} {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const allAllowed = new Set<string>()
  for (const key of FINGERPRINT_KEYS) {
    for (const opt of DESIGN_FINGERPRINT_OPTIONS[key]) if (opt !== "none") allAllowed.add(opt)
  }
  const north = Array.isArray(obj.aceternityNorth)
    ? (obj.aceternityNorth as unknown[])
        .map((v) => (typeof v === "string" ? v.trim() : ""))
        .filter((v) => allAllowed.has(v))
        .slice(0, 6)
    : []
  return {
    paletteName: typeof obj.paletteName === "string" ? obj.paletteName.slice(0, 60) : "modern",
    paletteVibe: typeof obj.paletteVibe === "string" ? obj.paletteVibe.slice(0, 240) : "",
    aceternityNorth: north,
  }
}

/**
 * Deterministic fallback used when the AI design call fails — keeps every
 * page on a sensible default Aceternity look without needing a model. The
 * fallback varies a tiny bit between pages so they don't look identical.
 */
export function defaultDesignFingerprint(pageIndex: number): DesignFingerprint {
  const heroes = ["BackgroundBeams", "AuroraBackground", "Spotlight", "WavyBackground"]
  const texts = ["TextGenerateEffect", "TypewriterEffectSmooth", "FlipWords", "Highlight"]
  const cards = ["GlareCard", "WobbleCard", "BackgroundGradient", "HoverEffect"]
  return {
    heroVariant: heroes[pageIndex % heroes.length],
    backgroundEffect: pageIndex === 0 ? "none" : "Meteors",
    textEffect: texts[pageIndex % texts.length],
    cardStyle: cards[pageIndex % cards.length],
    ctaStyle: pageIndex === 0 ? "HoverBorderGradient" : "MovingBorderButton",
    vibe: "modern",
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
  if (manifest.design) {
    lines.push(`  siteDesign:`)
    lines.push(`    paletteName: ${JSON.stringify(manifest.design.paletteName)}`)
    lines.push(`    paletteVibe: ${JSON.stringify(manifest.design.paletteVibe)}`)
    lines.push(
      `    aceternityNorth: ${manifest.design.aceternityNorth.length ? manifest.design.aceternityNorth.join(", ") : "(none)"}`,
    )
  }
  lines.push(`  pages:`)
  for (const p of manifest.pages) {
    lines.push(`    - component: ${p.componentName}`)
    lines.push(`      route: ${p.route}`)
    lines.push(`      pageFile: ${p.pageFile}`)
    lines.push(`      logicFile: ${p.logicFile}   (import specifier: ${p.logicModule})`)
    lines.push(`      pageTitle: ${JSON.stringify(p.pageTitle)}`)
    if (p.description) lines.push(`      description: ${p.description}`)
    if (p.features && p.features.length) {
      lines.push(`      features:`)
      for (const f of p.features) lines.push(`        • ${f}`)
    }
    if (p.design) {
      lines.push(`      designFingerprint:`)
      lines.push(`        heroVariant: ${p.design.heroVariant}`)
      lines.push(`        backgroundEffect: ${p.design.backgroundEffect}`)
      lines.push(`        textEffect: ${p.design.textEffect}`)
      lines.push(`        cardStyle: ${p.design.cardStyle}`)
      lines.push(`        ctaStyle: ${p.design.ctaStyle}`)
      lines.push(`        vibe: ${JSON.stringify(p.design.vibe)}`)
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
