// Builder state machine + shared types for the rebuilt v0-like AI builder.
//
// The 13 phases below mirror the spec ("Pipeline phases (verbatim)") so the
// PipelineTimeline component, BuilderInspector and PromptComposer all read
// the same status from a single source of truth.

import type { ProjectManifest } from "@/lib/project-manifest"
import type { PlanEntry } from "@/lib/plan-types"

export type BuilderPhase =
  | "idle"
  | "intake"
  | "planning"
  | "designing"
  | "scaffolding"
  | "styling"
  | "validating-json"
  | "logic"
  | "converting"
  | "assembling"
  | "building"
  | "fixing"
  | "deploying"
  | "done"

export const PIPELINE_PHASES: { id: BuilderPhase; label: string; short: string }[] = [
  { id: "intake",          label: "Intake",            short: "Intake" },
  { id: "planning",        label: "Planning",          short: "Plan" },
  { id: "designing",       label: "Designing",         short: "Design" },
  { id: "scaffolding",     label: "Scaffolding",       short: "Scaffold" },
  { id: "styling",         label: "Styling JSON",      short: "Style" },
  { id: "validating-json", label: "Validating JSON",   short: "Validate" },
  { id: "logic",           label: "Logic TypeScript",  short: "Logic" },
  { id: "converting",      label: "Converter",         short: "Convert" },
  { id: "assembling",      label: "Assembling",        short: "Assemble" },
  { id: "building",        label: "Building",          short: "Build" },
  { id: "fixing",          label: "Auto-fixing",       short: "Fix" },
  { id: "deploying",       label: "Deploying",         short: "Deploy" },
]

// Each generated artifact placed on disk by the orchestrator.
export interface GeneratedPage {
  name: string
  code: string
  timestamp: number
  usedFor?: string
}

// Streamed user-facing chat message (left panel).
export interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  isError?: boolean
  isIntermediate?: boolean
  attachments?: { name: string; size: number; type: string }[]
}

// Per-phase log line (right panel "Logs" tab).
export interface BuilderLog {
  id: string
  level: "info" | "warn" | "error"
  phase: BuilderPhase | "system"
  message: string
  timestamp: number
}

// What the builder considers a successful deploy result.
export interface DeployResult {
  url?: string
  githubUrl?: string
  repoId?: string
}

// Snapshot of the build pipeline state surfaced to the UI.
export interface BuilderState {
  phase: BuilderPhase
  prompt: string
  attachments: File[]
  brief: PlanEntry[] | null
  manifest: ProjectManifest | null
  files: GeneratedPage[]
  activeFile: string | null
  messages: ChatMessage[]
  logs: BuilderLog[]
  warnings: string[]
  error: string | null
  // Per-stage progress (some stages iterate over pages — show "3 / 6").
  progress: Partial<Record<BuilderPhase, { done: number; total: number }>>
  deploy: DeployResult | null
  // Inspector / preview UX state.
  device: "desktop" | "tablet" | "mobile"
  inspectorTab: InspectorTab
}

export type InspectorTab = "sitemap" | "files" | "json" | "logic" | "build" | "logs"

export const INITIAL_STATE: BuilderState = {
  phase: "idle",
  prompt: "",
  attachments: [],
  brief: null,
  manifest: null,
  files: [],
  activeFile: null,
  messages: [],
  logs: [],
  warnings: [],
  error: null,
  progress: {},
  deploy: null,
  device: "desktop",
  inspectorTab: "sitemap",
}

// Curated model list. Names + provider IDs MUST match the server's
// `lib/ai-provider.ts` model selection — the spec forbids changing them.
export interface ModelOption {
  id: string
  name: string
  provider: string
  fast?: boolean
}

export const DEFAULT_MODEL_ID = "grok-4-1-fast-non-reasoning"

export const MODELS: ModelOption[] = [
  { id: "grok-4-1-fast-non-reasoning", name: "Grok 4.1 Fast", provider: "xAI", fast: true },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B Free", provider: "OpenRouter", fast: true },
  { id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash", provider: "Google", fast: true },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro Preview", provider: "Google" },
]
