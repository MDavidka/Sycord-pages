import { callModel, type ChatMessage } from "@/lib/ai-provider"
import { getSystemPrompts } from "@/lib/ai-prompts"
import type {
  SyraPipelineInput,
  SyraPipelineResult,
  Intent,
  GeneratedFile,
  ProjectMemory,
  BuildHistoryEntry,
  BuildPlan,
  ModelSelection,
} from "@/lib/ai/types"
import { BuildPlanSchema } from "@/lib/ai/types"
import { loadProjectForUser, saveGeneratedSnapshot, saveBuildHistory, saveAiMemory, saveBuildError } from "@/lib/ai/project-store"
import { getSyraPrompt } from "@/lib/ai/prompt-templates"
import { parseSyraOutput } from "@/lib/ai/output-parser"
import { validateFiles } from "@/lib/ai/validators"
import { validatePath, normalizePath } from "@/lib/ai/path-safety"
import { buildProjectMemory, contentHash, getSmartContext, NEXTJS_CORE_FILES } from "@/lib/ai/memory"
import { promptCache, cheatsheetCache, cacheKey, sha256, redactSensitive } from "@/lib/ai/cache"
import { readFileSync, existsSync } from "fs"
import { join } from "path"

const SHADCN_DEP_MAP: Record<string, string[]> = {
  accordion: ["@radix-ui/react-accordion"], "alert-dialog": ["@radix-ui/react-alert-dialog"], alert: [],
  "aspect-ratio": ["@radix-ui/react-aspect-ratio"], avatar: ["@radix-ui/react-avatar"], badge: [], breadcrumb: [],
  button: ["@radix-ui/react-slot", "class-variance-authority"], calendar: ["react-day-picker", "date-fns"], card: [],
  carousel: ["embla-carousel-react"], chart: ["recharts"], checkbox: ["@radix-ui/react-checkbox"],
  collapsible: ["@radix-ui/react-collapsible"], combobox: ["cmdk", "@radix-ui/react-popover"], command: ["cmdk"],
  "context-menu": ["@radix-ui/react-context-menu"], "data-table": [], "date-picker": ["react-day-picker", "date-fns", "@radix-ui/react-popover"],
  dialog: ["@radix-ui/react-dialog"], drawer: ["vaul"], "dropdown-menu": ["@radix-ui/react-dropdown-menu"],
  empty: [], field: [], form: ["react-hook-form", "@hookform/resolvers", "zod"],
  "hover-card": ["@radix-ui/react-hover-card"], input: [], "input-group": [], "input-otp": ["input-otp"], item: [], kbd: [],
  label: ["@radix-ui/react-label"], menubar: ["@radix-ui/react-menubar"],
  "navigation-menu": ["@radix-ui/react-navigation-menu"], pagination: [], popover: ["@radix-ui/react-popover"],
  progress: ["@radix-ui/react-progress"], "radio-group": ["@radix-ui/react-radio-group"],
  resizable: ["react-resizable-panels"], "scroll-area": ["@radix-ui/react-scroll-area"], select: ["@radix-ui/react-select"],
  separator: ["@radix-ui/react-separator"], sheet: ["@radix-ui/react-dialog"], sidebar: [], skeleton: [],
  slider: ["@radix-ui/react-slider"], sonner: ["sonner"], spinner: [], switch: ["@radix-ui/react-switch"], table: [],
  tabs: ["@radix-ui/react-tabs"], textarea: [], toast: ["@radix-ui/react-toast"], toggle: ["@radix-ui/react-toggle"],
  "toggle-group": ["@radix-ui/react-toggle-group"], tooltip: ["@radix-ui/react-tooltip"], typography: [],
}

function loadCheatsheet(): string {
  const cached = cheatsheetCache.get("cheatsheet")
  if (cached) return cached
  try {
    const p = join(process.cwd(), "components.json")
    if (!existsSync(p)) return "No cheatsheet"
    const d = JSON.parse(readFileSync(p, "utf-8"))
    if (!d?.components) return "No cheatsheet"
    const text = (d.components as Array<{ slug: string; name: string; import_path: string; exports: string[]; purpose: string }>).map(c => {
      const deps = SHADCN_DEP_MAP[c.slug] ?? []
      const dd = deps.length ? `\n  npm: ${deps.join(", ")}` : "  npm: none"
      return [`${c.name} (${c.slug})`, `  import { ${(c.exports || []).join(", ")} } from "${c.import_path}"`, `  ${c.purpose}`, dd].filter(Boolean).join("\n")
    }).join("\n\n")
    cheatsheetCache.set("cheatsheet", text, 10 * 60 * 1000)
    return text
  } catch { return "No cheatsheet" }
}

function buildDependencyReport(): string {
  return Object.entries(SHADCN_DEP_MAP).filter(([, v]) => v.length > 0).map(([k, v]) => `  ${k} → ${v.join(", ")}`).join("\n")
}

