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
  layoutRhythm: "immersive" | "editorial" | "conversion-focused" | "portfolio-showcase" | "product-led"
  density: "airy" | "balanced" | "dense"
  motionLevel: "none" | "subtle" | "expressive"
  trustStrategy: "logos" | "testimonials" | "stats" | "case-studies" | "social-proof"
  imageStrategy: "abstract" | "product" | "people" | "editorial" | "none"
  avoid: string[]
}

export function formatDesignDirection(direction: DesignDirection): string {
  const avoid = direction.avoid?.length ? direction.avoid.join(", ") : ""
  return [
    `Concept: ${direction.concept}`,
    `Visual style: ${direction.visualStyle}`,
    `Layout rhythm: ${direction.layoutRhythm}`,
    `Density: ${direction.density}`,
    `Motion: ${direction.motionLevel}`,
    `Trust: ${direction.trustStrategy}`,
    `Images: ${direction.imageStrategy}`,
    avoid ? `Avoid: ${avoid}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

