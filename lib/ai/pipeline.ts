import { existsSync, readFileSync } from "fs"
import { join } from "path"
import { ObjectId } from "mongodb"
import { v4 as uuid } from "uuid"

import type {
  SyraMode,
  SyraRequest,
  ProjectSnapshot,
  IntentResult,
  ContextPack,
  BuildPlan,
  CodeOutput,
  ParsedFileChangeSet,
  Diagnostic,
  GeneratedFile,
  ProjectMemory,
  BuildHistoryEntry,
  SSEEvent,
  GeneratedPage,
} from "./types"

import { callModel, extractJson, extractCode, type ChatMessage } from "@/lib/ai-provider"
import { getSystemPrompts } from "@/lib/ai-prompts"
import {
  AiPipelineError,
  ProviderError,
  ValidationError,
  SaveError,
  redactSecrets,
} from "./errors"
import {
  computeProjectRevision,
  computeContentHash,
  computePromptHash,
  CacheManager,
  fileMtimeHash,
  emptyCacheStats,
} from "./cache"
import { validatePath, isUnsafePath, normalizePath } from "./path-safety"
import { parseCodeOutput, parsePlanOutput, parseRepairOutput } from "./output-parser"
import { validateAllFiles, hasValidationErrors, validatePackageJson, validateTsconfig } from "./validators"
import {
  SYRA_SYSTEM_PROMPT,
  PLANNING_PROMPT,
  CODE_GENERATION_PROMPT,
  EDIT_PROMPT,
  FIX_PROMPT,
  SHADCN_UI_RULES,
  getDefaultPlan,
} from "./prompt-templates"
import {
  loadProjectForUser,
  loadPages,
  saveGeneratedSnapshot,
  saveBuildHistory,
  saveAiMemory,
  saveBuildError,
  clearBuildError,
  loadAiMemory,
  loadLastBuildError,
  loadDeploymentRuntime,
} from "./project-store"
import { buildProjectMemory } from "./memory"
import { buildRagContext } from "./rag"
import {
  createStageEvent,
  createMemoryEvent,
  createCacheEvent,
  createPlanEvent,
  createFileEvent,
  createDiagnosticEvent,
  createRepairEvent,
  createSavedEvent,
  createErrorEvent,
  createDoneEvent,
} from "./events"

const SHADCN_DEP_MAP: Record<string, string[]> = {
  accordion: ["@radix-ui/react-accordion"],
  "alert-dialog": ["@radix-ui/react-alert-dialog"],
  alert: [],
  "aspect-ratio": ["@radix-ui/react-aspect-ratio"],
  avatar: ["@radix-ui/react-avatar"],
  badge: [],
  breadcrumb: [],
  button: ["@radix-ui/react-slot", "class-variance-authority"],
  calendar: ["react-day-picker", "date-fns"],
  card: [],
  carousel: ["embla-carousel-react"],
  chart: ["recharts"],
  checkbox: ["@radix-ui/react-checkbox"],
  collapsible: ["@radix-ui/react-collapsible"],
  comboBox: ["cmdk", "@radix-ui/react-popover"],
  command: ["cmdk"],
  "context-menu": ["@radix-ui/react-context-menu"],
  "data-table": [],
  "date-picker": ["react-day-picker", "date-fns", "@radix-ui/react-popover"],
  dialog: ["@radix-ui/react-dialog"],
  drawer: ["vaul"],
  "dropdown-menu": ["@radix-ui/react-dropdown-menu"],
  empty: [],
  field: [],
  form: ["react-hook-form", "@hookform/resolvers", "zod"],
  "hover-card": ["@radix-ui/react-hover-card"],
  input: [],
  "input-group": [],
  "input-otp": ["input-otp"],
  item: [],
  kbd: [],
  label: ["@radix-ui/react-label"],
  menubar: ["@radix-ui/react-menubar"],
  "navigation-menu": ["@radix-ui/react-navigation-menu"],
  pagination: [],
  popover: ["@radix-ui/react-popover"],
  progress: ["@radix-ui/react-progress"],
  "radio-group": ["@radix-ui/react-radio-group"],
  resizable: ["react-resizable-panels"],
  "scroll-area": ["@radix-ui/react-scroll-area"],
  select: ["@radix-ui/react-select"],
  separator: ["@radix-ui/react-separator"],
  sheet: ["@radix-ui/react-dialog"],
  sidebar: [],
  skeleton: [],
  slider: ["@radix-ui/react-slider"],
  sonner: ["sonner"],
  spinner: [],
  switch: ["@radix-ui/react-switch"],
  table: [],
  tabs: ["@radix-ui/react-tabs"],
  textarea: [],
  toast: ["@radix-ui/react-toast"],
  toggle: ["@radix-ui/react-toggle"],
  "toggle-group": ["@radix-ui/react-toggle-group"],
  tooltip: ["@radix-ui/react-tooltip"],
  typography: [],
}

