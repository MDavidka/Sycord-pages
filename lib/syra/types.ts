// Syra Engine — v0-style Generative UI Builder
// Types for the 8-step pipeline: Prompt → Manifest → Scaffold → Compile → Guard → Write → Preview → Iterate

// ── Prompt History ──────────────────────────────────────────────

export type ModificationLayer = {
  index: number
  instruction: string
  timestamp: number
  affectedSessionIds: string[]
}

// ── Manifest AST ────────────────────────────────────────────────

export interface ManifestElement {
  id: string
  type: string
  variant?: "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
  size?: "sm" | "default" | "lg" | "icon"
  className?: string
  content?: string
  children?: ManifestElement[]
}

export interface ManifestSection {
  id: string
  type: "hero" | "features" | "pricing" | "cta" | "faq" | "footer" | "stats" | "testimonials" | "contact" | "logos" | "gallery" | "team" | "blog" | "process" | "generic"
  layout?: "centered" | "split" | "grid-2" | "grid-3" | "grid-4" | "asymmetric" | "bento" | "alternating"
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

export interface ManifestAST {
  projectName: string
  tagline: string
  theme: "saas" | "agency" | "ecommerce" | "portfolio" | "dark" | "minimal"
  colorScheme: "neutral" | "vibrant" | "dark" | "soft" | "high-contrast"
  density: "minimal" | "balanced" | "dense"
  pages: ManifestPage[]
}

// ── Generated Files ─────────────────────────────────────────────

export interface GeneratedFile {
  path: string
  content: string
  type: "page" | "section" | "layout" | "config" | "style"
  hash?: string
}

// ── Pipeline State ──────────────────────────────────────────────

export type PipelineStage =
  | "prompt-clarify"
  | "manifest-gen"
  | "manifest-validate"
  | "scaffold"
  | "compile-sections"
  | "syntax-guard"
  | "disk-write"
  | "preview"
  | "done"
  | "error"

export interface PipelineStep {
  stage: PipelineStage
  label: string
  status: "pending" | "running" | "done" | "error"
  progress: number // 0-100 for this step
  detail: string
}

export interface PipelineState {
  currentStage: PipelineStage
  steps: PipelineStep[]
  overallProgress: number
  detail: string
  warnings: string[]
  errors: string[]
}

// ── Generation Result ───────────────────────────────────────────

export interface GenerationResult {
  projectId: string
  manifest: ManifestAST
  files: GeneratedFile[]
  sectionsBuilt: number
  sectionsTotal: number
  pipelineState: PipelineState
}

// ── Progress Events (SSE) ──────────────────────────────────────

export interface ProgressEvent {
  type: "step" | "section" | "file" | "manifest" | "complete" | "error"
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
  modificationLayer?: number
}
