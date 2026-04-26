// ── Pipeline Orchestrator ────────────────────────────────────────────
// Runs all 14 pipeline steps in order, emitting events for the frontend.

import type {
  PipelineEvent,
  ModelSelection,
  GeneratedProject,
  GeneratedFile,
  ValidationResult,
} from "./types"

import { runIntakeStep } from "./intake"
import { runPlanningStep } from "./planning"
import { buildProjectManifest } from "./manifest"
import { runDesignSystemStep } from "./design-system"
import { runScaffoldStep } from "./scaffold"
import { runPageJsonGenerationStep } from "./page-json"
import { validatePageJson } from "./json-validation"
import { convertJsonToNextPage } from "./converter"
import { runLogicGenerationStep } from "./logic-generation"
import { assembleGeneratedProject } from "./assembly"
import { runBuildValidation } from "./build-validation"
import { runAutoFixStep } from "./autofix"
import { runPreviewStep } from "./preview"
import { runExportStep } from "./export"

export type EventEmitter = (event: PipelineEvent) => void

function emit(emitter: EventEmitter, event: Partial<PipelineEvent>) {
  emitter({ timestamp: Date.now(), type: "phase", ...event } as PipelineEvent)
}

export async function runPipeline(
  prompt: string,
  model: ModelSelection,
  emitter: EventEmitter,
): Promise<GeneratedProject> {
  // ── 1. Intake ─────────────────────────────────────────────────
  emit(emitter, { type: "phase", phase: "intake", message: "Understanding your website brief..." })
  const brief = runIntakeStep(prompt)
  emit(emitter, {
    type: "phase",
    phase: "intake",
    message: `Detected: ${brief.siteType}, pages: ${brief.requestedPages.join(", ")}`,
  })

  // ── 2. Planning ───────────────────────────────────────────────
  emit(emitter, { type: "phase", phase: "planning", message: "Planning your multi-page site..." })
  const plan = await runPlanningStep(brief, model)
  emit(emitter, {
    type: "plan",
    plan,
    manifestSummary: `${plan.length} pages planned`,
    message: `Planned ${plan.length} pages: ${plan.map(p => p.title).join(", ")}`,
  })

  // ── 3. Manifest ───────────────────────────────────────────────
  emit(emitter, { type: "phase", phase: "manifest", message: "Creating project manifest..." })
  let manifest = buildProjectManifest(brief, plan)
  emit(emitter, {
    type: "phase",
    phase: "manifest",
    message: `Manifest: ${manifest.pages.length} pages, ${manifest.design.visualStyle} style`,
  })

  // ── 4. Design System ──────────────────────────────────────────
  emit(emitter, { type: "phase", phase: "design", message: "Choosing mobile-first design system..." })
  manifest = runDesignSystemStep(manifest)
  emit(emitter, {
    type: "phase",
    phase: "design",
    message: `Selected: ${manifest.design.visualStyle}, ${manifest.chrome.navVariant} nav, ${manifest.design.motionLevel} motion`,
  })

  // ── 5. Scaffold ───────────────────────────────────────────────
  emit(emitter, { type: "phase", phase: "scaffold", message: "Creating Next.js project scaffold..." })
  const scaffoldFiles = runScaffoldStep(manifest)
  for (const f of scaffoldFiles) {
    emit(emitter, {
      type: "file",
      path: f.path,
      fileStatus: "created",
      fileKind: f.kind,
    })
  }
  emit(emitter, {
    type: "phase",
    phase: "scaffold",
    message: `Created ${scaffoldFiles.length} scaffold files`,
  })

  // ── 6–9. Page Generation Loop ─────────────────────────────────
  const pageFiles: GeneratedFile[] = []
  const allHandlers: string[] = []
  const allValidations: ValidationResult[] = []

  for (const page of manifest.pages) {
    // 6. Component context (deterministic)
    // 7. Generate page JSON
    emit(emitter, {
      type: "phase",
      phase: "page-json",
      message: `Generating ${page.title} JSON...`,
      route: page.route,
    })
    const pageJson = await runPageJsonGenerationStep(manifest, page, model)
    emit(emitter, {
      type: "json",
      route: page.route,
      jsonSummary: `Generated ${page.title} page tree`,
    })

    // 8. Validate JSON
    emit(emitter, {
      type: "phase",
      phase: "validation",
      message: `Validating ${page.title} JSON...`,
      route: page.route,
    })
    const routes = manifest.pages.map(p => p.route)
    const validation = validatePageJson(pageJson, page, routes)
    allValidations.push(validation)
    emit(emitter, {
      type: "json",
      route: page.route,
      validationResult: validation,
      message: validation.valid
        ? `${page.title} JSON valid: ${validation.nodeCount} nodes`
        : `${page.title} JSON has ${validation.errors.length} error(s)`,
    })

    // 9. Convert to Next.js
    emit(emitter, {
      type: "phase",
      phase: "conversion",
      message: `Converting ${page.title} to ${page.filePath}...`,
      route: page.route,
    })
    const converted = convertJsonToNextPage(pageJson, page, manifest)
    pageFiles.push(converted.file)
    allHandlers.push(...converted.usedHandlers)

    emit(emitter, {
      type: "file",
      path: converted.file.path,
      fileStatus: "created",
      fileKind: "page",
    })
  }

  // ── 10. Logic Generation ──────────────────────────────────────
  emit(emitter, { type: "phase", phase: "logic", message: "Generating handlers and actions..." })
  const logicFiles = runLogicGenerationStep(manifest, [...new Set(allHandlers)])
  for (const f of logicFiles) {
    emit(emitter, { type: "file", path: f.path, fileStatus: "created", fileKind: "logic" })
  }
  emit(emitter, {
    type: "phase",
    phase: "logic",
    message: `Generated ${logicFiles.length} action file(s)`,
  })

  // ── 11. Assembly ──────────────────────────────────────────────
  emit(emitter, { type: "phase", phase: "assembly", message: "Assembling project files..." })
  let project = assembleGeneratedProject(manifest, scaffoldFiles, pageFiles, logicFiles)
  emit(emitter, {
    type: "phase",
    phase: "assembly",
    message: `Assembled ${project.files.length} files`,
  })

  // ── 12. Build Validation ──────────────────────────────────────
  emit(emitter, { type: "phase", phase: "build", message: "Running build validation..." })
  let buildResult = runBuildValidation(project)
  emit(emitter, {
    type: "build",
    buildStatus: buildResult.ok ? "success" : "issues",
    buildIssues: buildResult.issues,
    buildLogs: buildResult.logs,
    message: buildResult.ok
      ? "Build validation passed"
      : `Build found ${buildResult.issues.length} issue(s)`,
  })

  // ── 13. Auto-fix ──────────────────────────────────────────────
  if (!buildResult.ok) {
    emit(emitter, {
      type: "phase",
      phase: "autofix",
      message: `Fixing ${buildResult.issues.length} build issue(s)...`,
    })
    project = runAutoFixStep(project, buildResult)

    // Re-validate
    buildResult = runBuildValidation(project)
    emit(emitter, {
      type: "build",
      buildStatus: buildResult.ok ? "success" : "issues-remaining",
      buildIssues: buildResult.issues,
      buildLogs: buildResult.logs,
      message: buildResult.ok
        ? "All issues fixed"
        : `${buildResult.issues.length} issue(s) remain after auto-fix`,
    })
  }

  // ── 14. Preview ───────────────────────────────────────────────
  emit(emitter, { type: "phase", phase: "preview", message: "Preparing preview..." })
  const previewResult = runPreviewStep(project)
  if (previewResult.available) {
    emit(emitter, {
      type: "preview",
      previewUrl: previewResult.previewUrl,
      message: "Preview ready.",
    })
  }

  // ── 15. Export ────────────────────────────────────────────────
  const exportResult = runExportStep(project)
  emit(emitter, {
    type: "phase",
    phase: "export",
    message: exportResult.ok
      ? `Project ready: ${project.files.length} files`
      : "Export preparation had issues",
  })

  // ── Complete ──────────────────────────────────────────────────
  emit(emitter, {
    type: "complete",
    message: "Your website is ready!",
    project,
  })

  return project
}