function classifyIntent(existingPages: Array<{ name: string }>, requestedMode?: Intent, _prompt?: string): Intent {
  if (requestedMode === "generate" && existingPages.length === 0) return "generate"
  if (requestedMode === "fix") return "fix"
  if (existingPages.length === 0) return "generate"
  if (requestedMode === "generate") return "generate"
  return "edit"
}

function buildContextForIntent(
  intent: Intent,
  pages: Array<{ name: string; content: string; usedFor: string }>,
  prompt: string,
  aiMemory: ProjectMemory | null,
  lastBuildError: string | null,
  lastDeployError: string | null,
): string {
  const pageFiles = pages.map(p => ({ name: p.name, content: p.content, usedFor: p.usedFor, action: "upsert" as const }))
  if (intent === "generate") {
    return "Starting a new Next.js App Router project."
  }
  if (intent === "edit") {
    return getSmartContext(pageFiles, prompt)
  }
  // fix
  let context = "Fixing errors in the project.\n"
  if (lastBuildError) context += `\nLast build error:\n${lastBuildError}\n`
  if (lastDeployError) context += `\nLast deploy error:\n${lastDeployError}\n`
  context += "\n" + getSmartContext(pageFiles, prompt)
  return context
}

async function runPlanning(
  prompt: string,
  intent: Intent,
  model: ModelSelection,
  context: string,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<BuildPlan | null> {
  const cacheKeyStr = cacheKey("plan", sha256(prompt + intent + model.id), model.id)
    const cached = promptCache.get(cacheKeyStr) as BuildPlan | undefined as BuildPlan | undefined
  if (cached) {
    onEvent("cache", { type: "plan", hit: true })
    try { return BuildPlanSchema.parse(cached) } catch { /* regenerate */ }
  }
  const systemPrompt = getSyraPrompt("plan")
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: `Context: ${context}\n\nUser request: ${prompt}\n\nCreate a build plan.` },
  ]
  const result = await callModel({ model, messages, temperature: 0.3, signal })
  if (!result.ok) {
    onEvent("error", { stage: "planning", message: result.message })
    return null
  }
  try {
    const parsed = BuildPlanSchema.parse(JSON.parse(result.content))
    promptCache.set(cacheKeyStr, parsed, 30 * 60 * 1000)
    return parsed
  } catch {
    return null
  }
}

async function runCodeGeneration(
  prompt: string,
  intent: Intent,
  model: ModelSelection,
  context: string,
  existingPages: Array<{ name: string; content: string; usedFor: string }>,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<GeneratedFile[]> {
  const systemPrompt = getSyraPrompt("code")
  let userContent = `Context: ${context}\n\nUser request: ${prompt}\n`
  if (intent !== "generate" && existingPages.length > 0) {
    userContent += "\n\nEXISTING FILES:\n"
    for (const f of existingPages) {
      userContent += `\n--- ${f.name} (${f.usedFor || "unknown"}) ---\n${f.content}\n`
    }
  }
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userContent },
  ]
  const result = await callModel({ model, messages, temperature: 0.2, signal })
  if (!result.ok) {
    onEvent("error", { stage: "generation", message: result.message })
    return []
  }
  const parsed = parseSyraOutput(result.content)
  const files: GeneratedFile[] = []
  for (const f of parsed.files) {
    const normalizedName = normalizePath(f.name)
    const pathError = validatePath(normalizedName)
    if (pathError) {
      onEvent("diagnostic", { file: f.name, type: "path-safety", message: pathError, severity: "error" })
      continue
    }
    if (f.action === "upsert" && f.content) {
      files.push({ name: normalizedName, content: f.content, usedFor: f.usedFor, action: "upsert" })
      onEvent("file", { name: normalizedName, action: "upsert", size: f.content.length })
    }
  }
  for (const name of parsed.deleteFiles) {
    files.push({ name: normalizePath(name), content: "", usedFor: "deleted", action: "delete" })
    onEvent("file", { name, action: "delete" })
  }
  return files
}

async function runRepair(
  diagnostics: Array<{ file: string; type: string; message: string; severity: string }>,
  affectedFiles: GeneratedFile[],
  model: ModelSelection,
  context: string,
  onEvent: (event: string, data: Record<string, unknown>) => void,
  signal?: AbortSignal,
): Promise<GeneratedFile[]> {
  const diagText = diagnostics.map(d => `${d.file}: [${d.type}] ${d.message}`).join("\n")
  const fixPrompt = getSyraPrompt("fix").replace("{DIAGNOSTICS}", diagText)
  let userContent = `Context: ${context}\n\nDiagnostics:\n${diagText}\n`
  for (const f of affectedFiles) {
    userContent += `\n--- ${f.name} (current content) ---\n${f.content}\n`
  }
  const messages: ChatMessage[] = [
    { role: "system", content: fixPrompt },
    { role: "user", content: userContent },
  ]
  const result = await callModel({ model, messages, temperature: 0.1, signal })
  if (!result.ok) {
    onEvent("error", { stage: "repair", message: result.message })
    return []
  }
  const parsed = parseSyraOutput(result.content)
  return parsed.files.filter(f => f.action === "upsert" && f.content).map(f => ({
    name: normalizePath(f.name),
    content: f.content,
    usedFor: f.usedFor,
    action: "upsert" as const,
  }))
}

