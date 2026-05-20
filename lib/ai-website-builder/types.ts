// ============================================================
// Syra Website Builder — Type System (v2)
//
// Architecture: 3-node AI pipeline → deterministic compiler
//
//   Node A (generate_site_architecture) → SiteArchitecture
//   Node B (generate_page_ui_tree)      → PageUITree   (one per route, concurrent)
//   Node C (generate_server_actions)    → ServerActionPlan
//   Compiler                            → BuilderFile[] (.tsx files)
// ============================================================

import type { ModelSelection } from "@/lib/ai-provider"
import type { DesignDirection } from "./design-directions"
export type { DesignDirection } from "./design-directions"

// ─── Theme ─────────────────────────────────────────────────────────────────

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

// ─── Node A — Site Architecture ────────────────────────────────────────────

export interface NavLink {
  label: string
  href: string
}

export interface CtaPlan {
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

// Output of Node A: the full-stack project foundation.
// Maps out routes, DB schema, global theme and global components before
// any page UI is generated.
export interface SiteArchitecture {
  project_name: string
  theme_config: {
    primary_color: string
    mode: "light" | "dark"
  }
  database_schema: Array<{
    model_name: string
    fields: Array<{ name: string; type: string }>
  }>
  routes: Array<{
    path: string
    purpose: string
  }>
  global_components: string[]
  // Derived / normalized fields populated after Node A runs
  themePreset: ThemePreset
  navLinks: NavLink[]
  primaryCta: CtaPlan
  secondaryCta?: CtaPlan
  footerCta?: CtaPlan
  contact?: ContactInfo
  socialLinks?: SocialLink[]
  logoUrl?: string
  logoInitials?: string
  category?: string
  description?: string
  tagline?: string
  audience?: string
  voice?: string
  needsDatabase: boolean
  deploymentMode: "next-server"
}

// ─── Node B — Page UI Tree ─────────────────────────────────────────────────

// Allowed primitive components. Lowercase = HTML tag, Uppercase = shadcn/ui.
// The compiler resolves Uppercase → @/components/ui/<slug>.
export type PrimitiveComponent =
  // HTML tags
  | "main" | "section" | "div" | "header" | "footer" | "nav" | "aside" | "article"
  | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "a" | "ul" | "ol"
  | "li" | "img" | "form" | "fieldset" | "button" | "input" | "textarea" | "label"
  | "select" | "option" | "table" | "thead" | "tbody" | "tr" | "th" | "td"
  // shadcn/ui primitives
  | "Card" | "CardHeader" | "CardTitle" | "CardDescription" | "CardContent" | "CardFooter"
  | "Button" | "Badge" | "Input" | "Textarea" | "Label" | "Separator" | "Avatar"
  | "AvatarImage" | "AvatarFallback"
  | "Accordion" | "AccordionItem" | "AccordionTrigger" | "AccordionContent"
  | "Tabs" | "TabsList" | "TabsTrigger" | "TabsContent"

// A node in the AST. The compiler traverses this tree recursively.
export interface ComponentNode {
  // Unique ID within the page tree.
  id: string
  // Lowercase = HTML tag, Uppercase = shadcn component.
  component: PrimitiveComponent
  // Props as JSON-safe values. Special keys handled by compiler:
  //   bind: "<stateName>"  → value={stateName} onChange={(e) => setStateName(e.target.value)}
  //   onSubmit: "<fnName>" → onSubmit={fnName}
  props?: Record<string, unknown>
  // Leaf text content (rendered as {text} inside the element).
  text?: string
  children?: ComponentNode[]
}

// State variable for a page component.
export interface StateVar {
  name: string
  type: "string" | "number" | "boolean" | "array" | "object"
  default: unknown
}

// Output of Node B: the full UI tree for one route.
export interface PageUITree {
  route: string
  // true → "use client" directive + useState imports
  is_server_component: boolean
  // Shadcn component slugs this page imports (e.g. "Card", "Button")
  imports: string[]
  // Client state variables (only populated when is_server_component = false)
  state: StateVar[]
  tree: ComponentNode
  // Human-readable purpose copied from Node A
  purpose: string
}

// ─── Node C — Server Actions ────────────────────────────────────────────────

export interface DbField {
  name: string
  type: "string" | "number" | "boolean" | "date"
  required?: boolean
}

export interface ServerAction {
  name: string
  // "mutation" → INSERT/UPDATE/DELETE, "query" → SELECT
  kind: "mutation" | "query"
  // Which database model this touches
  model: string
  // Zod-style validation fields generated by the compiler
  inputFields: DbField[]
  // SQL operation to perform
  operation: "insert" | "update" | "delete" | "select"
  description: string
}

// Output of Node C: server actions + DB operations for the whole site.
export interface ServerActionPlan {
  actions: ServerAction[]
  // Route → action name mapping so forms can wire up
  routeBindings: Record<string, string[]>
}

// ─── Pipeline metadata ──────────────────────────────────────────────────────

export type IntegrationKind = "database" | "auth" | "email" | "analytics" | "storage" | "payments" | "other"
export type DeploymentMode = "next-server"

export interface IntegrationPlan {
  kind: IntegrationKind
  name: string
  provider: string
  reason: string
  envVars: string[]
}

export interface EnvVarRequirement {
  key: string
  purpose: string
  provider?: string
  required: boolean
  integration?: string
}

// ─── Generated project manifest (the normalized, validated plan) ───────────
// This is the internal shape passed to the scaffold / validator.

export interface GeneratedProjectManifest {
  // Merged from Node A output
  brief: {
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
    logoUrl?: string
    logoInitials?: string
    category?: string
  }
  theme: ThemeTokens
  designDirection: DesignDirection
  // architecture is the raw Node A output
  architecture: SiteArchitecture
  // pageTrees is the array of Node B outputs (one per route)
  pageTrees: PageUITree[]
  // serverActions is the Node C output
  serverActions?: ServerActionPlan
  deploymentMode: DeploymentMode
  needsDatabase: boolean
  databaseProvider?: "turso" | "none"
  integrations: IntegrationPlan[]
  requiredEnvVars: EnvVarRequirement[]
  unconnectedIntegrations: string[]
}

// ─── Compiler types ─────────────────────────────────────────────────────────

export interface RequiredComponent {
  slug: string
  path: string
  exports: string[]
}

// ─── Project context ─────────────────────────────────────────────────────────

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

// ─── Builder options ─────────────────────────────────────────────────────────

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

// ─── Pipeline stage tracking (for the UI) ───────────────────────────────────

export type PipelineStage =
  | "idle"
  | "node-a"       // Node A: site architecture
  | "node-b"       // Node B: page UI trees (concurrent)
  | "node-c"       // Node C: server actions
  | "compiling"    // Deterministic compiler
  | "scaffolding"  // File scaffold
  | "validating"   // Build validation
  | "done"
  | "error"

export interface RouteProgress {
  path: string
  purpose: string
  status: "pending" | "generating" | "compiling" | "done" | "error"
}

export interface PipelineStatus {
  stage: PipelineStage
  routes: RouteProgress[]
  archDone: boolean
  serverActionsDone: boolean
  compileDone: boolean
  validationDone: boolean
  error?: string
}

// ─── Run result ──────────────────────────────────────────────────────────────

export interface RunBuilderResult {
  manifest: GeneratedProjectManifest
  files: BuilderFile[]
  logs: PipelineLog[]
  build: BuildValidationResult
  warnings: string[]
  qualityScore: number
  needsDatabase: boolean
  databaseProvider?: "turso" | "none"
  integrations: IntegrationPlan[]
  requiredEnvVars: EnvVarRequirement[]
  missingEnvVars: EnvVarRequirement[]
  unconnectedIntegrations: string[]
  deploymentMode: DeploymentMode
}

// ─── Legacy section types (kept for scaffold/renderer compatibility) ──────────

export type SectionKind =
  | "hero" | "feature-grid" | "stats" | "testimonials" | "pricing" | "faq"
  | "contact" | "gallery" | "product-grid" | "comparison" | "process" | "cta"
  | "logos" | "team" | "blog-preview"

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
  componentTree?: ComponentNode
  anchor?: string
}

export interface PagePlan {
  path: string
  title: string
  metaTitle: string
  metaDescription: string
  sections: SectionPlan[]
}