const CORE_DEPS = ["next", "react", "react-dom"]
const UTILITY_DEPS = ["clsx", "tailwind-merge", "class-variance-authority", "lucide-react", "tailwindcss-animate"]

function buildDependencyReport(): string {
  return Object.entries(SHADCN_DEP_MAP)
    .filter(([, v]) => v.length > 0)
    .map(([k, v]) => `  ${k} -> ${v.join(", ")}`)
    .join("\n")
}

function loadCheatsheet(): string {
  const p = join(process.cwd(), "components.json")
  if (!existsSync(p)) return "No cheatsheet"
  try {
    const d = JSON.parse(readFileSync(p, "utf-8"))
    if (!d?.components) return "No cheatsheet"
    return (d.components as Array<{ slug: string; name: string; import_path: string; exports: string[]; purpose: string; composition?: string }>)
      .map((c) => {
        const deps = SHADCN_DEP_MAP[c.slug] ?? []
        const dd = deps.length ? `\n  npm: ${deps.join(", ")}` : "  npm: none"
        return [
          `${c.name} (${c.slug})`,
          `  import { ${(c.exports || []).join(", ")} } from "${c.import_path}"`,
          `  ${c.purpose}`,
          dd,
          c.composition ? `  nest: ${c.composition}` : "",
        ].filter(Boolean).join("\n")
      }).join("\n\n")
  } catch {
    return "No cheatsheet"
  }
}

type StreamFn = (event: string, data: SSEEvent) => void

// ══════════════════════════════════════════════════════════════
// MAIN PIPELINE
// ══════════════════════════════════════════════════════════════

