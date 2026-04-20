import type { StyleNode } from "@/lib/ai-builder/types"

function buildPropString(node: Record<string, unknown>): string {
  const skip = new Set(["id", "component", "children", "label"])

  const props = Object.entries(node)
    .filter(([key]) => !skip.has(key))
    .map(([key, value]) => {
      if (value === undefined || value === null) {
        return ""
      }

      if (key === "onClick" && typeof value === "string") {
        return `onClick={${value}}`
      }

      if (typeof value === "string" && value.startsWith("{") && value.endsWith("}")) {
        return `${key}={${value.slice(1, -1)}}`
      }

      if (typeof value === "boolean") {
        return `${key}={${value}}`
      }

      return `${key}="${String(value)}"`
    })
    .filter(Boolean)
    .join(" ")

  return props ? ` ${props}` : ""
}

export function renderNode(
  node: StyleNode,
  injections: Record<string, Record<string, string>>
): string {
  const injection = injections[node.id] ?? {}
  const mergedProps: Record<string, unknown> = { ...node, ...injection }
  const propString = buildPropString(mergedProps)
  const tag = node.component

  if (!node.children || node.children.length === 0) {
    const content = injection.children ?? node.label ?? ""
    return `<${tag}${propString}>${content}</${tag}>`
  }

  const childrenJsx = node.children
    .map((child) => renderNode(child, injections))
    .map((line) => `  ${line}`)
    .join("\n")

  return `<${tag}${propString}>\n${childrenJsx}\n</${tag}>`
}
