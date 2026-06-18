// Types for runAIWebsiteBuilder pipeline.
//
// The builder takes a single user prompt and returns a list of
// generated files, a build result, and logs. Each generated file
// has the canonical { path, content } shape required by the spec.

export interface GeneratedFile {
  path: string
  content: string
}

export type SiteType =
  | "commerce"
  | "saas"
  | "portfolio"
  | "dashboard"
  | "blog"
  | "docs"
  | "agency"
  | "other"

export interface PagePlan {
  path: string
  title: string
  purpose: string
  sections: string[]
  features: string[]
  primaryAction: string
  layoutHint: string
  componentsNeeded: string[]
}

export interface SitePlan {
  projectName: string
  siteType: SiteType
  targetAudience: string
  brandStyle: string
  pages: PagePlan[]
}

// Manifest is a deterministic projection of the plan onto
// concrete file paths and component-name routing decisions.
export interface ManifestPage extends PagePlan {
  filePath: string
  componentName: string
  metadataDescription: string
  shadcnComponents: string[]
  handlers: string[]
}

export interface SiteManifest {
  projectName: string
  siteType: SiteType
  targetAudience: string
  brandStyle: string
  navStyle: "minimal" | "centered" | "split"
  footerStyle: "minimal" | "columns" | "centered"
  motionStyle: "subtle" | "playful" | "dramatic"
  theme: {
    primary: string
    radius: string
    font: string
  }
  pages: ManifestPage[]
}

// Per-component data sourced from components.json.
export interface ComponentSpec {
  slug: string
  name: string
  importPath: string
  exports: string[]
}

export interface ComponentsCheatsheet {
  byName: Record<string, ComponentSpec>
  bySlug: Record<string, ComponentSpec>
  allowedNodeNames: Set<string>
}

// UI tree returned by AI page JSON generator.
export interface UINode {
  name: string
  props?: Record<string, unknown>
  children?: Array<UINode | string>
}

export interface PageUITree {
  type: "ui-tree"
  version: string
  component: UINode
}

export interface ValidationIssue {
  level: "error" | "warning"
  message: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

export interface BuilderLogEntry {
  step: string
  status: "ok" | "warn" | "error"
  message: string
  data?: unknown
}

export interface BuildResult {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export interface BuilderResult {
  files: GeneratedFile[]
  plan: SitePlan
  manifest: SiteManifest
  build: BuildResult
  logs: BuilderLogEntry[]
}

export interface RunAIWebsiteBuilderOptions {
  modelId?: string
  modelProvider?: string
  // When true, skips the AI calls and uses deterministic fallback
  // layouts. Mainly used for tests or when GOOGLE_AIAGENT_API is missing.
  offline?: boolean
}