export async function runSyraPipeline(
  request: SyraRequest,
  userId: string,
  stream: StreamFn,
): Promise<void> {
  const requestId = uuid()
  const cacheStats = emptyCacheStats()
  let repairPasses = 0

  // ─────── STEP 0: Receive request ───────
  stream("stage", createStageEvent("starting", "running", "Starting Syra", "Loading your project and preparing the builder..."))

  const project = await loadProjectForUser(userId, request.projectId)
  if (!project) {
    throw new AiPipelineError({
      stage: "project_load",
      userMessage: "Project not found",
      statusCode: 404,
      retryable: false,
    })
  }

  const existingPages = await loadPages(userId, request.projectId)
  const existingMemory = await loadAiMemory(userId, request.projectId)
  const lastBuildError = await loadLastBuildError(userId, request.projectId)
  const deploymentRuntime = await loadDeploymentRuntime(userId, request.projectId)

  // ─────── STEP 1: Project snapshot ───────
  stream("stage", createStageEvent("starting", "running", "Project loaded", `Loaded ${existingPages.length} existing files`))

  const revision = computeProjectRevision(existingPages)
  const cachedMemory = CacheManager.getProjectMemory(userId, request.projectId, revision) as ProjectMemory | null

  stream("memory", createMemoryEvent(
    "running",
    "Reading project memory",
    "Checking existing files and cached context...",
    revision,
    !!cachedMemory,
  ))

  if (cachedMemory) {
    cacheStats.memoryHit = true
    stream("cache", createCacheEvent(true))
  }

  stream("memory", createMemoryEvent(
    "done",
    cachedMemory ? "Project memory loaded from cache" : "Project memory built",
    `${existingPages.length} files loaded`,
    revision,
    !!cachedMemory,
  ))

  // ─────── STEP 2: Intent detection ───────
  const intent = classifyIntent({
    prompt: request.prompt,
    existingFiles: existingPages,
    selectedFile: request.selectedFile,
    deployLogs: request.deployLogs,
    lastBuildError,
    requestedMode: request.mode,
  })

  stream("stage", createStageEvent("intent", "done", "Understanding request", `Detected ${intent.mode} mode: ${intent.reason}`, {
    mode: intent.mode,
  }))

  const mode = intent.mode

  // ─────── STEP 3: RAG context ───────
  stream("memory", createStageEvent("context", "running", "Selecting relevant files", "Building context from project memory..."))

  const ragContext = buildRagContext(existingPages, {
    prompt: request.prompt,
    selectedFile: request.selectedFile,
    diagnostics: request.diagnostics,
    deployLogs: request.deployLogs,
    mode,
  })

  stream("memory", createStageEvent("context", "done", "Selecting relevant files", `Using ${ragContext.fullFiles.length} full files and ${ragContext.summaryFiles.length} summaries from project memory.`, {
    fullFiles: ragContext.fullFiles.map((f) => f.name),
    summaryCount: ragContext.summaryFiles.length,
  }))

  // ─────── STEP 4: Plan ───────
  stream("stage", createStageEvent("planning", "running", "Planning changes", `Planning ${mode} operation...`))

  const cheatsheet = loadCheatsheet()
  const depReport = buildDependencyReport()
  let customBuildCode = ""

  try {
    const prompts = await getSystemPrompts()
    if (prompts?.builderCode && prompts.builderCode.length > 10 && prompts.builderCode !== "Generation code prompting is disabled.") {
      customBuildCode = prompts.builderCode
    }
  } catch { /* use defaults */ }

  const plan = await callModelForPlan(
    request.prompt,
    mode,
    ragContext,
    cheatsheet,
    depReport,
    customBuildCode,
  )

  stream("plan", createPlanEvent(mode, (plan as any).summary ?? "Plan created",
    ((plan as any).filesToCreate as Array<{ name: string; usedFor: string }>)?.map((f) => ({ name: f.name, usedFor: f.usedFor || "" })),
    ((plan as any).filesToModify as Array<{ name: string; usedFor: string }>)?.map((f) => ({ name: f.name, usedFor: f.usedFor || "" })),
    (plan as any).filesToDelete as string[] | undefined,
  ))

  // ─────── STEP 5: Code generation ───────
  stream("stage", createStageEvent("writing", "running", "Writing files", `Generating code for ${mode} mode...`))

  const generatedFiles: GeneratedFile[] = []
  const allFileChanges: string[] = []

  const allPlannedFiles = [
    ...(((plan as any).filesToCreate ?? []) as Array<{ name: string; usedFor: string }>).map((f) => ({ ...f, action: "upsert" as const })),
    ...(((plan as any).filesToModify ?? []) as Array<{ name: string; usedFor: string }>).map((f) => ({ ...f, action: "upsert" as const })),
  ]

  for (const plannedFile of allPlannedFiles) {
    stream("file", createFileEvent("running", plannedFile.name, plannedFile.action))

    const code = await callModelForCode(
      plan,
      plannedFile.name,
      mode,
      ragContext,
      existingPages,
      generatedFiles,
      cheatsheet,
      depReport,
      customBuildCode,
      request.diagnostics,
    )

    if (code) {
      generatedFiles.push({
        name: plannedFile.name,
        content: code,
        usedFor: plannedFile.usedFor || "",
      })
      allFileChanges.push(plannedFile.name)
      stream("file", createFileEvent("done", plannedFile.name, plannedFile.action, code.length))
    }
  }

  // Process deletions and moves
  for (const del of ((plan as any).filesToDelete as string[] ?? [])) {
    allFileChanges.push(`-${del}`)
  }
  for (const move of ((plan as any).filesToMove as Array<{ from: string; to: string }> ?? [])) {
    allFileChanges.push(`${move.from}->${move.to}`)
  }

  // ─────── STEP 6: Output parsing ───────
  // Already parsed above - each file was parsed individually

  // ─────── STEP 7: Validation ───────
  stream("stage", createStageEvent("validating", "running", "Validating project", "Checking imports, syntax, package.json, and Next.js rules..."))

  const allFiles = mergeSnapshots(existingPages, generatedFiles, plan as any)

  let diagnostics = validateAllFiles(allFiles, existingPages)

  // Additional checks for mandatory files
  const pkgFile = allFiles.find((f) => f.name === "package.json")
  if (pkgFile) {
    const pkgDiags = validatePackageJson(pkgFile.content)
    diagnostics.push(...pkgDiags.diagnostics)
  }

  const tsFile = allFiles.find((f) => f.name === "tsconfig.json")
  if (tsFile) {
    const tsDiags = validateTsconfig(tsFile.content)
    diagnostics.push(...tsDiags.diagnostics)
  }

  for (const diag of diagnostics) {
    stream("diagnostic", createDiagnosticEvent(diag.severity, diag.file, diag.code, diag.message))
  }

  // ─────── STEP 8: Auto-repair loop ───────
  const maxRepairs = mode === "fix" ? 3 : 2

  while (hasValidationErrors(diagnostics) && repairPasses < maxRepairs) {
    repairPasses++
    const errorDiagnostics = diagnostics.filter((d) => d.severity === "error")

    stream("repair", createRepairEvent("running", repairPasses, errorDiagnostics.length))

    const repairedFiles = await callModelForRepair(
      request.prompt,
      plan,
      errorDiagnostics,
      allFiles,
      ragContext,
      cheatsheet,
    )

    // Apply repairs
    let repairedSomething = false
    for (const repair of repairedFiles) {
      const existingIdx = generatedFiles.findIndex((f) => f.name === repair.name)
      if (existingIdx >= 0) {
        generatedFiles[existingIdx] = {
          name: repair.name,
          content: repair.content,
          usedFor: repair.usedFor || generatedFiles[existingIdx].usedFor,
        }
        repairedSomething = true
        stream("file", createFileEvent("done", repair.name, "upsert", repair.content.length))
      }
    }

    if (!repairedSomething) break

    // Re-validate
    const mergedAgain = mergeSnapshots(existingPages, generatedFiles, plan as any)
    diagnostics = validateAllFiles(mergedAgain, existingPages)

    for (const diag of diagnostics) {
      stream("diagnostic", createDiagnosticEvent(diag.severity, diag.file, diag.code, diag.message))
    }

    stream("repair", createRepairEvent("done", repairPasses, diagnostics.filter((d) => d.severity === "error").length))
  }

  const finalDiagnostics = diagnostics

  // ─────── SAVE ───────
  const hasErrors = hasValidationErrors(finalDiagnostics)
  const status: BuildHistoryEntry["status"] = hasErrors ? "partial" : "success"

  stream("stage", createStageEvent("saving", "running", "Saving project", `${allFileChanges.length} files to save...`))

  try {
    const filesToSave = mergeSnapshots(existingPages, generatedFiles, plan as any, (plan as any).filesToDelete as string[] ?? [])
    await saveGeneratedSnapshot(userId, request.projectId, filesToSave)

    // Build and save memory
    const memory = buildProjectMemory(request.projectId, filesToSave, cachedMemory, finalDiagnostics)
    await saveAiMemory(userId, request.projectId, memory)
    CacheManager.setProjectMemory(userId, request.projectId, revision, memory)

    if (hasErrors) {
      await saveBuildError(userId, request.projectId, finalDiagnostics.filter((d) => d.severity === "error").map((d) => d.message).join("\n"))
    } else {
      await clearBuildError(userId, request.projectId)
    }

    stream("saved", createSavedEvent(allFileChanges))

  } catch (err: unknown) {
    throw new SaveError({
      message: "Failed to save project",
      details: err instanceof Error ? err.message : String(err),
      cause: err,
    })
  }

  // Build history
  const historyEntry: BuildHistoryEntry = {
    requestId,
    prompt: request.prompt,
    mode,
    model: `${request.provider}/${request.modelId}`,
    status,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: 0,
    changedFiles: allFileChanges,
    diagnostics: finalDiagnostics,
    repairPasses,
    cacheStats,
  }

  await saveBuildHistory(userId, request.projectId, historyEntry)

  // ─────── DONE ───────
  stream("done", createDoneEvent())
}

