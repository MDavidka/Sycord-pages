// Syra — v2 barrel export
export { runPipeline } from "./pipeline"
export type { PipelineOptions } from "./pipeline"
export { planManifest } from "./planner"
export { compileSection, compilePage, compileHeader, compileFooter, compileLayoutMap, compileManifest } from "./compiler"
export { validate } from "./schema"
export { ManifestASTSchema } from "./schema"
export { validateSyntax, hashContent } from "./syntax-guard"
export { getPrimitive, isClient as isClientPrimitive, REGISTRY } from "./registry"
export { formatProgressForChat } from "./stream"
export { DEFAULT_STEPS } from "./types"
export type {
  ManifestAST, ManifestPage, ManifestSection, ManifestComponent,
  SiteMetadata, RouteEdge,
  PipelineStage, PipelineStep, PipelineState,
  GeneratedFile, GenerationResult, ProgressEvent, ModificationLayer,
} from "./types"
export type { RegistryEntry } from "./registry"
export type { ValidationResult } from "./schema"
export type { SyntaxCheckResult } from "./syntax-guard"
