export type SyraMode = "generate" | "edit" | "fix" | "auto"

export interface GeneratedFile {
  name: string
  content: string
  usedFor?: string
  createdAt?: string
  updatedAt?: string
  contentHash?: string
  size?: number
}

export interface GeneratedPage {
  name: string
  code: string
  timestamp: number
  usedFor?: string
}

export interface SyraRequest {
  prompt: string
  projectId: string
  modelId: string
  provider: string
  mode: "auto" | "generate" | "edit" | "fix"
  selectedFile?: string
  attachments?: Array<{
    name: string
    type: string
    text: string
  }>
  diagnostics?: Diagnostic[]
  deployLogs?: string[]
}

export interface ProjectSnapshot {
  projectId: string
  userId: string
  revision: string
  files: GeneratedFile[]
  pageCount: number
  routeMap: Array<{ route: string; file: string }>
  packageJson: Record<string, unknown> | null
  lastGoodBuild: string | null
  lastErrors: string[]
}

export interface IntentResult {
  mode: SyraMode
  confidence: number
  reason: string
  targetFilesHint: string[]
  destructive: boolean
}

export interface ContextPack {
  fullFiles: GeneratedFile[]
  summaryFiles: FileSummary[]
  designSystem: DesignSystem
  routeMap: Array<{ route: string; file: string }>
  importGraph: Array<{ from: string; to: string }>
  availableShadcnComponents: string[]
  dependencyReport: string
  diagnostics: Diagnostic[]
  cacheStats: CacheStats
}

export interface FileSummary {
  name: string
  role: string
  route: string | null
  summary: string
  exports: string[]
  imports: string[]
  components: string[]
  shadcn: string[]
  designTokens: string[]
  lastModified: string
  contentHash: string
}

export interface DesignSystem {
  colors: string[]
  fonts: string[]
  radius: string[]
  tailwindPatterns: string[]
  notes: string
}

export interface BuildPlan {
  mode: SyraMode
  title: string
  summary: string
  userIntent: string
  designDirection: {
    style: string
    colors: string[]
    layout: string
    tone: string
    responsiveBehavior: string
  }
  filesToCreate: Array<{
    name: string
    usedFor: string
    reason: string
    priority: number
  }>
  filesToModify: Array<{
    name: string
    usedFor: string
    reason: string
    priority: number
  }>
  filesToDelete: string[]
  filesToMove: Array<{ from: string; to: string; reason: string }>
  routes: Array<{ path: string; file: string; purpose: string }>
  components: Array<{ name: string; file: string; purpose: string }>
  dependencies: string[]
  validationFocus: string[]
  risks: string[]
}

export interface FileChange {
  name: string
  action: "upsert" | "delete" | "move"
  usedFor?: string
  content?: string
  target?: string
}

export interface CodeOutput {
  files: FileChange[]
  delete: string[]
  move: Array<{ from: string; to: string }>
  notes: string[]
}

export interface RepairOutput {
  files: FileChange[]
  delete: string[]
  move: Array<{ from: string; to: string }>
  fixedDiagnostics: Array<{
    file: string
    code: string
    message: string
  }>
  notes: string[]
}

export interface ParsedFileChangeSet {
  upserts: Array<{ name: string; content: string; usedFor: string }>
  deletes: string[]
  moves: Array<{ from: string; to: string }>
  parserWarnings: string[]
}

export interface Diagnostic {
  file: string
  severity: "error" | "warning"
  code: string
  message: string
  suggestedFix?: string
  line?: number
  column?: number
}

export interface BuildHistoryEntry {
  requestId: string
  prompt: string
  mode: SyraMode
  model: string
  status: "success" | "partial" | "failed"
  startedAt: string
  finishedAt: string
  durationMs: number
  changedFiles: string[]
  diagnostics: Diagnostic[]
  repairPasses: number
  cacheStats: CacheStats
}

export interface ProjectMemory {
  version: "syra-memory-v1"
  projectId: string
  revision: string
  createdAt: string
  updatedAt: string
  files: Array<{
    name: string
    contentHash: string
    size: number
    usedFor: string
    updatedAt: string
  }>
  summaries: FileSummary[]
  routeMap: Array<{ route: string; file: string }>
  importGraph: Array<{ from: string; to: string }>
  designSystem: DesignSystem
  diagnostics: Diagnostic[]
  recentRequests: Array<{ prompt: string; mode: SyraMode; timestamp: string }>
  lastGoodBuild: string | null
}

export interface CacheStats {
  systemPromptHit: boolean
  cheatsheetHit: boolean
  memoryHit: boolean
  fileSummaryHits: number
  fileSummaryMisses: number
  planHit: boolean
}

export type SSEEventName = "stage" | "memory" | "cache" | "plan" | "file" | "diagnostic" | "repair" | "saved" | "error" | "done"

export interface SSEEvent {
  stage?: string
  status?: "running" | "done" | "error" | "warning"
  title?: string
  message?: string
  mode?: SyraMode
  file?: string
  action?: string
  chars?: number
  changedFiles?: string[]
  fullFiles?: string[]
  summaryCount?: number
  cacheHit?: boolean
  memoryHit?: boolean
  fileSummaryHits?: number
  fileSummaryMisses?: number
  planHit?: boolean
  revision?: string
  severity?: "error" | "warning" | "info"
  code?: string
  errors?: number
  retryable?: boolean
  diagnostics?: Diagnostic[]
  filesToCreate?: Array<{ name: string; usedFor: string }>
  filesToModify?: Array<{ name: string; usedFor: string }>
  filesToDelete?: string[]
}
