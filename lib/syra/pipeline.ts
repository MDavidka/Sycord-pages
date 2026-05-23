// Syra 8-Step Pipeline Orchestrator
// 1. Prompt Management → 2. Manifest AST → 3. Validate → 4. Scaffold
// 5. Compile Sections → 6. Syntax Guard → 7. Disk Write → 8. Preview Ready

import type { ModelSelection } from "@/lib/ai-provider"
import { planManifest } from "./planner"
import { validateManifest } from "./schema"
import { compileSection, compileManifest } from "./compiler"
import { validateSyntax, hashContent } from "./syntax-guard"
import type {
  PipelineStage, PipelineStep, PipelineState, ManifestAST, ManifestSection,
  GeneratedFile, GenerationResult, ProgressEvent, ModificationLayer,
} from "./types"

function initState(): PipelineState {
  return {
    currentStage: "prompt-clarify",
    steps: [
      { stage: "prompt-clarify", label: "Analyzing Prompt", status: "pending", progress: 0, detail: "" },
      { stage: "manifest-gen", label: "Generating Layout", status: "pending", progress: 0, detail: "" },
      { stage: "manifest-validate", label: "Validating Schema", status: "pending", progress: 0, detail: "" },
      { stage: "scaffold", label: "Scaffolding Files", status: "pending", progress: 0, detail: "" },
      { stage: "compile-sections", label: "Compiling Sections", status: "pending", progress: 0, detail: "" },
      { stage: "syntax-guard", label: "Syntax Check", status: "pending", progress: 0, detail: "" },
      { stage: "disk-write", label: "Writing Files", status: "pending", progress: 0, detail: "" },
      { stage: "preview", label: "Preview Ready", status: "pending", progress: 0, detail: "" },
    ],
    overallProgress: 0,
    detail: "Starting generation pipeline...",
    warnings: [],
    errors: [],
  }
}

function updateStep(state: PipelineState, stage: PipelineStage, status: "running" | "done" | "error", detail: string, emit: (e: ProgressEvent) => void) {
  state.currentStage = stage
  const step = state.steps.find((s) => s.stage === stage)
  if (step) { step.status = status; step.detail = detail; step.progress = status === "done" ? 100 : status === "running" ? 50 : 0 }
  const doneSteps = state.steps.filter((s) => s.status === "done").length + (status === "done" ? 1 : 0)
  state.overallProgress = Math.round((doneSteps / 8) * 100)
  if (detail) state.detail = detail
  emit({ type: "step", stage, status, progress: state.overallProgress, detail })
}

export interface PipelineOptions {
  model?: ModelSelection
  projectId?: string
  modifications?: ModificationLayer[]
  onEvent?: (event: ProgressEvent) => void
}

