import { CREATIVE_COMPONENTS } from "./components"

export { CREATIVE_COMPONENTS, type CreativeComponent, type LegacyRendererHint } from "./components"
export { COMPONENT_RECIPES, type ComponentRecipe } from "./recipes"
export { scoreComponentSet, type CompositionScore } from "./scoring"
export { pickRecipe, resolveComponents } from "./select"
export type { CreativeComponentCategory } from "./categories"

export function registryForPrompt(): Array<{
  id: string
  name: string
  category: string
  styleTags: string[]
  bestFor: string[]
  avoidFor?: string[]
  complexity: string
  dependencies: string[]
  responsiveNotes: string
}> {
  return CREATIVE_COMPONENTS.map((c) => ({
    id: c.id,
    name: c.name,
    category: c.category,
    styleTags: c.styleTags,
    bestFor: c.bestFor,
    avoidFor: c.avoidFor,
    complexity: c.complexity,
    dependencies: c.dependencies,
    responsiveNotes: c.responsiveNotes,
  }))
}
