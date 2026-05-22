// Syra — v0-style Generative UI Builder
// Barrel export

export { runSyraPipeline } from "./pipeline"
export type { PipelineOptions } from "./pipeline"
export { planManifest } from "./planner"
export { compileManifest } from "./compiler"
export { validateManifest, healElement, fallbackElement } from "./schema"
export { getRegistryEntry, isClientComponent, isVoidElement, REGISTRY, registryByName, registryByExport } from "./registry"
export { createSSEStream, streamPipelineProgress, buildStreamingResponse, formatProgressForChat } from "./stream"

// Re-export all types
export type {
  PipelineState,
  PipelineStep,
  StepStatus,
  ManifestElement,
  ManifestSection,
  ManifestPage,
  SiteManifest,
  GeneratedFile,
  GenerationResult,
  ProgressEvent,
  ProgressCallback,
  RegistryEntry,
  ThemeTokens,
  LayoutTemplate,
  LayoutDefinition,
} from "./types"

export type { ValidationResult } from "./schema"