export async function runSyraPipeline(input: SyraPipelineInput): Promise<SyraPipelineResult> {
  const { userId, projectId, prompt, model, requestedMode, temperature, maxRepairPasses = 2, onEvent, signal } = input
  const startTime = Date.now()
  const diagnostics: string[] = []
  let cacheHits = 0
  let repairPasses = 0

  onEvent("stage", { stage: "loading", status: "running", message: "Loading project..." })

  const projectData = await loadProjectForUser(userId, projectId)
  const intent = classifyIntent(projectData.pages, requestedMode, prompt)

  onEvent("stage", { stage: "classification", status: "done", message: `Intent: ${intent}` })

  onEvent("stage", { stage: "memory", status: "running", message: "Building project context..." })

  const context = buildContextForIntent(
    intent,
    projectData.pages,
    prompt,
    projectData.aiMemory,
    projectData.lastBuildError,
    projectData.lastDeployError,
  )

  if (projectData.aiMemory) {
    cacheHits++
    onEvent("memory", { revision: projectData.aiMemory.revision, files: projectData.aiMemory.files.length, cacheHit: true })
  }

  onEvent("stage", { stage: "planning", status: "running", message: "Creating project plan..." })

  const plan = await runPlanning(prompt, intent, model, context, onEvent, signal)
  if (plan) {
    onEvent("plan", { intent: plan.intent, summary: plan.summary, files: plan.files.length })
    cacheHits++
  }

  onEvent("stage", { stage: "generating", status: "running", message: `Generating code (${intent} mode)...` })

  let generatedFiles = await runCodeGeneration(
    prompt, intent, model, context,
    projectData.pages.map(p => ({ name: p.name, content: p.content, usedFor: p.usedFor })),
    onEvent, signal,
  )

  // Validation + repair loop
  let allErrors = validateFiles(generatedFiles)
  while (allErrors.length > 0 && repairPasses < maxRepairPasses) {
    repairPasses++
    onEvent("repair", { pass: repairPasses, errors: allErrors.length })
    for (const err of allErrors) {
      onEvent("diagnostic", { file: err.file, type: err.type, message: err.message, severity: err.severity })
      diagnostics.push(`${err.file}: ${err.message}`)
    }
    const affectedFileNames = new Set(allErrors.map(e => e.file))
    const affectedFiles = generatedFiles.filter(f => affectedFileNames.has(f.name))
    const repairedFiles = await runRepair(
      allErrors.map(e => ({ file: e.file, type: e.type, message: e.message, severity: e.severity })),
      affectedFiles,
      model, context, onEvent, signal,
    )
    for (const repaired of repairedFiles) {
      const idx = generatedFiles.findIndex(f => f.name === repaired.name)
      if (idx >= 0) generatedFiles[idx] = repaired
      else generatedFiles.push(repaired)
    }
    allErrors = validateFiles(generatedFiles)
  }

  if (allErrors.length > 0) {
    for (const err of allErrors) {
      onEvent("diagnostic", { file: err.file, type: err.type, message: err.message, severity: err.severity })
      diagnostics.push(`${err.file}: ${err.message}`)
    }
  }

  onEvent("stage", { stage: "saving", status: "running", message: `Saving ${generatedFiles.length} files...` })

  const cheatsheet = loadCheatsheet()
  const depReport = buildDependencyReport()

  const savedResult = await saveGeneratedSnapshot(userId, projectId, {
    files: generatedFiles,
    mode: intent,
    prompt,
    model: model.id,
    provider: model.provider,
    duration: Date.now() - startTime,
    diagnostics,
    cacheHits,
    repairPasses,
  })

  const status = allErrors.length > 0 ? "partial" : "success"
  const buildHistoryEntry: BuildHistoryEntry = {
    prompt,
    mode: intent,
    model: model.id,
    provider: model.provider,
    timestamp: Date.now(),
    duration: Date.now() - startTime,
    files: generatedFiles.map(f => f.name),
    changedFiles: generatedFiles.filter(f => f.action === "upsert").map(f => f.name),
    status,
    diagnostics,
    cacheHits,
    errors: allErrors.map(e => e.message),
    steps: [],
  }

  await saveBuildHistory(userId, projectId, buildHistoryEntry)

  const memory = buildProjectMemory(
    generatedFiles,
    projectData.revisionHash,
    status === "success" ? prompt : null,
    [prompt],
    diagnostics,
  )
  await saveAiMemory(userId, projectId, memory)

  if (status !== "success") {
    await saveBuildError(userId, projectId, diagnostics.join("\n"))
  }

  onEvent("saved", { files: savedResult.pages.length, status })
  onEvent("done", { status, files: savedResult.pages.length, duration: Date.now() - startTime })

  return {
    pages: savedResult.pages,
    buildHistory: buildHistoryEntry,
    memory,
    diagnostics,
    cacheHits,
    repairPasses,
  }
}
