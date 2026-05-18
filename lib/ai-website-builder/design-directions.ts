import type { ProjectContext } from "./types"

export interface DesignDirection {
  concept: string
  visualStyle:
    | "minimal-editorial"
    | "bold-saas"
    | "luxury-dark"
    | "playful-bento"
    | "warm-local"
    | "commerce-catalog"
    | "creator-magazine"
    | "event-impact"
  layoutRhythm:
    | "immersive"
    | "editorial"
    | "conversion-focused"
    | "portfolio-showcase"
    | "product-led"
  density: "airy" | "balanced" | "dense"
  motionLevel: "none" | "subtle" | "expressive"
  trustStrategy: "logos" | "testimonials" | "stats" | "case-studies" | "social-proof"
  imageStrategy: "abstract" | "product" | "people" | "editorial" | "none"
  avoid: string[]
}

export const DESIGN_DIRECTION_SYSTEM_PROMPT = `You are an art director for generated websites.
Return ONLY a JSON object with this shape:
{
  "concept": string,
  "visualStyle": "minimal-editorial" | "bold-saas" | "luxury-dark" | "playful-bento" | "warm-local" | "commerce-catalog" | "creator-magazine" | "event-impact",
  "layoutRhythm": "immersive" | "editorial" | "conversion-focused" | "portfolio-showcase" | "product-led",
  "density": "airy" | "balanced" | "dense",
  "motionLevel": "none" | "subtle" | "expressive",
  "trustStrategy": "logos" | "testimonials" | "stats" | "case-studies" | "social-proof",
  "imageStrategy": "abstract" | "product" | "people" | "editorial" | "none",
  "avoid": string[]
}
Make the concept specific and visual, not generic. No markdown.`

const VISUAL_STYLES: DesignDirection["visualStyle"][] = [
  "minimal-editorial",
  "bold-saas",
  "luxury-dark",
  "playful-bento",
  "warm-local",
  "commerce-catalog",
  "creator-magazine",
  "event-impact",
]
const LAYOUT_RHYTHMS: DesignDirection["layoutRhythm"][] = ["immersive", "editorial", "conversion-focused", "portfolio-showcase", "product-led"]
const DENSITIES: DesignDirection["density"][] = ["airy", "balanced", "dense"]
const MOTION_LEVELS: DesignDirection["motionLevel"][] = ["none", "subtle", "expressive"]
const TRUST_STRATEGIES: DesignDirection["trustStrategy"][] = ["logos", "testimonials", "stats", "case-studies", "social-proof"]
const IMAGE_STRATEGIES: DesignDirection["imageStrategy"][] = ["abstract", "product", "people", "editorial", "none"]

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : fallback
}

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback
}

export function normalizeDesignDirection(raw: unknown, fallback: DesignDirection): DesignDirection {
  const input = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  return {
    concept: text(input.concept, fallback.concept),
    visualStyle: oneOf(input.visualStyle, VISUAL_STYLES, fallback.visualStyle),
    layoutRhythm: oneOf(input.layoutRhythm, LAYOUT_RHYTHMS, fallback.layoutRhythm),
    density: oneOf(input.density, DENSITIES, fallback.density),
    motionLevel: oneOf(input.motionLevel, MOTION_LEVELS, fallback.motionLevel),
    trustStrategy: oneOf(input.trustStrategy, TRUST_STRATEGIES, fallback.trustStrategy),
    imageStrategy: oneOf(input.imageStrategy, IMAGE_STRATEGIES, fallback.imageStrategy),
    avoid: Array.isArray(input.avoid)
      ? input.avoid.map((item) => text(item, "")).filter(Boolean).slice(0, 8)
      : fallback.avoid,
  }
}

export function fallbackDesignDirection(prompt: string, project?: ProjectContext): DesignDirection {
  const blob = `${prompt} ${project?.category ?? ""} ${project?.description ?? ""}`.toLowerCase()
  if (/restaurant|chef|menu|wine|dining|luxury/.test(blob)) {
    return {
      concept: "Low-light editorial hospitality with tactile menu moments and reservation-first storytelling",
      visualStyle: "luxury-dark",
      layoutRhythm: "editorial",
      density: "airy",
      motionLevel: "subtle",
      trustStrategy: "testimonials",
      imageStrategy: "editorial",
      avoid: ["generic food cards", "stock-photo sameness", "flat white sections"],
    }
  }
  if (/shop|store|ecommerce|product|catalog|fashion|beauty/.test(blob)) {
    return {
      concept: "Lookbook-led commerce with featured product stories and confident purchase paths",
      visualStyle: "commerce-catalog",
      layoutRhythm: "product-led",
      density: "balanced",
      motionLevel: "subtle",
      trustStrategy: "social-proof",
      imageStrategy: "product",
      avoid: ["plain product grids", "buried pricing", "generic sale copy"],
    }
  }
  if (/portfolio|creator|artist|photographer|studio|writer/.test(blob)) {
    return {
      concept: "Magazine-style portfolio with oversized work moments and concise creator proof",
      visualStyle: "creator-magazine",
      layoutRhythm: "portfolio-showcase",
      density: "airy",
      motionLevel: "subtle",
      trustStrategy: "case-studies",
      imageStrategy: "editorial",
      avoid: ["template gallery rows", "vague bio copy", "repeated cards"],
    }
  }
  if (/local|clinic|salon|service|repair|home|fitness|coach/.test(blob)) {
    return {
      concept: "Warm neighborhood service story with visible trust signals and appointment clarity",
      visualStyle: "warm-local",
      layoutRhythm: "conversion-focused",
      density: "balanced",
      motionLevel: "none",
      trustStrategy: "testimonials",
      imageStrategy: "people",
      avoid: ["corporate jargon", "cold SaaS blocks", "hidden contact details"],
    }
  }
  return {
    concept: "Bold product narrative with asymmetric proof, clear conversion paths, and memorable visual rhythm",
    visualStyle: "bold-saas",
    layoutRhythm: "conversion-focused",
    density: "balanced",
    motionLevel: "subtle",
    trustStrategy: "stats",
    imageStrategy: "abstract",
    avoid: ["generic shadcn card stacks", "centered section repetition", "vague CTAs"],
  }
}