// ══════════════════════════════════════════════════════════════
// INTENT CLASSIFICATION
// ══════════════════════════════════════════════════════════════

interface ClassifyInput {
  prompt: string
  existingFiles: GeneratedFile[]
  selectedFile?: string
  deployLogs?: string[]
  lastBuildError?: string | null
  requestedMode: "auto" | "generate" | "edit" | "fix"
}

export function classifyIntent(input: ClassifyInput): IntentResult {
  if (input.requestedMode !== "auto") {
    return {
      mode: input.requestedMode as SyraMode,
      confidence: 100,
      reason: "Explicitly requested by user",
      targetFilesHint: [],
      destructive: input.requestedMode === "generate" && input.existingFiles.length > 0,
    }
  }

  const promptLower = input.prompt.toLowerCase()
  const hasFiles = input.existingFiles.length > 0

  // Fix mode detection
  const hasDeployLogs = (input.deployLogs && input.deployLogs.length > 0) || !!input.lastBuildError
  const isFixRequest = promptLower.includes("fix") || promptLower.includes("error") || promptLower.includes("broken") || promptLower.includes("debug") || promptLower.includes("repair")

  if (hasDeployLogs || (isFixRequest && hasFiles)) {
    return {
      mode: "fix",
      confidence: hasDeployLogs ? 95 : 70,
      reason: hasDeployLogs ? "Deploy/build errors detected" : "User requested fix with existing project",
      targetFilesHint: [],
      destructive: false,
    }
  }

  // Generate mode detection
  const generateKeywords = ["create", "new site", "start over", "from scratch", "replace", "rebuild", "fresh"]
  const isGenerateRequest = generateKeywords.some((k) => promptLower.includes(k))

  if (!hasFiles || isGenerateRequest) {
    return {
      mode: "generate",
      confidence: !hasFiles ? 100 : 80,
      reason: !hasFiles ? "No existing files in project" : "User requested new site",
      targetFilesHint: [],
      destructive: hasFiles,
    }
  }

  // Default to edit for existing projects
  return {
    mode: "edit",
    confidence: 75,
    reason: "Editing existing project",
    targetFilesHint: [],
    destructive: false,
  }
}

