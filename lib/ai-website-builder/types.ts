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
  // Branding assets that may come from the host project record.
  logoUrl?: string
  logoInitials?: string
  category?: string
}

// Integration metadata driven both by the AI planner's judgement and by the
// host project's connected integrations. Used to decide which scaffolded
// files (db client, health route, schema, queries, .env) to emit
// and which env vars to surface back to the user.
export type IntegrationKind = "database" | "auth" | "email" | "analytics" | "storage" | "payments" | "other"

export interface IntegrationPlan {
  kind: IntegrationKind
  // Short name the user sees, e.g. "Turso", "Stripe". The planner can name
  // things loosely; the orchestrator normalizes "turso" -> provider "turso".
  name: string
  provider: string
  reason: string
  envVars: string[]
}

export interface EnvVarRequirement {
  key: string
  // Purpose shown in the UI.
  purpose: string
  provider?: string
  // Whether this env var MUST be present for the generated site to work
  // (true) or is optional (false). Database env vars are always required.
  required: boolean
  integration?: string
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
  // Planning metadata (populated by the orchestrator even when the raw AI
  // output omits it).
  needsDatabase: boolean
  databaseProvider?: "turso" | "none"
  integrations: IntegrationPlan[]
  requiredEnvVars: EnvVarRequirement[]
  // Human-readable names of integrations the planner wanted but that the
  // user hasn't connected. The renderer emits safe UI placeholders for
  // these instead of real SDK code, and the API surfaces them in warnings.
  unconnectedIntegrations: string[]
}

export interface RequiredComponent {
  // shadcn slug (e.g. "accordion", "card", "tabs")
  slug: string
  // Local file path to emit (e.g. "components/ui/accordion.tsx")
  path: string
  // Named exports the rendered TSX may reference
  exports: string[]
}

// Project-level context forwarded from the Sycord host app. Allows the
// builder to brand generated sites with the real project name, logo,
// description, and to reason about existing environment variables so
// generated apps can plug directly into the user's configured secrets.
//
// `envVars` contains key+value pairs from `projects.$.envVars`. Values
// are ONLY used for local consumption (generating a real `.env` file,
// deciding if Turso is "connected") and must NEVER be echoed back to
// the UI or included in the API response — only key names may leak.
//
// `connectedIntegrationIds` is the authoritative list of integrations
// the user has actually wired up (derived from envVars with an
// `integration` tag). The planner MUST NOT generate real code for any
// integration id not in this set.
export interface ProjectContext {
  name?: string
  description?: string
  category?: string
  logoUrl?: string
  subdomain?: string
  envVarKeys?: string[]
  envVars?: { key: string; value?: string; integration?: string | null }[]
  integrations?: { name: string; provider?: string }[]
  connectedIntegrationIds?: string[]
}

export interface BuilderOptions {
  model?: ModelSelection
  quality?: "fast" | "best"
  projectId?: string
  project?: ProjectContext
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
  // Integration diagnostics. Useful for the API route to return to the UI
  // so it can show clear "Database required: Turso" / "Missing env vars"
  // messages without re-deriving state from the manifest.
  needsDatabase: boolean
  databaseProvider?: "turso" | "none"
  integrations: IntegrationPlan[]
  requiredEnvVars: EnvVarRequirement[]
  missingEnvVars: EnvVarRequirement[]
  // Integrations the planner wanted but the user hasn't connected —
  // passed through so the API/UI can show a non-blocking advisory.
  unconnectedIntegrations: string[]
}
