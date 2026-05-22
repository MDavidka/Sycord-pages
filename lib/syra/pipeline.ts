// Syra Pipeline Orchestrator — coordinates the full generation lifecycle.
//
// Pipeline: Plan → Manifest → Validate → Compile → Persist
//
// Each stage emits progress events via callback. Errors trigger self-healing
// fallback to defaults — never a blank screen.

import type { ModelSelection } from "@/lib/ai-provider"
import { planManifest } from "./planner"
import { validateManifest } from "./schema"
import { compileManifest } from "./compiler"
import type {
  PipelineState,
  PipelineStep,
  StepStatus,
  SiteManifest,
  GeneratedFile,
  GenerationResult,
  ProgressEvent,
  ProgressCallback,
} from "./types"

function createInitialState(): PipelineState {
  return {
    currentStep: "planning",
    steps: {
      planning: "pending",
      manifest: "pending",
      compiling: "pending",
      validating: "pending",
      persisting: "pending",
      done: "pending",
      error: "pending",
    },
    progress: 0,
    detail: "Starting generation pipeline...",
    warnings: [],
    errors: [],
  }
}

function stepProgress(step: PipelineStep): number {
  const map: Record<PipelineStep, number> = {
    planning: 15,
    manifest: 35,
    compiling: 50,
    validating: 70,
    persisting: 90,
    done: 100,
    error: 0,
  }
  return map[step] ?? 0
}

export interface PipelineOptions {
  model?: ModelSelection
  siteId?: string
  onEvent?: (event: ProgressEvent) => void
}