// ══════════════════════════════════════════════════════════════
// MODEL CALL HELPERS
// ══════════════════════════════════════════════════════════════

async function callModelForPlan(
  prompt: string,
  mode: SyraMode,
  ragContext: ContextPack,
  cheatsheet: string,
  depReport: string,
  customBuildCode: string,
): Promise<Record<string, unknown>> {
  const contextStr = buildContextString(ragContext)

  const systemContent = [
    SYRA_SYSTEM_PROMPT,
    PLANNING_PROMPT,
    SHADCN_UI_RULES,
    cheatsheet,
    `\nNPM Dependencies:\n${depReport}`,
    customBuildCode.length > 10 ? `\nBUILD RULES:\n${customBuildCode}` : "",
    contextStr,
  ].filter(Boolean).join("\n")

  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: `Mode: ${mode}\n\nRequest: ${prompt}\n\nReturn the plan as strict JSON.` },
  ]

  const result = await callModel({
    model: { id: "deepseek-v4-pro", provider: "DeepSeek" },
    messages,
    temperature: 0.2,
  })

  if (!result.ok) {
    throw new ProviderError({
      message: `Planning failed: ${result.message}`,
      status: result.status,
      retryable: result.status >= 500 || result.status === 429,
    })
  }

  const parsed = parsePlanOutput(result.content)
  if (parsed.plan && typeof parsed.plan === "object") {
    return parsed.plan as Record<string, unknown>
  }

  // Fallback to default plan
  return getDefaultPlan()
}

