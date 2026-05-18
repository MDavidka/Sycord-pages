import type { CreativeComponent } from "./components"

export interface CompositionScore {
  variety: number
  richness: number
  notes: string[]
}

export function scoreComponentSet(components: CreativeComponent[]): CompositionScore {
  const categories = new Set(components.map((c) => c.category))
  const richCount = components.filter((c) => c.complexity === "rich").length
  const notes: string[] = []
  if (categories.size < Math.min(4, components.length)) notes.push("Low category variety")
  if (richCount === 0) notes.push("No rich components selected")
  return {
    variety: Math.min(100, categories.size * 18 + components.length * 8),
    richness: Math.min(100, richCount * 25 + components.length * 5),
    notes,
  }
}

