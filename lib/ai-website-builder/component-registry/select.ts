import type { DesignDirection } from "../design-directions"
import type { ProjectContext } from "../types"
import { CREATIVE_COMPONENTS, type CreativeComponent } from "./components"
import { COMPONENT_RECIPES, type ComponentRecipe } from "./recipes"

function normalizeTag(s: string): string {
  return s.trim().toLowerCase()
}

function promptTags(prompt: string, project?: ProjectContext): Set<string> {
  const text = `${prompt} ${project?.category ?? ""} ${project?.description ?? ""}`.toLowerCase()
  const tokens = text.split(/[^a-z0-9]+/g).filter(Boolean)
  return new Set(tokens)
}

export function pickRecipe(prompt: string, direction: DesignDirection | undefined, project?: ProjectContext): ComponentRecipe {
  const tags = promptTags(prompt, project)
  const directionTag = direction?.visualStyle ? normalizeTag(direction.visualStyle) : ""
  let best: { recipe: ComponentRecipe; score: number } | null = null
  for (const recipe of COMPONENT_RECIPES) {
    let score = 0
    for (const t of recipe.siteTypes) {
      if (tags.has(normalizeTag(t))) score += 2
    }
    if (directionTag && recipe.layoutRhythm.toLowerCase().includes(directionTag)) score += 1
    if (!best || score > best.score) best = { recipe, score }
  }
  return best?.recipe ?? COMPONENT_RECIPES[0]!
}

export function resolveComponents(componentIds: string[]): CreativeComponent[] {
  const byId = new Map(CREATIVE_COMPONENTS.map((c) => [c.id, c]))
  return componentIds.map((id) => byId.get(id)).filter((c): c is CreativeComponent => Boolean(c))
}