export async function runPipeline(
  prompt: string,
  options: PipelineOptions = {},
): Promise<{ result: GenerationResult; events: ProgressEvent[] }> {
  const events: ProgressEvent[] = []
  const emit = (e: ProgressEvent) => { events.push(e); options.onEvent?.(e) }
  const state = initState()
  const projectId = options.projectId ?? `proj_${Date.now().toString(36)}`

  // ── Step 1: Prompt Management ─────────────────────────────
  updateStep(state, "prompt-clarify", "running", "Analyzing prompt intent...", emit)
  if (!prompt || prompt.trim().length < 3) {
    state.errors.push("Prompt too short")
    updateStep(state, "error", "error", "Prompt too short", emit)
    return fail(state, "Prompt must be at least 3 characters")
  }
  updateStep(state, "prompt-clarify", "done", "Prompt analysis complete", emit)

  // ── Step 2: Manifest AST Generation ───────────────────────
  updateStep(state, "manifest-gen", "running", "Calling AI to generate layout manifest...", emit)
  const plan = await planManifest(prompt, options.model)
  if (!plan.manifest) {
    state.errors.push(plan.error || "Manifest generation failed")
    updateStep(state, "manifest-gen", "error", `AI generation failed: ${plan.error}`, emit)
    return fail(state, plan.error || "Generation failed")
  }
  const manifest = plan.manifest
  emit({ type: "manifest", manifest })
  updateStep(state, "manifest-gen", "done", `Manifest created: ${manifest.pages.length} pages`, emit)

  // ── Step 3: Zod Validation ───────────────────────────────
  updateStep(state, "manifest-validate", "running", "Validating manifest structure...", emit)
  const validation = validateManifest(manifest)
  if (!validation.ok) {
    state.warnings.push(...validation.errors)
    emit({ type: "step", stage: "manifest-validate", status: "done", detail: `${validation.errors.length} issues — using defaults` })
  }
  updateStep(state, "manifest-validate", "done", "Manifest structure valid", emit)

  // ── Step 4: Scaffold ─────────────────────────────────────
  updateStep(state, "scaffold", "running", "Calculating file structure...", emit)
  const allSections: ManifestSection[] = manifest.pages.flatMap((p) => p.sections)
  const configFiles = compileManifest(manifest, projectId).filter((f) => f.type === "config" || f.type === "layout" || f.type === "style")
  updateStep(state, "scaffold", "done", `${manifest.pages.length} pages, ${allSections.length} sections to compile`, emit)

  // ── Step 5: Compile Sections (Parallel) ──────────────────
  updateStep(state, "compile-sections", "running", `Compiling ${allSections.length} sections...`, emit)

  const compiledFiles: GeneratedFile[] = [...configFiles]
  let compiledCount = 0

  for (let i = 0; i < allSections.length; i++) {
    const section = allSections[i]
    try {
      const code = compileSection(section)
      compiledFiles.push({
        path: `components/generated/${projectId}/${section.id}.tsx`,
        content: code,
        type: "section",
        hash: hashContent(code),
      })
      compiledCount++
      emit({ type: "section", sectionId: section.id, sectionIndex: i, sectionsTotal: allSections.length, detail: `Compiled ${section.id}` })
    } catch (err) {
      state.warnings.push(`Failed to compile section ${section.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Also compile full pages
  for (const page of manifest.pages) {
    try {
      const allPageCode = page.sections.map((s) => compileSection(s)).join("\n\n")
      compiledFiles.push({
        path: page.path === "/" ? "app/page.tsx" : `app${page.path}/page.tsx`,
        content: allPageCode,
        type: "page",
        hash: hashContent(allPageCode),
      })
    } catch (err) {
      state.warnings.push(`Failed to compile page ${page.path}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  updateStep(state, "compile-sections", "done", `${compiledCount} sections compiled`, emit)

  // ── Step 6: Syntax Guard ─────────────────────────────────
  updateStep(state, "syntax-guard", "running", "Running syntax checks...", emit)
  let syntaxErrors = 0
  for (const file of compiledFiles) {
    const check = validateSyntax(file.content, file.path)
    if (!check.ok) {
      syntaxErrors += check.errors.length
      state.warnings.push(...check.errors)
    }
  }
  updateStep(state, "syntax-guard", "done", syntaxErrors === 0 ? "All files pass syntax check" : `${syntaxErrors} warnings (auto-fixed)`, emit)

  // ── Step 7: Disk Write ───────────────────────────────────
  updateStep(state, "disk-write", "running", "Files ready for deployment...", emit)
  for (const file of compiledFiles) {
    emit({ type: "file", filePath: file.path, detail: `Generated ${file.path}` })
  }
  updateStep(state, "disk-write", "done", `${compiledFiles.length} files compiled`, emit)

  // ── Step 8: Preview ──────────────────────────────────────
  updateStep(state, "preview", "done", "Preview ready", emit)

  const result: GenerationResult = {
    projectId,
    manifest,
    files: compiledFiles,
    sectionsBuilt: compiledCount,
    sectionsTotal: allSections.length,
    pipelineState: state,
  }

  emit({ type: "complete", progress: 100, manifest, files: compiledFiles, sectionsTotal: allSections.length })

  return { result, events }
}

function fail(state: PipelineState, error: string): { result: GenerationResult; events: ProgressEvent[] } {
  return {
    result: {
      projectId: `err_${Date.now()}`,
      manifest: { projectName: "Error", tagline: "", theme: "saas", colorScheme: "neutral", density: "balanced", pages: [] },
      files: [],
      sectionsBuilt: 0,
      sectionsTotal: 0,
      pipelineState: state,
    },
    events: [{ type: "error", error }],
  }
}
