import { buildImports } from "@/lib/ai-builder/buildImports"
import { extractUsedComponents } from "@/lib/ai-builder/manifest-resolver"
import { renderNode } from "@/lib/ai-builder/renderNode"
import type { FunctionJson, StyleJson } from "@/lib/ai-builder/types"

export function buildStateBlock(state: string[]): string {
  return state.join("\n  ")
}

export function buildHandlerBlock(handlers: Record<string, string>): string {
  return Object.values(handlers).join("\n  ")
}

export function assemble(styleJson: StyleJson, functionJson: FunctionJson): string {
  const usedComponents = extractUsedComponents(styleJson.root)
  const hasState = functionJson.state.length > 0
  const imports = buildImports(usedComponents, hasState)
  const state = buildStateBlock(functionJson.state)
  const handlers = buildHandlerBlock(functionJson.handlers)
  const jsx = renderNode(styleJson.root, functionJson.render_injections)

  return `${imports}

export default function App() {
  ${state}
  ${handlers}

  return (
    ${jsx.split("\n").join("\n    ")}
  )
}
`
}
