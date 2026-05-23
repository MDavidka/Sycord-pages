// Syra — v0-style Generative UI Builder
export { runPipeline } from "./pipeline"
export type { PipelineOptions } from "./pipeline"
export { planManifest } from "./planner"
export { compileSection, compilePage, compileManifest, compileLayout, compileConfigs } from "./compiler"
export { validateSyntax, hashContent } from "./syntax-guard"
export { validateManifest, healElement, healSection, ManifestASTSchema, ManifestElementSchema, ManifestSectionSchema } from "./schema"
export { REGISTRY, getEntry, getAllowedTypes, subcomponentToParent, registryByName } from "./registry"
export { createSSEStream, formatProgressForChat } from "./stream"
export type {
  ManifestElement, ManifestSection, ManifestPage, ManifestAST,
  GeneratedFile, PipelineStage, PipelineStep, PipelineState,
  GenerationResult, ProgressEvent, ModificationLayer,
} from "./types"
export type { RegistryEntry } from "./registry"
export type { ValidationResult } from "./schema"
export type { SyntaxCheckResult } from "./syntax-guard"
