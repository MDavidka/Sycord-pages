// Creative Direction Planner — infers visual mood, spacing, typography, and
// composition strategy from the user prompt and product intent.
//
// Replaces the limited DesignDirection system with a richer style matrix
// that produces visually distinct websites across every generation.

import type { CreativeDirection, ProductIntent } from "./types"
import type { ProjectContext } from "./types"

export const CREATIVE_STYLES: Record<string, CreativeDirection> = {
  "editorial-minimal": {
    styleId: "editorial-minimal",
    mood: "Quiet confidence with generous whitespace and strong typographic hierarchy",
    density: "minimal",
    typography: "editorial",
    spacing: "airy",
    layoutRhythm: "editorial",
    visualEnergy: "calm",
    radius: "none",
    colorStrategy: "neutral",
  },
  "brutalist": {
    styleId: "brutalist",
    mood: "Raw, unpolished, high-contrast with intentional asymmetry",
    density: "dense",
    typography: "technical",
    spacing: "tight",
    layoutRhythm: "asymmetric",
    visualEnergy: "high",
    radius: "none",
    colorStrategy: "high-contrast",
  },
  "premium-dark": {
    styleId: "premium-dark",
    mood: "Luxurious dark surfaces with subtle gradients and accent glows",
    density: "balanced",
    typography: "luxury",
    spacing: "airy",
    layoutRhythm: "centered",
    visualEnergy: "calm",
    radius: "lg",
    colorStrategy: "dark",
  },
  "playful": {
    styleId: "playful",
    mood: "Energetic, colorful, with bouncy interactions and rounded everything",
    density: "balanced",
    typography: "playful",
    spacing: "balanced",
    layoutRhythm: "asymmetric",
    visualEnergy: "high",
    radius: "xl",
    colorStrategy: "vibrant",
  },
  "technical-dashboard": {
    styleId: "technical-dashboard",
    mood: "Precise, data-dense, monospaced accents with surgical spacing",
    density: "dense",
    typography: "technical",
    spacing: "tight",
    layoutRhythm: "dashboard",
    visualEnergy: "balanced",
    radius: "sm",
    colorStrategy: "neutral",
  },
  "luxury": {
    styleId: "luxury",
    mood: "Refined elegance with serif display fonts, gold accents, and generous breathing room",
    density: "minimal",
    typography: "luxury",
    spacing: "airy",
    layoutRhythm: "centered",
    visualEnergy: "calm",
    radius: "md",
    colorStrategy: "soft",
  },
  "glassmorphism": {
    styleId: "glassmorphism",
    mood: "Frosted glass panels floating over gradient backgrounds with blur overlays",
    density: "balanced",
    typography: "clean",
    spacing: "airy",
    layoutRhythm: "centered",
    visualEnergy: "calm",
    radius: "xl",
    colorStrategy: "soft",
  },
  "neo-brutal": {
    styleId: "neo-brutal",
    mood: "Bold borders, hard shadows, vibrant colors, unapologetic typography",
    density: "dense",
    typography: "playful",
    spacing: "tight",
    layoutRhythm: "asymmetric",
    visualEnergy: "high",
    radius: "sm",
    colorStrategy: "vibrant",
  },
  "cinematic": {
    styleId: "cinematic",
    mood: "Full-bleed visuals, dramatic typography, immersive storytelling flow",
    density: "minimal",
    typography: "editorial",
    spacing: "airy",
    layoutRhythm: "editorial",
    visualEnergy: "high",
    radius: "none",
    colorStrategy: "dark",
  },
  "modern-saas": {
    styleId: "modern-saas",
    mood: "Clean, professional, trust-building with subtle gradients and card-based layouts",
    density: "balanced",
    typography: "clean",
    spacing: "balanced",
    layoutRhythm: "centered",
    visualEnergy: "balanced",
    radius: "md",
    colorStrategy: "neutral",
  },
  "clean-enterprise": {
    styleId: "clean-enterprise",
    mood: "Structured, trustworthy, data-rich with clear information architecture",
    density: "balanced",
    typography: "clean",
    spacing: "balanced",
    layoutRhythm: "dashboard",
    visualEnergy: "calm",
    radius: "sm",
    colorStrategy: "neutral",
  },
  "soft-mobile": {
    styleId: "soft-mobile",
    mood: "Touch-friendly, rounded, warm gradients with mobile-first single-column flow",
    density: "balanced",
    typography: "clean",
    spacing: "balanced",
    layoutRhythm: "centered",
    visualEnergy: "balanced",
    radius: "lg",
    colorStrategy: "soft",
  },
}

