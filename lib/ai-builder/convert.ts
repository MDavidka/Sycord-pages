// Deterministic JSON UI tree → Next.js page TSX converter.
//
// Walks the validated UI tree, emits the JSX with proper imports
// from components.json, attaches metadata, wires $handler.<name>
// references to imported handler functions, and decides whether
// the file needs "use client" (any handler use, motion wrapper, or
// state binding forces a client component).

import type {
  GeneratedFile,
  ManifestPage,
  PageUITree,
  SiteManifest,
  UINode,
} from "./types"
import {
  HTML_PRIMITIVES,
  MOTION_WRAPPERS,
  groupExportsByImportPath,
  isHtmlPrimitive,
  isMotionWrapper,
  type ComponentsCheatsheet,
} from "./components-context"

interface ConvertArgs {
  page: ManifestPage
  manifest: SiteManifest
  tree: PageUITree
  cheatsheet: ComponentsCheatsheet
}

interface ConvertState {
  needsClient: boolean
  usedHandlers: Set<string>
  usedMotion: Set<string>
  usedShadcn: Set<string>
}

export function convertPageToTsx(args: ConvertArgs): GeneratedFile {
  const state: ConvertState = {
    needsClient: false,
    usedHandlers: new Set(),
    usedMotion: new Set(),
    usedShadcn: new Set(),
  }

  const body = renderNode(args.tree.component, args, state, 2)
  const imports = buildImports(args, state)
  const useClient = state.needsClient ? '"use client"\n\n' : ""
  const metadata = buildMetadataBlock(args)

  const isRoot = args.page.path === "/"
  const content = `${useClient}${imports}

${metadata}

export default function ${args.page.componentName}() {
  return (
${body}
  )
}
${isRoot ? "" : ""}`

  return { path: args.page.filePath, content }
}

function buildImports(args: ConvertArgs, state: ConvertState): string {
  const lines: string[] = []
  // Always import Link in case the page uses internal links somewhere.
  lines.push(`import Link from "next/link"`)
  if (!isRootPage(args.page)) {
    lines.push(`import type { Metadata } from "next"`)
  } else {
    lines.push(`import type { Metadata } from "next"`)
  }

  // Group shadcn imports by import path.
  if (state.usedShadcn.size > 0) {
    const grouped = groupExportsByImportPath(args.cheatsheet, Array.from(state.usedShadcn))
    for (const [importPath, exports] of grouped) {
      lines.push(`import { ${exports.join(", ")} } from ${JSON.stringify(importPath)}`)
    }
  }

  // Motion wrapper imports.
  const motionGrouped = new Map<string, string[]>()
  for (const m of state.usedMotion) {
    const path = MOTION_WRAPPERS[m]
    if (!path) continue
    const arr = motionGrouped.get(path) ?? []
    if (!arr.includes(m)) arr.push(m)
    motionGrouped.set(path, arr)
  }
  for (const [importPath, exports] of motionGrouped) {
    lines.push(`import { ${exports.sort().join(", ")} } from ${JSON.stringify(importPath)}`)
  }

  // Handler imports — each used handler is imported from a single barrel.
  if (state.usedHandlers.size > 0) {
    const sorted = Array.from(state.usedHandlers).sort()
    lines.push(`import { ${sorted.join(", ")} } from "@/lib/handlers"`)
  }

  return lines.join("\n")
}

function buildMetadataBlock(args: ConvertArgs): string {
  const meta = {
    title: args.page.title,
    description: args.page.metadataDescription,
  }
  // Root page uses a flat title (no template parent), other pages
  // get titled by the layout's template.
  return `export const metadata: Metadata = ${JSON.stringify(meta, null, 2)}`
}

function isRootPage(p: ManifestPage): boolean {
  return p.path === "/"
}

// ---------------- Node rendering ----------------