async function callModelForCode(
  plan: Record<string, unknown>,
  fileName: string,
  mode: SyraMode,
  ragContext: ContextPack,
  existingFiles: GeneratedFile[],
  generatedSoFar: GeneratedFile[],
  cheatsheet: string,
  depReport: string,
  customBuildCode: string,
  diagnostics?: Diagnostic[],
): Promise<string | null> {
  const contextStr = buildContextString(ragContext)

  const alreadyGenerated = generatedSoFar.length > 0
    ? "\n\nALREADY GENERATED THIS SESSION:\n" + generatedSoFar.map((f) => `--- ${f.name} ---\n${f.content.slice(0, 300)}...`).join("\n\n")
    : ""

  const diagStr = diagnostics?.length
    ? "\n\nDIAGNOSTICS TO FIX:\n" + diagnostics.map((d) => `  [${d.severity}] ${d.file}: ${d.message}`).join("\n")
    : ""

  const systemContent = [
    SYRA_SYSTEM_PROMPT,
    CODE_GENERATION_PROMPT,
    SHADCN_UI_RULES,
    `\nNPM Dependencies:\n${depReport}`,
    `\nshadcn/ui:\n${cheatsheet}`,
    customBuildCode.length > 10 ? `\nBUILD RULES:\n${customBuildCode}` : "",
    contextStr,
    alreadyGenerated,
    diagStr,
  ].filter(Boolean).join("\n")

  const userContent = [
    `Plan: ${JSON.stringify(plan)}`,
    `Write production code for: ${fileName}`,
    mode === "edit" ? "Preserve unrelated files. Only modify this file." : "",
    `Return as plain source code. No markdown fences. No JSON wrapper.`,
  ].filter(Boolean).join("\n")

  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ]

  const result = await callModel({
    model: { id: "deepseek-v4-pro", provider: "DeepSeek" },
    messages,
    temperature: 0.2,
  })

  if (!result.ok) {
    throw new ProviderError({
      message: `Code generation failed for ${fileName}: ${result.message}`,
      status: result.status,
      retryable: result.status >= 500 || result.status === 429,
    })
  }

  return cleanGeneratedCode(result.content, fileName)
}

async function callModelForRepair(
  prompt: string,
  plan: Record<string, unknown>,
  diagnostics: Diagnostic[],
  allFiles: GeneratedFile[],
  ragContext: ContextPack,
  cheatsheet: string,
): Promise<Array<{ name: string; content: string; usedFor: string }>> {
  const affectedFiles = diagnostics.map((d) => d.file)
  const fileContents = affectedFiles
    .map((name) => {
      const file = allFiles.find((f) => f.name === name)
      return file ? `--- ${file.name} ---\n${file.content}` : null
    })
    .filter(Boolean)
    .join("\n\n")

  const systemContent = [
    SYRA_SYSTEM_PROMPT,
    FIX_PROMPT,
    SHADCN_UI_RULES,
    `\nshadcn/ui:\n${cheatsheet}`,
  ].join("\n")

  const userContent = [
    `Original request: ${prompt}`,
    `Plan: ${JSON.stringify(plan)}`,
    `Diagnostics to fix:`,
    diagnostics.map((d) => `  [${d.severity}] ${d.file}: ${d.message}${d.suggestedFix ? ` (fix: ${d.suggestedFix})` : ""}`).join("\n"),
    `\nAffected file contents:\n${fileContents.slice(0, 10000)}`,
    `Return the repaired files as strict JSON.`,
  ].join("\n")

  const messages: ChatMessage[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ]

  const result = await callModel({
    model: { id: "deepseek-v4-pro", provider: "DeepSeek" },
    messages,
    temperature: 0.1,
  })

  if (!result.ok) {
    console.error("Repair model call failed:", result.message)
    return []
  }

  const parsed = parseRepairOutput(result.content)
  if (!parsed.result) return []

  return parsed.result.upserts.map((u) => ({
    name: u.name,
    content: u.content,
    usedFor: u.usedFor,
  }))
}

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════

