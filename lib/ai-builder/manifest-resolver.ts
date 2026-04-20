import { componentManifest } from "@/lib/ai-builder/manifest"
import type { StyleJson, StyleNode } from "@/lib/ai-builder/types"

export function extractUsedComponents(node: StyleNode): string[] {
  const used = new Set<string>()

  function walk(current: StyleNode) {
    used.add(current.component)
    current.children?.forEach(walk)
  }

  walk(node)
  return [...used]
}

export function buildDeveloperContext(styleJson: StyleJson): {
  styleJson: StyleJson
  componentSources: Array<{ name: string; source: string }>
} {
  const used = extractUsedComponents(styleJson.root)
  const missing = used.filter((name) => !componentManifest[name])

  if (missing.length > 0) {
    throw new Error(`Missing component source in manifest: ${missing.join(", ")}`)
  }

  return {
    styleJson,
    componentSources: used.map((name) => ({
      name,
      source: componentManifest[name],
    })),
  }
}

export function collectHandlerIds(node: StyleNode): string[] {
  const handlers = new Set<string>()

  function walk(current: StyleNode) {
    if (current.onClick) {
      handlers.add(current.onClick)
    }
    current.children?.forEach(walk)
  }

  walk(node)
  return [...handlers]
}
