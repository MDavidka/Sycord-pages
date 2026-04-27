// ── Pipeline core types ──────────────────────────────────────────────
// Every type used across the builder pipeline lives here so the codebase
// has a single source of truth.

// ── Generated file ──────────────────────────────────────────────────
export interface GeneratedFile {
  path: string
  content: string
  kind?: "scaffold" | "page" | "component" | "logic" | "config" | "style"
  status?: "ok" | "warning" | "error"
  warnings?: string[]
}

// ── Intake output ───────────────────────────────────────────────────
export type SiteType =
  | "commerce"
  | "saas"
  | "portfolio"
  | "dashboard"
  | "blog"
  | "docs"
  | "support"
  | "agency"
  | "general"

export interface IntakeBrief {
  rawPrompt: string
  siteType: SiteType
  keywords: string[]
  requestedPages: string[]
  requestedFeatures: string[]
  styleHints: string[]
  audience: string
}

// ── Planning output ─────────────────────────────────────────────────
export interface PlanEntry {
  path: string
  title: string
  description: string
  features: string[]
  primaryAction: string
  secondaryAction: string
  audience: string
  contentType: string
}

// ── Manifest ────────────────────────────────────────────────────────
export type VisualStyle =
  | "minimal-saas"
  | "premium-commerce"
  | "bold-agency"
  | "editorial"
  | "portfolio"
  | "technical-docs"
  | "data-dashboard"
  | "calm-wellness"

export type NavVariant =
  | "commerce"
  | "saas"
  | "agency"
  | "portfolio"
  | "docs"
  | "app"
  | "editorial"

export type MotionLevel = "none" | "subtle" | "polished"

export interface ManifestTheme {
  name: string
  primaryHue: number
  primarySat: number
  radius: string
  headingFont: string
  bodyFont: string
}

export interface ManifestChrome {
  brandName: string
  navVariant: NavVariant
  headerLayout: string
  mobileNav: string
  footerVariant: string
  primaryCtaLabel: string
  primaryCtaHref: string
}

export interface ManifestDesign {
  visualStyle: VisualStyle
  heroTreatment: string
  sectionRhythm: string
  cardTreatment: string
  typographyScale: string
  motionLevel: MotionLevel
}

export interface ManifestPage {
  route: string
  slug: string
  title: string
  componentName: string
  filePath: string
  metadata: { title: string; description: string }
  description: string
  features: string[]
  pageRole: string
  layoutHint: string
  sectionSignature: string[]
  motionProfile: MotionLevel
}

export interface ProjectManifest {
  brief: IntakeBrief
  projectName: string
  pages: ManifestPage[]
  router: Record<string, string>
  theme: ManifestTheme
  chrome: ManifestChrome
  design: ManifestDesign
}

// ── UI tree (page JSON intermediate) ────────────────────────────────
export interface UiNode {
  name: string
  props?: Record<string, unknown>
  children?: UiNode[]
  text?: string
}

export interface UiTreeEnvelope {
  type: "ui-tree"
  version: "1.0"
  component: UiNode
}

// ── JSON validation ─────────────────────────────────────────────────
export interface ValidationResult {
  valid: boolean
  nodeCount: number
  usedComponents: string[]
  usedHandlers: string[]
  usedStates: string[]
  warnings: string[]
  errors: string[]
}

// ── Build result ────────────────────────────────────────────────────
export type IssueCategory =
  | "missing-import"
  | "invalid-component"
  | "invalid-motion-wrapper"
  | "invalid-icon"
  | "missing-handler"
  | "typescript"
  | "nextjs"
  | "tailwind"
  | "package"
  | "unknown"

export interface BuildIssue {
  file: string
  line?: number
  message: string
  category: IssueCategory
}

export interface BuildResult {
  ok: boolean
  logs: string[]
  issues: BuildIssue[]
}

// ── Deploy result ───────────────────────────────────────────────────
export interface DeployResult {
  ok: boolean
  url?: string
  zipUrl?: string
  logs: string[]
}

// ── Generated project ───────────────────────────────────────────────
export interface GeneratedProject {
  name: string
  manifest: ProjectManifest
  files: GeneratedFile[]
}

// ── Pipeline events (streamed to the frontend) ──────────────────────
export type PipelineEventType =
  | "phase"
  | "plan"
  | "file"
  | "page"
  | "json"
  | "build"
  | "preview"
  | "error"
  | "complete"

export interface PipelineEvent {
  type: PipelineEventType
  timestamp: number
  phase?: string
  message?: string
  plan?: PlanEntry[]
  manifestSummary?: string
  path?: string
  fileStatus?: string
  fileKind?: string
  route?: string
  routeStatus?: string
  jsonSummary?: string
  validationResult?: ValidationResult
  buildStatus?: string
  buildIssues?: BuildIssue[]
  buildLogs?: string[]
  previewUrl?: string
  error?: string
  recoverable?: boolean
  project?: GeneratedProject
}

// ── Model selection (matches existing ai-provider) ──────────────────
export interface ModelSelection {
  id: string
  provider: string
  name?: string
  fast?: boolean
}