function buildContextString(ragContext: ContextPack): string {
  const parts: string[] = []

  parts.push(`\nFULL FILES (${ragContext.fullFiles.length}):`)
  for (const file of ragContext.fullFiles) {
    parts.push(`--- ${file.name} (${file.usedFor || "project file"}) ---`)
    parts.push(file.content.slice(0, 8000))
  }

  if (ragContext.summaryFiles.length > 0) {
    parts.push(`\nFILE SUMMARIES (${ragContext.summaryFiles.length}):`)
    for (const summary of ragContext.summaryFiles) {
      parts.push(`  ${summary.name}: ${summary.summary}`)
    }
  }

  if (ragContext.routeMap.length > 0) {
    parts.push(`\nROUTES:`)
    for (const r of ragContext.routeMap) {
      parts.push(`  ${r.route} -> ${r.file}`)
    }
  }

  return parts.join("\n")
}

function cleanGeneratedCode(content: string, fileName: string): string {
  let cleaned = content.trim()

  // Strip markdown fences
  cleaned = cleaned.replace(/^```[a-zA-Z0-9]*\s*\n?/gm, "")
  cleaned = cleaned.replace(/\n?```\s*$/gm, "")

  // Strip bracket artifact tags
  cleaned = cleaned.replace(/\[\s*\/?\s*(?:code|CODE|file|FILE|usedfor|usedFor|USEDFOR|component|COMPONENT|page|PAGE|name|NAME)\s*\]/gi, "")
  cleaned = cleaned.replace(/^###\s*FILE:.*$/gm, "")

  // Strip leading prose
  cleaned = cleaned.replace(/^(?:Here is|This is|Below is|I have|I've)\s.{0,200}$/gm, "")

  // Strip trailing file path + description patterns
  cleaned = cleaned.replace(/^[a-zA-Z0-9_\/-]+\.(?:tsx?|jsx?|css|json)[\s]+[A-Z][a-z].*$/gm, "")
  cleaned = cleaned.replace(/^[a-zA-Z0-9_\/-]+\.(?:tsx?|jsx?|css|json)\s*$/gm, "")

  return cleaned.trim()
}

function mergeSnapshots(
  existing: GeneratedFile[],
  generated: GeneratedFile[],
  plan: Record<string, unknown>,
  explicitDeletes: string[] = [],
): GeneratedFile[] {
  const fileMap = new Map<string, GeneratedFile>()

  for (const file of existing) {
    fileMap.set(file.name, { ...file })
  }

  for (const file of generated) {
    fileMap.set(file.name, {
      ...file,
      contentHash: computeContentHash(file.content),
      size: file.content.length,
      updatedAt: new Date().toISOString(),
    })
  }

  // Handle moves from plan
  for (const move of (plan.filesToMove as Array<{ from: string; to: string }> ?? [])) {
    if (fileMap.has(move.from)) {
      const existing = fileMap.get(move.from)!
      fileMap.set(move.to, {
        ...existing,
        name: move.to,
        updatedAt: new Date().toISOString(),
      })
      fileMap.delete(move.from)
    }
  }

  // Handle deletes
  for (const del of (plan.filesToDelete as string[] ?? []).concat(explicitDeletes)) {
    fileMap.delete(del)
  }

  return [...fileMap.values()]
}

export { SHADCN_DEP_MAP, buildDependencyReport, loadCheatsheet }
