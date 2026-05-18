import type { SectionKind } from "../types"
import type { CreativeComponentCategory } from "./categories"

export type ComponentComplexity = "simple" | "medium" | "rich"

export type LegacyRendererHint = {
  kind: SectionKind
  variant?: string
}

export interface CreativeComponent {
  id: string
  name: string
  category: CreativeComponentCategory
  styleTags: string[]
  bestFor: string[]
  avoidFor?: string[]
  complexity: ComponentComplexity
  dependencies: string[]
  propsSchema: Record<string, unknown>
  responsiveNotes: string
  legacy: LegacyRendererHint
}

export const CREATIVE_COMPONENTS: CreativeComponent[] = [
  {
    id: "hero-split",
    name: "Split Hero",
    category: "hero",
    styleTags: ["saas", "clean", "conversion"],
    bestFor: ["saas", "agency", "ai tool", "product"],
    complexity: "medium",
    dependencies: ["button", "badge"],
    propsSchema: {},
    responsiveNotes: "Stacks visual below copy on mobile.",
    legacy: { kind: "hero", variant: "split" },
  },
  {
    id: "hero-cinematic",
    name: "Cinematic Hero",
    category: "hero",
    styleTags: ["premium", "visual", "editorial", "dark"],
    bestFor: ["restaurant", "luxury", "portfolio", "event"],
    avoidFor: ["government", "legal"],
    complexity: "rich",
    dependencies: ["button", "badge", "card"],
    propsSchema: {},
    responsiveNotes: "Keeps copy first; visual and proof stack after.",
    legacy: { kind: "hero", variant: "cinematic" },
  },
  {
    id: "hero-magazine-cover",
    name: "Magazine Cover Hero",
    category: "hero",
    styleTags: ["editorial", "story", "premium"],
    bestFor: ["creator", "portfolio", "restaurant", "magazine"],
    complexity: "rich",
    dependencies: ["button", "badge", "card"],
    propsSchema: {},
    responsiveNotes: "Cover panel drops under headline on mobile.",
    legacy: { kind: "hero", variant: "magazine-cover" },
  },
  {
    id: "features-asymmetric-bento",
    name: "Asymmetric Bento Features",
    category: "feature",
    styleTags: ["bento", "playful", "modern"],
    bestFor: ["saas", "ai tool", "creator"],
    complexity: "rich",
    dependencies: ["card", "badge"],
    propsSchema: {},
    responsiveNotes: "Auto-flattens into a single column on small screens.",
    legacy: { kind: "feature-grid", variant: "asymmetric-bento" },
  },
  {
    id: "features-sidebar-story",
    name: "Sidebar Story Features",
    category: "feature",
    styleTags: ["editorial", "story", "minimal"],
    bestFor: ["agency", "portfolio", "local business"],
    complexity: "medium",
    dependencies: ["badge", "card"],
    propsSchema: {},
    responsiveNotes: "Sidebar becomes top section on mobile.",
    legacy: { kind: "feature-grid", variant: "sidebar-story" },
  },
  {
    id: "proof-logos-marquee",
    name: "Logo Cloud (Marquee)",
    category: "social-proof",
    styleTags: ["trust", "motion", "saas"],
    bestFor: ["saas", "agency", "tool"],
    complexity: "simple",
    dependencies: [],
    propsSchema: {},
    responsiveNotes: "Wraps/scrolls depending on variant.",
    legacy: { kind: "logos", variant: "marquee-static" },
  },
  {
    id: "testimonials-spotlight",
    name: "Testimonial Spotlight",
    category: "testimonial",
    styleTags: ["trust", "premium"],
    bestFor: ["saas", "service", "local business"],
    complexity: "medium",
    dependencies: ["card"],
    propsSchema: {},
    responsiveNotes: "Stacks naturally; avoids dense grids on mobile.",
    legacy: { kind: "testimonials", variant: "spotlight" },
  },
  {
    id: "pricing-two-tier-toggle",
    name: "Pricing Toggle",
    category: "pricing",
    styleTags: ["saas", "conversion"],
    bestFor: ["saas", "subscriptions", "memberships"],
    complexity: "medium",
    dependencies: ["tabs", "card", "button"],
    propsSchema: {},
    responsiveNotes: "Tabs and cards stack cleanly on mobile.",
    legacy: { kind: "pricing", variant: "two-tier-toggle" },
  },
  {
    id: "cta-full-bleed-banner",
    name: "Banner CTA",
    category: "cta",
    styleTags: ["conversion", "bold"],
    bestFor: ["all"],
    complexity: "simple",
    dependencies: ["button"],
    propsSchema: {},
    responsiveNotes: "Centered layout stays readable on mobile.",
    legacy: { kind: "cta", variant: "banner" },
  },
]