export const STYLE_IDS = Object.keys(CREATIVE_STYLES)

export function getCreativeStyle(styleId: string): CreativeDirection {
  return CREATIVE_STYLES[styleId] ?? CREATIVE_STYLES["modern-saas"]
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

export function detectProductIntent(prompt: string, project?: ProjectContext): ProductIntent {
  const blob = `${prompt} ${project?.category ?? ""} ${project?.description ?? ""}`.toLowerCase()

  const dashboardKeywords = ["dashboard", "admin", "analytics", "metrics", "charts", "reports", "monitor", "panel"]
  const toolKeywords = ["tool", "generator", "converter", "calculator", "builder", "editor", "configurator", "planner"]
  const ecommerceKeywords = ["shop", "store", "ecommerce", "product", "cart", "checkout", "products", "catalog"]
  const bookingKeywords = ["booking", "reservation", "appointment", "schedule", "calendar", "book", "reserve"]
  const portfolioKeywords = ["portfolio", "photography", "gallery", "showcase", "work", "projects", "studio"]
  const gameKeywords = ["game", "play", "score", "quiz", "puzzle", "challenge", "leaderboard"]
  const contentKeywords = ["blog", "article", "news", "magazine", "journal", "writing", "publication"]
  const marketingKeywords = ["landing", "marketing", "brand", "website", "site", "page", "homepage"]

  if (dashboardKeywords.some((kw) => blob.includes(kw))) {
    return {
      type: "dashboard-app",
      complexity: "app",
      requiresDatabase: true,
      requiresAuth: true,
      uiMode: "dashboard",
      confidence: 0.75,
    }
  }
  if (toolKeywords.some((kw) => blob.includes(kw))) {
    return {
      type: "tool-app",
      complexity: "app",
      requiresDatabase: false,
      requiresAuth: false,
      uiMode: "tool",
      confidence: 0.6,
    }
  }
  if (ecommerceKeywords.some((kw) => blob.includes(kw))) {
    return {
      type: "ecommerce",
      complexity: "app",
      requiresDatabase: true,
      requiresAuth: true,
      uiMode: "interactive",
      confidence: 0.7,
    }
  }
  if (bookingKeywords.some((kw) => blob.includes(kw))) {
    return {
      type: "booking",
      complexity: "app",
      requiresDatabase: true,
      requiresAuth: false,
      uiMode: "interactive",
      confidence: 0.7,
    }
  }
  if (portfolioKeywords.some((kw) => blob.includes(kw))) {
    return {
      type: "portfolio",
      complexity: "website",
      requiresDatabase: false,
      requiresAuth: false,
      uiMode: "editorial",
      confidence: 0.7,
    }
  }
  if (gameKeywords.some((kw) => blob.includes(kw))) {
    return {
      type: "game",
      complexity: "app",
      requiresDatabase: false,
      requiresAuth: false,
      uiMode: "interactive",
      confidence: 0.65,
    }
  }
  if (contentKeywords.some((kw) => blob.includes(kw))) {
    return {
      type: "content-site",
      complexity: "website",
      requiresDatabase: false,
      requiresAuth: false,
      uiMode: "editorial",
      confidence: 0.65,
    }
  }
  if (marketingKeywords.some((kw) => blob.includes(kw)) || blob.length < 30) {
    return {
      type: "marketing-site",
      complexity: "website",
      requiresDatabase: false,
      requiresAuth: false,
      uiMode: "marketing",
      confidence: 0.5,
    }
  }

  return {
    type: "unknown",
    complexity: "website",
    requiresDatabase: false,
    requiresAuth: false,
    uiMode: "marketing",
    confidence: 0.25,
  }
}

export function detectCreativeDirection(intent: ProductIntent, prompt: string, project?: ProjectContext): CreativeDirection {
  const blob = `${prompt} ${project?.category ?? ""} ${project?.description ?? ""}`.toLowerCase()

  if (intent.type === "dashboard-app") return CREATIVE_STYLES["technical-dashboard"]
  if (intent.type === "tool-app") return CREATIVE_STYLES["clean-enterprise"]

  if (intent.uiMode === "editorial") {
    return CREATIVE_STYLES["editorial-minimal"]
  }

  if (/brutal|raw|grunge|punk|underground/.test(blob)) return CREATIVE_STYLES["brutalist"]
  if (/luxury|premium|high.end|elegant|sophisticated|exclusive/.test(blob)) return CREATIVE_STYLES["luxury"]
  if (/neon|cyber|future|holographic|glass/.test(blob)) return CREATIVE_STYLES["glassmorphism"]
  if (/playful|fun|colorful|kids|game|cartoon/.test(blob)) return CREATIVE_STYLES["playful"]
  if (/dark|night|noir|gothic|black/.test(blob)) return CREATIVE_STYLES["premium-dark"]
  if (/mobile|app|touch/.test(blob)) return CREATIVE_STYLES["soft-mobile"]
  if (/cinematic|film|movie|story|theater/.test(blob)) return CREATIVE_STYLES["cinematic"]
  if (/neo.brutal|hard.shadow|bold.border|harsh/.test(blob)) return CREATIVE_STYLES["neo-brutal"]
  if (/enterprise|corporate|business|b2b|professional/.test(blob)) return CREATIVE_STYLES["clean-enterprise"]
  if (/saas|software|platform|api|cloud/.test(blob)) return CREATIVE_STYLES["modern-saas"]

  return CREATIVE_STYLES["modern-saas"]
}

export function normalizeCreativeDirection(raw: unknown, fallback: CreativeDirection): CreativeDirection {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    styleId: text(input.styleId, fallback.styleId),
    mood: text(input.mood, fallback.mood),
    density: oneOf(input.density, ["minimal", "balanced", "dense"] as const, fallback.density),
    typography: oneOf(input.typography, ["editorial", "technical", "playful", "clean", "luxury"] as const, fallback.typography),
    spacing: oneOf(input.spacing, ["tight", "balanced", "airy"] as const, fallback.spacing),
    layoutRhythm: oneOf(
      input.layoutRhythm,
      ["centered", "split", "asymmetric", "editorial", "dashboard"] as const,
      fallback.layoutRhythm,
    ),
    visualEnergy: oneOf(input.visualEnergy, ["calm", "balanced", "high"] as const, fallback.visualEnergy),
    radius: oneOf(input.radius, ["none", "sm", "md", "lg", "xl"] as const, fallback.radius),
    colorStrategy: oneOf(
      input.colorStrategy,
      ["neutral", "vibrant", "dark", "soft", "high-contrast"] as const,
      fallback.colorStrategy,
    ),
  }
}