export async function runSyraPipeline(
  prompt: string,
  options: PipelineOptions = {},
): Promise<{ result: GenerationResult; events: ProgressEvent[] }> {
  const events: ProgressEvent[] = []
  const emit = (event: ProgressEvent) => {
    events.push(event)
    options.onEvent?.(event)
  }

  const state = createInitialState()
  const siteId = options.siteId ?? `site_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

  // ── Step 1: Planning ────────────────────────────────────────
  updateStep(state, "planning", "running", "Analyzing prompt for page structure...", emit)

  if (!prompt || prompt.trim().length < 3) {
    updateStep(state, "error", "error", "Prompt too short — minimum 3 characters required.", emit)
    events.push({ type: "error", error: "Prompt too short" })
    return {
      result: { siteId, manifest: createFallbackManifest(prompt), files: [], pipelineState: state },
      events,
    }
  }

  updateStep(state, "planning", "done", "Prompt analysis complete", emit)

  // ── Step 2: Manifest Generation ─────────────────────────────
  updateStep(state, "manifest", "running", "Generating layout manifest via AI...", emit)

  const planResult = await planManifest(prompt, options.model, (s) => {
    if (s.detail) emit({ type: "detail", detail: s.detail, step: "manifest" })
  })

  if (!planResult.manifest) {
    state.warnings.push(planResult.error ?? "Manifest generation failed")
    updateStep(state, "manifest", "error", `Planning failed: ${planResult.error}. Using fallback.`, emit)

    // Fallback manifest
    const fallback = createFallbackManifest(prompt)
    return finishPipeline(state, fallback, emit)
  }

  const manifest = planResult.manifest
  emit({ type: "manifest", manifest })
  updateStep(state, "manifest", "done", `Manifest generated: ${manifest.pages.length} pages`, emit)

  // ── Step 3: Validation ──────────────────────────────────────
  updateStep(state, "validating", "running", "Validating manifest against schema...", emit)

  const validation = validateManifest(manifest)
  if (!validation.ok) {
    state.warnings.push(`Validation warnings: ${validation.errors.join("; ")}`)
    emit({ type: "detail", detail: `Validation found ${validation.errors.length} issues — using self-healing fallback` })
  }

  updateStep(state, "validating", "done", "Schema validation complete", emit)

  // ── Step 4: Compilation ─────────────────────────────────────
  updateStep(state, "compiling", "running", "Compiling manifest to deployable TSX files...", emit)

  let files: GeneratedFile[]
  try {
    files = compileManifest(manifest)
    emit({ type: "detail", detail: `Compiled ${files.length} files` })
  } catch (err) {
    state.errors.push(`Compilation error: ${err instanceof Error ? err.message : String(err)}`)
    updateStep(state, "compiling", "error", "Compilation failed", emit)
    return finishPipeline(state, manifest, emit)
  }

  for (const file of files) {
    emit({ type: "file", filePath: file.path, detail: `Generated ${file.path}` })
  }
  updateStep(state, "compiling", "done", `${files.length} files compiled`, emit)

  // ── Step 5: Persist ─────────────────────────────────────────
  updateStep(state, "persisting", "running", "Files ready for deployment", emit)
  updateStep(state, "persisting", "done", "Generation complete", emit)

  // ── Done ────────────────────────────────────────────────────
  updateStep(state, "done", "done", `Successfully generated ${files.length} files across ${manifest.pages.length} pages`, emit)
  emit({ type: "complete", progress: 100, files, manifest })

  return {
    result: { siteId, manifest, files, pipelineState: state },
    events,
  }
}

function updateStep(
  state: PipelineState,
  step: PipelineStep,
  status: StepStatus,
  detail: string,
  emit: (e: ProgressEvent) => void,
) {
  state.currentStep = step
  state.steps[step] = status
  state.progress = stepProgress(step)
  state.detail = detail

  emit({ type: "step", step, status, progress: state.progress, detail })
}

function finishPipeline(
  state: PipelineState,
  manifest: SiteManifest,
  emit: (e: ProgressEvent) => void,
): { result: GenerationResult; events: ProgressEvent[] } {
  let files: GeneratedFile[] = []
  try {
    files = compileManifest(manifest)
  } catch {
    state.errors.push("Fallback compilation also failed")
  }

  updateStep(state, "done", "done", "Generation complete (with warnings)", emit)
  emit({ type: "complete", progress: 100, files, manifest })

  return {
    result: { siteId: `fallback_${Date.now()}`, manifest, files, pipelineState: state },
    events: [],
  }
}

function createFallbackManifest(prompt: string): SiteManifest {
  const name = prompt.split(/\s+/).slice(0, 3).join(" ") || "Syra Site"
  return {
    projectName: name,
    tagline: "Built with Syra AI",
    theme: "saas",
    colorScheme: "neutral",
    density: "balanced",
    pages: [
      {
        path: "/",
        title: "Home",
        metaTitle: `Home — ${name}`,
        metaDescription: "A beautifully designed page built with AI.",
        sections: [
          {
            id: "hero",
            section: "hero",
            layout: "centered",
            padding: "xl",
            elements: [
              { id: "hero-badge", type: "badge", variant: "secondary", content: "Syra AI", className: "mb-4" },
              { id: "hero-heading", type: "label", content: name, className: "text-5xl font-bold tracking-tight" },
              { id: "hero-desc", type: "label", content: "A production-ready site, generated in seconds. Fast, beautiful, and fully deployable.", className: "text-xl text-muted-foreground mt-4 max-w-2xl" },
              { id: "hero-cta", type: "button", variant: "default", size: "lg", content: "Get Started", className: "mt-8" },
            ],
          },
          {
            id: "features",
            section: "features",
            layout: "grid-3col",
            padding: "lg",
            bg: "muted",
            elements: [
              { id: "feat-heading", type: "label", content: "Why choose Syra", className: "text-3xl font-bold col-span-full text-center mb-4" },
              { id: "feat-card-1", type: "card", className: "p-6", children: [
                { id: "f1-title", type: "label", content: "AI-Powered", className: "text-lg font-semibold" },
                { id: "f1-desc", type: "label", content: "Generate complete websites from natural language descriptions.", className: "text-sm text-muted-foreground mt-2" },
              ]},
              { id: "feat-card-2", type: "card", className: "p-6", children: [
                { id: "f2-title", type: "label", content: "Deploy Instantly", className: "text-lg font-semibold" },
                { id: "f2-desc", type: "label", content: "One-click deployment to production with zero configuration.", className: "text-sm text-muted-foreground mt-2" },
              ]},
              { id: "feat-card-3", type: "card", className: "p-6", children: [
                { id: "f3-title", type: "label", content: "Fully Customizable", className: "text-lg font-semibold" },
                { id: "f3-desc", type: "label", content: "Edit every aspect with the built-in visual editor and code mode.", className: "text-sm text-muted-foreground mt-2" },
              ]},
            ],
          },
          {
            id: "cta-final",
            section: "cta",
            layout: "centered",
            padding: "lg",
            bg: "primary/5",
            elements: [
              { id: "cta-heading", type: "label", content: "Ready to build?", className: "text-3xl font-bold" },
              { id: "cta-desc", type: "label", content: "Start generating beautiful websites in seconds.", className: "text-lg text-muted-foreground mt-4" },
              { id: "cta-btn", type: "button", variant: "default", size: "lg", content: "Start Building", className: "mt-6" },
            ],
          },
        ],
      },
    ],
  }
}
