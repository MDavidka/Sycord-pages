// Schema for the AI website builder pipeline.
//
// The AI plans a `GeneratedProjectManifest` (DesignBrief + ThemeTokens + PagePlan[]).
// Deterministic renderers in `sections.ts` then turn each `SectionPlan` into
// polished TSX. The shape is validated and repaired before rendering, so the
// downstream renderer never has to deal with malformed AI output.

import type { ModelSelection } from "@/lib/ai-provider"

export type SectionKind =
  | "hero"
  | "feature-grid"
  | "stats"
  | "testimonials"
  | "pricing"
  | "faq"
  | "contact"
  | "gallery"
  | "product-grid"
  | "comparison"
  | "process"
  | "cta"
  | "logos"
  | "team"
  | "blog-preview"

export type ThemePreset =
  | "saas"
  | "agency"
  | "ecommerce"
  | "portfolio"
  | "restaurant"
  | "nonprofit"
  | "event"
  | "creator"
  | "local-business"

export interface ThemeTokens {
  preset: ThemePreset
  // Tailwind-friendly hsl() raw values (no hsl(...) wrapper, just "h s% l%").
  light: ColorTokens
  dark: ColorTokens
  radius: string
  fontSans: string
  fontDisplay?: string
  background: BackgroundTreatment
}

export interface ColorTokens {
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  primary: string
  primaryForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  accent: string
  accentForeground: string
  destructive: string
  destructiveForeground: string
  border: string
  input: string
  ring: string
}

export type BackgroundTreatment = "grid" | "radial" | "noise" | "soft" | "plain"

export interface CtaPlan {
  label: string
  href: string
}

export interface NavLink {
  label: string
  href: string
}

export interface ContactInfo {
  email?: string
  phone?: string
  address?: string
}

export interface SocialLink {
  label: string
  href: string
}

export interface DesignBrief {
  projectName: string
  tagline: string
  description: string
  audience: string
  voice: string
  themePreset: ThemePreset
  navLinks: NavLink[]
  primaryCta: CtaPlan
  secondaryCta?: CtaPlan
  footerCta?: CtaPlan
  socialLinks?: SocialLink[]
  contact?: ContactInfo
}

// Each section plan carries copy, optional layout variant, optional visual
// treatment, optional shadcn components requested, and arrays of structured
// data items. Renderers cherry-pick the fields they need per kind.
export interface SectionPlan {
  kind: SectionKind
  variant?: string
  eyebrow?: string
  heading?: string
  subheading?: string
  description?: string
  highlights?: string[]
  primaryCta?: CtaPlan
  secondaryCta?: CtaPlan
  align?: "left" | "center"
  tone?: "default" | "muted" | "primary" | "accent" | "inverse"
  components?: string[]
  items?: SectionItem[]
  imageHint?: string
  // Free-form ID is helpful for in-page anchors (#pricing, #faq, etc.).
  anchor?: string
}

export interface SectionItem {
  title?: string
  subtitle?: string
  description?: string
  icon?: string
  eyebrow?: string
  badge?: string
  href?: string
  label?: string
  value?: string
  suffix?: string
  prefix?: string
  price?: string
  period?: string
  features?: string[]
  cta?: CtaPlan
  image?: string
  quote?: string
  author?: string
  role?: string
  avatar?: string
  initials?: string
  highlighted?: boolean
  category?: string
  tag?: string
  date?: string
}

export interface PagePlan {
  path: string
  title: string
  metaTitle: string
  metaDescription: string
  sections: SectionPlan[]
}

export interface GeneratedProjectManifest {
  brief: DesignBrief
  theme: ThemeTokens
  pages: PagePlan[]
}

export interface RequiredComponent {
  // shadcn slug (e.g. "accordion", "card", "tabs")
  slug: string
  // Local file path to emit (e.g. "components/ui/accordion.tsx")
  path: string
  // Named exports the rendered TSX may reference
  exports: string[]
}

export interface BuilderOptions {
  model?: ModelSelection
  quality?: "fast" | "best"
  projectId?: string
}

export interface BuilderFile {
  path: string
  content: string
}

export interface PipelineLog {
  step: string
  detail: string
}

export interface BuildValidationResult {
  ok: boolean
  errors: string[]
  warnings: string[]
  attempts: number
}

export interface RunBuilderResult {
  manifest: GeneratedProjectManifest
  files: BuilderFile[]
  logs: PipelineLog[]
  build: BuildValidationResult
  warnings: string[]
  qualityScore: number
}