export function composeStylePrompt(direction: CreativeDirection): string {
  const layoutHints: Record<string, string> = {
    centered: "Use centered layouts with generous whitespace. Elements should feel balanced and symmetrical.",
    split: "Use split-screen compositions. Alternate between left/right splits for visual rhythm.",
    asymmetric: "Use intentional asymmetry. Overlap elements, use offset grids, create visual tension.",
    editorial: "Use editorial flow with full-bleed sections, large typography, and magazine-style layouts.",
    dashboard: "Use grid-based layouts with cards, stats, data tables, and information-dense compositions.",
  }

  const energyHints: Record<string, string> = {
    calm: "Keep interactions subtle. Use fade-in animations. Avoid aggressive hover effects.",
    balanced: "Use moderate animations. Subtle hover states, smooth transitions, gentle reveals.",
    high: "Use bold animations. Scroll-triggered reveals, parallax effects, expressive micro-interactions.",
  }

  return [
    `Style: ${direction.styleId} — ${direction.mood}`,
    `Density: ${direction.density} — use ${direction.density === "minimal" ? "generous whitespace" : direction.density === "dense" ? "compact information-dense layouts" : "balanced spacing"}`,
    `Typography: ${direction.typography} — ${direction.typography === "editorial" ? "use serif display fonts with strong hierarchy" : direction.typography === "technical" ? "use monospaced accents and clean sans-serif" : direction.typography === "playful" ? "use rounded, friendly type with varied weights" : direction.typography === "luxury" ? "use elegant serif with refined letter-spacing" : "use clean sans-serif with clear hierarchy"}`,
    `Spacing: ${direction.spacing} rhythm`,
    `Layout: ${layoutHints[direction.layoutRhythm]}`,
    `Energy: ${energyHints[direction.visualEnergy]}`,
    `Radius: ${direction.radius}`,
    `Colors: ${direction.colorStrategy}`,
  ].join("\n")
}
