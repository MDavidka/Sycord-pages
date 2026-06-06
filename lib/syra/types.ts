// Shared types for the Syra AI website generator pipeline.
//
// The "filesystem" that Syra operates on is the project's `pages` array stored
// in MongoDB. Each page is a single file: `name` is the file path (e.g.
// `app/page.tsx`) and `content` is the file body. The tools in `lib/syra/tools.ts`
// read and mutate this virtual filesystem; the API route persists the diff back
// to MongoDB and (later) the existing deploy pipeline ships it to GitHub.

export interface SyraFile {
  path: string
  content: string
}

export type RouterKind = "app" | "src-app" | "pages" | "unknown"

export interface ProjectFramework {
  /** Detected framework, e.g. "Next.js", "React (Vite)", "Static HTML". */
  framework: string
  /** Routing convention used by the project. */
  router: RouterKind
  /** Language used for source files. */
  language: "typescript" | "javascript" | "unknown"
  /** CSS / styling approach. */
  styling: string
  /** Package manager inferred from lockfiles. */
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown"
  /** The canonical entry file Syra should treat as the home page. */
  entryFile: string
  /** Directory new shared components should be written to. */
  componentsDir: string
  /** True when no project files exist yet (fresh scaffold). */
  isEmpty: boolean
  /** Human readable notes used in the plan + context. */
  notes: string[]
}

/** A single change applied to the virtual filesystem. */
export interface FileChange {
  path: string
  /** Whether the file was newly created, edited, or removed. */
  kind: "created" | "modified" | "deleted"
  content: string
  /** Content before the change (for modified/deleted files). */
  previous?: string
}

/** Design direction for the whole site (drives the visual style). */
export interface SyraPlanDesign {
  /** Overall visual style, e.g. "modern minimal SaaS, bold dark theme". */
  style: string
  /** Color direction, e.g. "indigo + slate, subtle gradients". */
  colors: string
  /** Typography vibe, e.g. "large geometric headings, clean body". */
  typography: string
  /** Layout/navigation approach, e.g. "sticky top nav + spacious sections". */
  layout: string
}

/** Per-page creative design direction (chosen for that page's purpose). */
export interface SyraPageDesign {
  /** How the page should look / its visual approach. */
  visualApproach: string
  /** The emotional tone / mood of the page. */
  mood: string
  /** Layout treatment for each of the page's sections. */
  sectionLayouts: string[]
}

/** A single navigation entry shared across the site. */
export interface SyraNavItem {
  /** Human-readable label shown in the nav. */
  label: string
  /** Route the entry links to. */
  route: string
}

/**
 * Site-level manifest describing how the pages cohere: the full route map, the
 * shared navigation + layout, the backend surface, and the metadata/SEO
 * direction every route should follow.
 */
export interface SyraSiteManifest {
  /** Every route in the site (superset of, and when derived equal to, page paths). */
  routes: string[]
  /** Shared navigation entries used on every route. */
  navigation: SyraNavItem[]
  /** Description of the shared layout (header/nav + footer) used across routes. */
  sharedLayout: string
  /** Backend endpoints (route handlers / server actions) the site exposes. */
  backendEndpoints: string[]
  /** Site-wide metadata / SEO direction every route's metadata should follow. */
  metadata: string
}

/** A page in the plan with its concrete design + content breakdown. */
export interface SyraPlanPage {
  path: string
  /** Page title / route name. */
  title: string
  /** What the page is for. */
  purpose: string
  /** Ordered sections/content blocks the page should contain. */
  sections: string[]
  /** Per-page creative design direction (derived when the model omits it). */
  design?: SyraPageDesign
}

/** The plan Syra produces before generating any code. */
export interface SyraPlan {
  summary: string
  /** Site-wide visual design direction. */
  design: SyraPlanDesign
  steps: string[]
  /** Per-page design + content breakdown. */
  pages: SyraPlanPage[]
  /** Shared components to build (paths or names). */
  components: string[]
  /** Backend pieces (route handlers / server actions). */
  backend: string[]
  /** Site-level manifest describing routes, navigation, shared layout, backend + metadata. */
  manifest: SyraSiteManifest
  /** Flat file list (derived) used for logging/scaffolding fallbacks. */
  files: { path: string; purpose: string }[]
}

/**
 * Stream event emitted by the pipeline. The UI maps `step`/`tool` to an icon and
 * a spinner while running. Every event carries a monotonically increasing `id`
 * so the client can dedupe and order them.
 */
export type SyraEvent =
  | { type: "step"; id: number; key: SyraStepKey; status: StepStatus; label: string; detail?: string }
  | { type: "tool"; id: number; tool: string; status: StepStatus; label: string; detail?: string; args?: unknown }
  | { type: "plan"; id: number; plan: SyraPlan }
  | { type: "context"; id: number; cached: boolean; tokens?: number; detail: string }
  | { type: "file"; id: number; change: FileChange }
  | { type: "log"; id: number; level: "info" | "warn" | "error"; message: string }
  | {
      type: "result"
      id: number
      success: boolean
      summary: string
      created: string[]
      modified: string[]
      deleted: string[]
      previewPath: string | null
      error?: string
    }

export type StepStatus = "pending" | "running" | "success" | "error" | "skipped"

/**
 * Distributive Omit so that removing a key from the `SyraEvent` discriminated
 * union preserves each member's own fields (a plain `Omit<Union, K>` collapses
 * to the common keys only).
 */
export type DistributiveOmit<T, K extends keyof any> = T extends unknown ? Omit<T, K> : never

/** A SyraEvent before the pipeline assigns its sequential `id`. */
export type SyraEventInput = DistributiveOmit<SyraEvent, "id">

export type SyraStepKey =
  | "prompt"
  | "inspect"
  | "read"
  | "cache"
  | "plan"
  | "generate"
  | "save"
  | "validate"
  | "summary"

export interface SyraStepMeta {
  key: SyraStepKey
  /** lucide-react icon name rendered by the UI. */
  icon: string
  title: string
}

/** Canonical ordered list of pipeline steps (UI renders these with icons). */
export const SYRA_STEPS: SyraStepMeta[] = [
  { key: "prompt", icon: "MessageSquare", title: "Understanding your prompt" },
  { key: "inspect", icon: "FolderTree", title: "Inspecting the codebase" },
  { key: "read", icon: "FileSearch", title: "Reading key files" },
  { key: "cache", icon: "DatabaseZap", title: "Caching project context" },
  { key: "plan", icon: "ListChecks", title: "Planning the build" },
  { key: "generate", icon: "Wand2", title: "Generating files" },
  { key: "validate", icon: "ShieldCheck", title: "Validating output" },
  { key: "save", icon: "Save", title: "Saving to project" },
  { key: "summary", icon: "CheckCircle2", title: "Done" },
]

/** lucide-react icon name for a given tool, used by the progress UI. */
export function iconForTool(tool: string): string {
  switch (tool) {
    case "list_files":
    case "get_project_structure":
      return "FolderTree"
    case "read_file":
    case "read_files":
    case "get_file_map":
      return "FileSearch"
    case "write_file":
    case "write_files":
      return "FilePlus2"
    case "edit_file":
      return "FilePen"
    case "delete_file":
      return "Trash2"
    case "detect_framework":
      return "Boxes"
    case "get_package_info":
      return "Package"
    case "ensure_deployable":
      return "PackageCheck"
    case "get_icon_suggestions":
      return "Sparkles"
    case "generate_color_palette":
      return "Palette"
    case "log_action":
      return "Activity"
    default:
      return "Wrench"
  }
}
