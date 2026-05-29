import { z } from "zod"

export type Intent = "generate" | "edit" | "fix"

export interface ModelSelection {
  id: string
  provider: string
  name?: string
}

export interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export interface GeneratedFile {
  name: string
  content: string
  usedFor: string
  action: "upsert" | "delete" | "move"
}

export interface FileMove {
  from: string
  to: string
}

export interface SyraOutput {
  files: Array<{
    name: string
    action: "upsert" | "delete" | "move"
    usedFor: string
    content: string
  }>
  delete: string[]
  move: FileMove[]
  notes: string[]
}

export const SyraOutputSchema = z.object({
  files: z.array(
    z.object({
      name: z.string().min(1),
      action: z.enum(["upsert", "delete", "move"]),
      usedFor: z.string().default(""),
      content: z.string().default(""),
    }),
  ),
  delete: z.array(z.string()).default([]),
  move: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
    }),
  ).default([]),
  notes: z.array(z.string()).default([]),
})

export const BuildPlanSchema = z.object({
  intent: z.enum(["generate", "edit", "fix"]),
  summary: z.string(),
  files: z.array(
    z.object({
      name: z.string(),
      usedFor: z.string(),
      description: z.string(),
      route: z.string(),
      priority: z.number().int().min(1).max(100),
    }),
  ),
  dependencyOrder: z.array(z.string()).default([]),
  routes: z.array(z.string()).default([]),
  sharedComponents: z.array(z.string()).default([]),
  dataModel: z.array(z.string()).default([]),
  designSystem: z.object({
    tokens: z.array(z.string()).default([]),
    colors: z.array(z.string()).default([]),
    radius: z.string().default(""),
    layoutRules: z.array(z.string()).default([]),
  }).default({}),
  requiredDependencies: z.array(z.string()).default([]),
  targetFiles: z.array(z.string()).default([]),
  deleteFiles: z.array(z.string()).default([]),
  moveFiles: z.array(z.object({ from: z.string(), to: z.string() })).default([]),
  riskNotes: z.array(z.string()).default([]),
})

export type BuildPlan = z.infer<typeof BuildPlanSchema>

export interface ProjectMemory {
  revision: string
  files: Array<{
    name: string
    contentHash: string
    usedFor: string
    updatedAt: string
    size: number
  }>
  summaries: Array<{
    name: string
    summary: string
    exports: string[]
    imports: string[]
    route: string
    role: string
  }>
  designSystem: {
    tokens: string[]
    fonts: string[]
    colors: string[]
    radius: string
    layoutRules: string[]
  }
  importGraph: Record<string, string[]>
  routeMap: Record<string, string>
  lastGoodBuild: string | null
  recentUserRequests: string[]
  recentDiagnostics: string[]
}

export interface BuildHistoryEntry {
  prompt: string
  mode: Intent
  model: string
  provider: string
  timestamp: number
  duration: number
  files: string[]
  changedFiles: string[]
  status: "success" | "partial" | "failed"
  diagnostics: string[]
  cacheHits: number
  errors: string[]
  steps: Array<{ title: string; content: string }>
}

export interface ProjectLoadResult {
  projectId: string
  userId: string
  project: Record<string, unknown>
  pages: Array<{ name: string; content: string; usedFor: string; updatedAt: string }>
  aiMemory: ProjectMemory | null
  buildHistory: BuildHistoryEntry[]
  aiRevision: number
  lastBuildError: string | null
  lastDeployError: string | null
  deploymentRuntime: Record<string, unknown> | null
  revisionHash: string
}

export interface SyraPipelineInput {
  userId: string
  projectId: string
  prompt: string
  model: ModelSelection
  requestedMode?: Intent
  temperature?: number
  maxRepairPasses?: number
  onEvent: (event: string, data: Record<string, unknown>) => void
  signal?: AbortSignal
}

export interface SyraPipelineResult {
  pages: Array<{ name: string; content: string; usedFor: string }>
  buildHistory: BuildHistoryEntry
  memory: ProjectMemory
  diagnostics: string[]
  cacheHits: number
  repairPasses: number
}

export interface CallModelOptions {
  model: ModelSelection
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface CallModelResult {
  ok: true
  content: string
  raw: unknown
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

export interface CallModelError {
  ok: false
  status: number
  message: string
  details?: string
  retryable?: boolean
}

export type CallModelReturn = CallModelResult | CallModelError

export interface ValidationError {
  file: string
  type: string
  message: string
  severity: "error" | "warning"
}

export interface DiagnosticEvent {
  file: string
  type: string
  message: string
  severity: "error" | "warning"
  stage: string
}
