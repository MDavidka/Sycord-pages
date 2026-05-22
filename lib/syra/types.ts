// Syra — v0-style Generative UI Builder
// Core type definitions for the pipeline: Plan → Manifest → Compile → Validate → Persist

// ── Pipeline State ─────────────────────────────────────────────

export type PipelineStep =
  | "planning"
  | "manifest"
  | "compiling"
  | "validating"
  | "persisting"
  | "done"
  | "error"

export type StepStatus = "pending" | "running" | "done" | "error"

export interface PipelineState {
  currentStep: PipelineStep
  steps: Record<PipelineStep, StepStatus>
  progress: number // 0-100
  detail: string
  warnings: string[]
  errors: string[]
}

// ── Registry ───────────────────────────────────────────────────

export interface RegistryEntry {
  component: string // file name e.g. "button"
  importPath: string // "@/components/ui/button"
  exports: string[] // ["Button"] or ["Card", "CardHeader", ...]
  isClient: boolean
  voidElement: boolean // self-closing, no children
  subcomponents: string[] // e.g. ["CardHeader", "CardContent"]
}

// ── Site Manifest ──────────────────────────────────────────────

export interface ManifestElement {
  id: string
  type: string // must match a key in ComponentRegistry
  variant?: string
  size?: string
  className?: string
  content?: string // text content
  children?: ManifestElement[]
  props?: Record<string, unknown>
  // Reserved for client components that need state
  isClient?: boolean
  logicSwitch?: string // references a state variable name for conditional rendering
}

export interface ManifestSection {
  id: string
  section: "hero" | "features" | "pricing" | "cta" | "faq" | "footer" | "stats" | "testimonials" | "contact" | "logos" | "gallery" | "team" | "blog" | "process" | "generic"
  layout?: "centered" | "split" | "grid-2col" | "grid-3col" | "grid-4col" | "asymmetric" | "alternating" | "bento" | "marquee"
  bg?: "default" | "muted" | "card" | "primary/5" | "accent/5"
  padding?: "sm" | "md" | "lg" | "xl"
  elements: ManifestElement[]
}

export interface ManifestPage {
  path: string
  title: string
  metaTitle: string
  metaDescription: string
  sections: ManifestSection[]
}

export interface SiteManifest {
  projectName: string
  tagline: string
  theme: "saas" | "agency" | "ecommerce" | "portfolio" | "dark" | "minimal"
  colorScheme: "neutral" | "vibrant" | "dark" | "soft" | "high-contrast"
  density: "minimal" | "balanced" | "dense"
  pages: ManifestPage[]
}

// ── Generated File ─────────────────────────────────────────────

export interface GeneratedFile {
  path: string
  content: string
  type: "page" | "layout" | "component" | "config" | "style"
}

// ── Generation Result ──────────────────────────────────────────

export interface GenerationResult {
  siteId: string
  manifest: SiteManifest
  files: GeneratedFile[]
  pipelineState: PipelineState
}

// ── Progress Event (for SSE) ───────────────────────────────────

export interface ProgressEvent {
  type: "step" | "detail" | "page" | "file" | "complete" | "error" | "manifest"
  step?: PipelineStep
  status?: StepStatus
  progress?: number
  detail?: string
  pagePath?: string
  filePath?: string
  manifest?: SiteManifest
  files?: GeneratedFile[]
  error?: string
}

export type ProgressCallback = (event: ProgressEvent) => void

// ── Theme Tokens ───────────────────────────────────────────────

export interface ThemeTokens {
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
  radius: string
}

// ── Layout Templates ───────────────────────────────────────────

export type LayoutTemplate =
  | "hero-centered"
  | "hero-split"
  | "hero-cinematic"
  | "hero-minimal"
  | "feature-grid-3"
  | "feature-grid-2"
  | "feature-bento"
  | "feature-alternating"
  | "pricing-3-tier"
  | "pricing-2-tier"
  | "faq-accordion"
  | "faq-2col"
  | "cta-banner"
  | "cta-boxed"
  | "cta-split"
  | "stats-row"
  | "stats-3col"
  | "testimonials-grid"
  | "testimonials-marquee"
  | "footer-columns"
  | "footer-minimal"
  | "contact-form"
  | "contact-split"
  | "gallery-grid"
  | "logos-row"

export interface LayoutDefinition {
  template: LayoutTemplate
  description: string
  componentCount: number // target element count
  suggestedDensity: "minimal" | "balanced" | "dense"
}
