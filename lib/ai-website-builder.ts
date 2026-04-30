// Barrel re-export. The actual builder lives in ./ai-website-builder/* so
// it can be split into focused modules (types, themes, prompts, sections,
// scaffold, validate, index). Existing imports of "@/lib/ai-website-builder"
// continue to work unchanged.

export { runAIWebsiteBuilder } from "./ai-website-builder/index"
export type {
  BuilderOptions,
  GeneratedProjectManifest,
  PagePlan,
  RunBuilderResult,
  SectionPlan,
  ThemeTokens,
} from "./ai-website-builder/types"
