import { promises as fs } from "fs"
import path from "path"

export type StyleNode = {
  id: string
  component: string
  children?: StyleNode[]
  label?: string
  onClick?: string
  [key: string]: any
}

export type StyleJson = {
  root: StyleNode
}

export type FunctionJson = {
  state?: string[]
  handlers?: Record<string, string>
  render_injections?: Record<string, any>
}

const COMPONENT_IMPORTS: Record<string, { source: string; file: string }> = {
  Button: { source: "@/components/ui/button", file: "components/ui/button.tsx" },
  Card: { source: "@/components/ui/card", file: "components/ui/card.tsx" },
  CardHeader: { source: "@/components/ui/card", file: "components/ui/card.tsx" },
  CardTitle: { source: "@/components/ui/card", file: "components/ui/card.tsx" },
  CardDescription: { source: "@/components/ui/card", file: "components/ui/card.tsx" },
  CardContent: { source: "@/components/ui/card", file: "components/ui/card.tsx" },
  CardFooter: { source: "@/components/ui/card", file: "components/ui/card.tsx" },
  Input: { source: "@/components/ui/input", file: "components/ui/input.tsx" },
  Label: { source: "@/components/ui/label", file: "components/ui/label.tsx" },
  Badge: { source: "@/components/ui/badge", file: "components/ui/badge.tsx" },
  Textarea: { source: "@/components/ui/textarea", file: "components/ui/textarea.tsx" },
  Avatar: { source: "@/components/ui/avatar", file: "components/ui/avatar.tsx" },
  Dialog: { source: "@/components/ui/dialog", file: "components/ui/dialog.tsx" },
  DialogContent: { source: "@/components/ui/dialog", file: "components/ui/dialog.tsx" },
  DialogHeader: { source: "@/components/ui/dialog", file: "components/ui/dialog.tsx" },
  DialogTitle: { source: "@/components/ui/dialog", file: "components/ui/dialog.tsx" },
  DialogDescription: { source: "@/components/ui/dialog", file: "components/ui/dialog.tsx" },
  DialogFooter: { source: "@/components/ui/dialog", file: "components/ui/dialog.tsx" },
  Alert: { source: "@/components/ui/alert", file: "components/ui/alert.tsx" },
  AlertTitle: { source: "@/components/ui/alert", file: "components/ui/alert.tsx" },
  AlertDescription: { source: "@/components/ui/alert", file: "components/ui/alert.tsx" },
  Sheet: { source: "@/components/ui/sheet", file: "components/ui/sheet.tsx" },
  SheetContent: { source: "@/components/ui/sheet", file: "components/ui/sheet.tsx" },
  SheetHeader: { source: "@/components/ui/sheet", file: "components/ui/sheet.tsx" },
  SheetTitle: { source: "@/components/ui/sheet", file: "components/ui/sheet.tsx" },
  SheetDescription: { source: "@/components/ui/sheet", file: "components/ui/sheet.tsx" },
}

export const BUILDER_COMPONENT_CHEATSHEET = Object.keys(COMPONENT_IMPORTS)

export function extractStyleComponents(node: StyleNode | undefined, bag = new Set<string>()) {
  if (!node) return bag
  if (node.component) bag.add(node.component)
  if (Array.isArray(node.children)) {
    for (const child of node.children) extractStyleComponents(child, bag)
  }
  return bag
}

export function getComponentSourceMap(names: string[]) {
  const deduped = Array.from(new Set(names))
  return deduped
    .map((name) => ({ name, meta: COMPONENT_IMPORTS[name] }))
    .filter((entry): entry is { name: string; meta: { source: string; file: string } } => Boolean(entry.meta))
}

export async function readComponentSources(names: string[]) {
  const entries = getComponentSourceMap(names)
  const sources: Record<string, string> = {}
  await Promise.all(entries.map(async ({ name, meta }) => {
    const absolute = path.join(process.cwd(), meta.file)
    const content = await fs.readFile(absolute, "utf8")
    sources[name] = content
  }))
  return sources
}

export function buildComponentImports(componentNames: string[]) {
  const bySource = new Map<string, Set<string>>()
  for (const { name, meta } of getComponentSourceMap(componentNames)) {
    if (!bySource.has(meta.source)) bySource.set(meta.source, new Set())
    bySource.get(meta.source)!.add(name)
  }
  return Array.from(bySource.entries())
    .map(([source, names]) => `import { ${Array.from(names).sort().join(", ")} } from "${source}"`)
    .sort()
}

export function safeParseJsonBlock(input: string) {
  const fenced = input.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenced?.[1] ?? input
  const trimmed = candidate.trim()
  const firstBrace = trimmed.indexOf("{")
  const lastBrace = trimmed.lastIndexOf("}")
  const raw = firstBrace >= 0 && lastBrace > firstBrace ? trimmed.slice(firstBrace, lastBrace + 1) : trimmed
  return JSON.parse(raw)
}
