// Syra Engine Types — v2 schema aligned with the Syra manifest spec.
// siteMetadata → routingGraph → pages → sections → components

// ── Site Metadata ────────────────────────────────────────────────

export interface SiteMetadata {
  projectId: string
  siteName: string
  globalTheme: {
    variant: "dark" | "light"
    primaryColor: string
    borderRadius: string
  }
}

// ── Routing ──────────────────────────────────────────────────────

export interface RouteEdge {
  sourcePageId: string
  targetPageId: string
  triggerElementId: string
  actionType: "PUSH_ROUTE"
}

// ── Component ────────────────────────────────────────────────────

export interface ManifestComponent {
  id: string
  shadcnPrimitive: "card" | "button" | "input" | "dialog" | "badge" | "tabs" | "accordion" | "label" | "separator" | "skeleton" | "progress" | "avatar" | "textarea" | "select" | "checkbox" | "switch" | "tooltip" | "popover" | "sheet" | "alert" | "table" | "carousel" | "slider" | "toggle" | "breadcrumb" | "pagination" | "navigation-menu" | "radio-group" | "scroll-area"
  purpose: string
  styles: {
    customTailwindClasses: string
  }
  props: Record<string, unknown>
  children: ManifestComponent[] | null
}

// ── Section ──────────────────────────────────────────────────────

export interface ManifestSection {
  sectionId: string
  semanticType: "hero" | "features" | "pricing" | "testimonials" | "cta" | "faq" | "footer" | "stats" | "contact" | "logos" | "gallery" | "team" | "blog" | "process" | "generic"
  displayName: string
  layoutContainer: "container-grid" | "container-flex" | "full-width"
  gridCols: number | null
  components: ManifestComponent[]
}

// ── Page ─────────────────────────────────────────────────────────

export interface ManifestPage {
  pageId: string
  slug: string
  title: string
  metaDescription: string
  layout: {
    rootType: "flex-col"
    headerEnabled: boolean
    footerEnabled: boolean
    sections: ManifestSection[]
  }
}

// ── Manifest AST ─────────────────────────────────────────────────

export interface ManifestAST {
  $schema: string
  siteMetadata: SiteMetadata
  routingGraph: RouteEdge[]
  pages: ManifestPage[]
}

// ── Pipeline ─────────────────────────────────────────────────────

export type PipelineStage = "prompt-check" | "manifest-gen" | "scaffold" | "compile-sections" | "done" | "error"

export interface PipelineStep {
  stage: PipelineStage
  label: string
  status: "pending" | "running" | "done" | "error"
}

export interface PipelineState {
  currentStage: PipelineStage
  steps: PipelineStep[]
  overallProgress: number
  detail: string
  warnings: string[]
  errors: string[]
}

export const DEFAULT_STEPS: PipelineStep[] = [
  { stage: "prompt-check", label: "Analyzing Prompt", status: "pending" },
  { stage: "manifest-gen", label: "Generating Layout", status: "pending" },
  { stage: "scaffold", label: "Scaffolding Files", status: "pending" },
  { stage: "compile-sections", label: "Compiling Sections", status: "pending" },
]

// ── Generated Files ──────────────────────────────────────────────

export interface GeneratedFile {
  path: string
  content: string
  type: "layout-map" | "header" | "footer" | "section" | "page" | "config" | "style"
}

// ── Results & Events ─────────────────────────────────────────────

export interface GenerationResult {
  projectId: string
  manifest: ManifestAST
  files: GeneratedFile[]
  sectionsBuilt: number
  sectionsTotal: number
  pipelineState: PipelineState
}

export interface ProgressEvent {
  type: "step" | "section" | "file" | "manifest" | "complete" | "error" | "clarify"
  stage?: PipelineStage
  status?: "pending" | "running" | "done" | "error"
  progress?: number
  detail?: string
  sectionId?: string
  sectionIndex?: number
  sectionsTotal?: number
  filePath?: string
  manifest?: ManifestAST
  files?: GeneratedFile[]
  error?: string
  clarifyQuestion?: string
}

// ── Prompt History ───────────────────────────────────────────────

export interface ModificationLayer {
  index: number
  instruction: string
  timestamp: number
  affectedSectionIds: string[]
}