function renderNode(
  node: UINode,
  args: ConvertArgs,
  state: ConvertState,
  indent: number,
): string {
  const tag = mapTag(node.name)
  registerNode(node.name, args, state)

  const propsString = renderProps(node, args, state)
  const children = Array.isArray(node.children) ? node.children : []
  const pad = " ".repeat(indent)

  if (children.length === 0) {
    if (SELF_CLOSING.has(tag)) {
      return `${pad}<${tag}${propsString} />`
    }
    return `${pad}<${tag}${propsString}></${tag}>`
  }

  const inner = children
    .map((c) => renderChild(c, args, state, indent + 2))
    .filter((s) => s.length > 0)
    .join("\n")

  return `${pad}<${tag}${propsString}>\n${inner}\n${pad}</${tag}>`
}

function renderChild(
  child: UINode | string,
  args: ConvertArgs,
  state: ConvertState,
  indent: number,
): string {
  const pad = " ".repeat(indent)
  if (typeof child === "string") {
    const text = child.trim()
    if (text.length === 0) return ""
    return `${pad}${escapeJsxText(text)}`
  }
  return renderNode(child, args, state, indent)
}

function registerNode(name: string, args: ConvertArgs, state: ConvertState) {
  if (isMotionWrapper(name)) {
    state.usedMotion.add(name)
    state.needsClient = true
    return
  }
  if (isHtmlPrimitive(name)) return
  // Treat as shadcn export if known.
  if (args.cheatsheet.byName[name]) {
    state.usedShadcn.add(name)
  }
}

const SELF_CLOSING = new Set(["img", "br", "hr", "input"])

function mapTag(name: string): string {
  // The 57-component cheatsheet uses canonical PascalCase exports.
  // HTML primitives map to themselves.
  if (HTML_PRIMITIVES.has(name)) return name
  return name
}

// ---------------- Props rendering ----------------

function renderProps(node: UINode, args: ConvertArgs, state: ConvertState): string {
  const props = node.props ?? {}
  const parts: string[] = []
  // Stable order: className first, then alphabetical, then handlers/href last.
  const keys = Object.keys(props).sort((a, b) => {
    if (a === "className") return -1
    if (b === "className") return 1
    return a.localeCompare(b)
  })

  for (const key of keys) {
    const value = (props as Record<string, unknown>)[key]
    if (value === undefined) continue
    if (key === "children") continue
    const rendered = renderProp(key, value, args, state, node.name)
    if (rendered) parts.push(rendered)
  }
  if (parts.length === 0) return ""
  return " " + parts.join(" ")
}

function renderProp(
  key: string,
  value: unknown,
  args: ConvertArgs,
  state: ConvertState,
  nodeName: string,
): string | null {
  // Handler placeholders.
  if (typeof value === "string" && value.startsWith("$handler.")) {
    const handler = value.slice("$handler.".length)
    if (!handler) return null
    state.usedHandlers.add(handler)
    state.needsClient = true
    return `${key}={${handler}}`
  }
  // State placeholders (rare on a static generated page).
  if (typeof value === "string" && value.startsWith("$state.")) {
    state.needsClient = true
    return `${key}={undefined}`
  }
  // href on internal anchors → use Next Link instead. The converter
  // doesn't rewrite the tag here; instead it normalizes <a href="/x">
  // children to Link. For now, we just emit the href as a string.
  if (typeof value === "string") {
    return `${key}=${JSON.stringify(value)}`
  }
  if (typeof value === "boolean") {
    return value ? key : null
  }
  if (typeof value === "number") {
    return `${key}={${value}}`
  }
  if (value === null) {
    return `${key}={null}`
  }
  if (Array.isArray(value) || typeof value === "object") {
    return `${key}={${JSON.stringify(value)}}`
  }
  return null
}

// ---------------- Text escaping ----------------

function escapeJsxText(text: string): string {
  // JSX treats { and } as expression delimiters, and < / > as tags.
  return text
    .replace(/\\/g, "\\\\")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;")
}
