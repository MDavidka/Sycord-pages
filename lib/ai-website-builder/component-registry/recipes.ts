export interface ComponentRecipe {
  id: string
  name: string
  siteTypes: string[]
  components: string[]
  layoutRhythm: string
}

export const COMPONENT_RECIPES: ComponentRecipe[] = [
  {
    id: "ai-saas-home",
    name: "AI SaaS Home",
    siteTypes: ["saas", "ai", "tool", "agency"],
    components: [
      "hero-split",
      "proof-logos-marquee",
      "features-asymmetric-bento",
      "testimonials-spotlight",
      "pricing-two-tier-toggle",
      "cta-full-bleed-banner",
    ],
    layoutRhythm: "conversion-focused with proof breaks",
  },
  {
    id: "luxury-story-home",
    name: "Luxury Story Home",
    siteTypes: ["restaurant", "luxury", "portfolio", "creator"],
    components: [
      "hero-cinematic",
      "features-sidebar-story",
      "testimonials-spotlight",
      "cta-full-bleed-banner",
    ],
    layoutRhythm: "editorial, long-form, minimal chrome",
  },
  {
    id: "product-led-home",
    name: "Product-Led Home",
    siteTypes: ["ecommerce", "store", "catalog"],
    components: [
      "hero-magazine-cover",
      "features-asymmetric-bento",
      "testimonials-spotlight",
      "cta-full-bleed-banner",
    ],
    layoutRhythm: "product-led with editorial accents",
  },
]

