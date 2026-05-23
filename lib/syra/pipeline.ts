// Syra Pipeline — 4-step execution loop.
// 1. Prompt Check → 2. Manifest Gen → 3. Scaffold → 4. Compile Sections

import type { ModelSelection } from "@/lib/ai-provider"
import { planManifest } from "./planner"
import { validate } from "./schema"
import { compileSection, compileManifest, compileHeader, compileFooter, compileLayoutMap } from "./compiler"
import { validateSyntax, hashContent } from "./syntax-guard"
import { DEFAULT_STEPS } from "./types"
import type { PipelineState, PipelineStep, ManifestAST, ManifestSection, GeneratedFile, GenerationResult, ProgressEvent, ModificationLayer } from "./types"

function initState(): PipelineState {
  return {
    currentStage: "prompt-check",
    steps: DEFAULT_STEPS.map((s) => ({ ...s })),
    overallProgress: 0,
    detail: "Starting Syra Engine...",
    warnings: [],
    errors: [],
  }
}

function markStep(state: PipelineState, stage: PipelineState["currentStage"], status: PipelineStep["status"], detail: string, emit: (e: ProgressEvent) => void) {
  state.currentStage = stage
  const step = state.steps.find((s) => s.stage === stage)
  if (step) { step.status = status }
  const done = state.steps.filter((s) => s.status === "done").length + (status === "done" ? 1 : 0)
  state.overallProgress = Math.round((done / state.steps.length) * 100)
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

  // ── Step 1: Prompt Management ─────────────────────────────
  markStep(state, "prompt-check", "running", "Analyzing prompt...", emit)

  if (!prompt || prompt.trim().length < 3) {
    state.errors.push("Prompt too short")
    markStep(state, "error", "error", "Prompt must be at least 3 characters", emit)
    return fail(state, "Prompt too short")
  }

  const lowInfo = prompt.trim().split(/\s+/).length < 5
  if (lowInfo) {
    // Pause: ask clarifying question
    markStep(state, "prompt-check", "done", "Need more details", emit)
    emit({ type: "clarify", clarifyQuestion: "Could you tell me more about your site? (purpose, style, pages needed, colors)" })
    return fail(state, "Insufficient prompt details")
  }

  markStep(state, "prompt-check", "done", "Prompt analysis complete", emit)

  // ── Step 2: Manifest Generation ───────────────────────────
  markStep(state, "manifest-gen", "running", "Generating layout manifest via AI...", emit)
  const plan = await planManifest(prompt, options.model)
  if (!plan.manifest) {
    state.errors.push(plan.error || "Manifest gen failed")
    markStep(state, "manifest-gen", "error", `Failed: ${plan.error}`, emit)
    return fail(state, plan.error || "Generation failed")
  }
  const manifest = plan.manifest
  emit({ type: "manifest", manifest })

  const v = validate(manifest)
  if (!v.ok) state.warnings.push(...v.errors)

  markStep(state, "manifest-gen", "done", `${manifest.pages.length} pages, ${manifest.pages.reduce((acc, p) => acc + p.layout.sections.length, 0)} sections`, emit)

  // ── Step 3: Scaffold ─────────────────────────────────────
  markStep(state, "scaffold", "running", "Calculating file structure...", emit)
  const allSections: { section: ManifestSection; projectId: string }[] = []
  for (const page of manifest.pages) {
    for (const section of page.layout.sections) {
      allSections.push({ section, projectId: manifest.siteMetadata.projectId })
    }
  }

  const scaffolded: GeneratedFile[] = []
  scaffolded.push(compileLayoutMap(manifest))
  const needHeader = manifest.pages.some((p) => p.layout.headerEnabled)
  const needFooter = manifest.pages.some((p) => p.layout.footerEnabled)
  if (needHeader) scaffolded.push(compileHeader(manifest))
  if (needFooter) scaffolded.push(compileFooter(manifest))

  markStep(state, "scaffold", "done", `${scaffolded.length} scaffold files, ${allSections.length} sections to compile`, emit)

  // ── Step 4: Compile Sections (Parallel sim.) ─────────────
  markStep(state, "compile-sections", "running", `Compiling ${allSections.length} sections...`, emit)

  const compiledFiles: GeneratedFile[] = [...scaffolded]
  let compiledCount = 0

  for (let i = 0; i < allSections.length; i++) {
    const { section, projectId } = allSections[i]
    try {
      const file = compileSection(section, projectId)
      const check = validateSyntax(file.content, section.sectionId)
      if (!check.ok) state.warnings.push(...check.errors)
      file.hash = hashContent(file.content)
      compiledFiles.push(file)
      compiledCount++
      emit({ type: "section", sectionId: section.sectionId, sectionIndex: i, sectionsTotal: allSections.length, detail: `Compiled ${section.sectionId}` })
    } catch (err) {
      state.warnings.push(`Failed ${section.sectionId}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  // Compile pages
  for (const page of manifest.pages) {
    try {
      compiledFiles.push(compilePage(page, manifest))
    } catch {}
  }

  markStep(state, "compile-sections", "done", `${compiledCount} sections compiled`, emit)

  const result: GenerationResult = {
    projectId: manifest.siteMetadata.projectId,
    manifest,
    files: compiledFiles,
    sectionsBuilt: compiledCount,
    sectionsTotal: allSections.length,
    pipelineState: state,
  }

  emit({ type: "complete", progress: 100, manifest, files: compiledFiles, sectionsTotal: allSections.length })
  return { result, events }
}

function fail(state: PipelineState, error: string) {
  return {
    result: {
      projectId: "error",
      manifest: null as unknown as ManifestAST,
      files: [],
      sectionsBuilt: 0,
      sectionsTotal: 0,
      pipelineState: state,
    },
    events: [{ type: "error" as const, error }],
  }
}
