// ============================================================
// Syra Website Builder — Deterministic Compiler (v2)
//
// Converts a PageUITree JSON AST into a Next.js .tsx file.
// No LLM is involved here — this is a pure, syntax-safe transformer.
//
// Rules:
//   - Lowercase component → HTML tag
//   - Uppercase component → @/components/ui/<slug> import
//   - "bind" prop → value + onChange state binding
//   - "onSubmit" prop → wired server action reference
//   - "text" field → rendered as JSX text content
// ============================================================

import type { ComponentNode, PageUITree, StateVar } from "./types"

// ─── Shadcn slug resolution ─────────────────────────────────────────────────

// Maps component names to their @/components/ui/<slug> import path.
const SHADCN_COMPONENTS: ReadonlySet<string> = new Set([
  "Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter",
  "Button", "Badge", "Input", "Textarea", "Label", "Separator",
  "Avatar", "AvatarImage", "AvatarFallback",
  "Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent",
  "Tabs", "TabsList", "TabsTrigger", "TabsContent",
])

function slugFromComponent(name: string): string {
  // e.g. "CardHeader" → "card", "AccordionItem" → "accordion"
  if (/^(Card|CardHeader|CardTitle|CardDescription|CardContent|CardFooter)$/.test(name)) return "card"
  if (/^(Accordion|AccordionItem|AccordionTrigger|AccordionContent)$/.test(name)) return "accordion"
  if (/^(Tabs|TabsList|TabsTrigger|TabsContent)$/.test(name)) return "tabs"
  if (/^(Avatar|AvatarImage|AvatarFallback)$/.test(name)) return "avatar"
  return name.toLowerCase()
}

function isShadcnComponent(name: string): boolean {
  return SHADCN_COMPONENTS.has(name)
}

function isHtmlTag(name: string): boolean {
  return name.length > 0 && name[0] === name[0].toLowerCase()
}

// ─── Prop serialization ──────────────────────────────────────────────────────

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function serializePropValue(key: string, value: unknown): string {
  // Special compiler bindings
  if (key === "bind" && typeof value === "string") {
    // Renders as: value={email} onChange={(e) => setEmail(e.target.value)}
    return `value={${value}} onChange={(e) => set${capitalize(value)}(e.target.value)}`
  }
  if (key === "onSubmit" && typeof value === "string") {
    return `onSubmit={${value}}`
  }

  // Standard JSX prop serialization
  if (typeof value === "string") {
    // Escape quotes in string values
    const escaped = value.replace(/"/g, '\\"')
    return `${key}="${escaped}"`
  }
  if (typeof value === "boolean") {
    return value ? key : `${key}={false}`
  }
  if (typeof value === "number") {
    return `${key}={${value}}`
  }
  if (value === null) {
    return `${key}={null}`
  }
  if (Array.isArray(value)) {
    return `${key}={${JSON.stringify(value)}}`
  }
  return ""
}

function serializeProps(props: Record<string, unknown>): string {
  const parts: string[] = []
  for (const [key, value] of Object.entries(props)) {
    // Skip "bind" key — it's handled above, generates two props
    if (key === "bind") {
      parts.push(serializePropValue("bind", value))
      continue
    }
    // Skip event handlers that aren't "onSubmit" — they can't be safely serialized
    if (/^on[A-Z]/.test(key) && key !== "onSubmit") continue
    const serialized = serializePropValue(key, value)
    if (serialized) parts.push(serialized)
  }
  return parts.length > 0 ? " " + parts.join(" ") : ""
}

// ─── Core recursive compiler ─────────────────────────────────────────────────

interface CompileOptions {
  indent?: number
}

export function compileNode(node: ComponentNode, opts: CompileOptions = {}): string {
  const indent = opts.indent ?? 2
  const pad = "  ".repeat(indent)
  const childPad = "  ".repeat(indent + 1)

  const { component, props = {}, text, children } = node

  const propsStr = serializeProps(props)

  // Void elements (no closing tag)
  const voidTags = new Set(["img", "input", "br", "hr", "meta", "link"])
  if (voidTags.has(component)) {
    return `${pad}<${component}${propsStr} />`
  }

  // Leaf node with only text content
  if (!children || children.length === 0) {
    if (text) {
      // Escape curly braces, <, > in text content
      const safeText = text
        .replace(/\{/g, "&#123;")
        .replace(/\}/g, "&#125;")
      return `${pad}<${component}${propsStr}>${safeText}</${component}>`
    }
    return `${pad}<${component}${propsStr} />`
  }

  // Element with children (and optional text mixed in)
  const childrenStr = children
    .map((child) => compileNode(child, { indent: indent + 1 }))
    .join("\n")

  if (text) {
    return `${pad}<${component}${propsStr}>\n${childPad}${text}\n${childrenStr}\n${pad}</${component}>`
  }
  return `${pad}<${component}${propsStr}>\n${childrenStr}\n${pad}</${component}>`
}

// ─── State declarations ──────────────────────────────────────────────────────

function buildStateDeclarations(state: StateVar[]): string {
  return state
    .map((s) => {
      const defaultVal = JSON.stringify(s.default)
      return `  const [${s.name}, set${capitalize(s.name)}] = useState${s.type === "string" ? "<string>" : s.type === "number" ? "<number>" : s.type === "boolean" ? "<boolean>" : ""}(${defaultVal})`
    })
    .join("\n")
}

// ─── Import resolution ───────────────────────────────────────────────────────

function collectShadcnImports(node: ComponentNode, bySlug: Map<string, Set<string>>): void {
  if (isShadcnComponent(node.component)) {
    const slug = slugFromComponent(node.component)
    if (!bySlug.has(slug)) bySlug.set(slug, new Set())
    bySlug.get(slug)!.add(node.component)
  }
  for (const child of node.children ?? []) {
    collectShadcnImports(child, bySlug)
  }
}

function buildImportBlock(pageTree: PageUITree): string {
  const lines: string[] = []

  // Always include metadata import if server component
  if (pageTree.is_server_component) {
    lines.push('import type { Metadata } from "next"')
  }

  if (!pageTree.is_server_component) {
    lines.push('"use client"')
    lines.push("")
    lines.push('import React, { useState } from "react"')
  } else {
    lines.push("")
    lines.push('import React from "react"')
  }

  // Collect all shadcn components actually used in the tree
  const bySlug = new Map<string, Set<string>>()
  collectShadcnImports(pageTree.tree, bySlug)

  // Also add ones explicitly listed in the imports array from Node B
  for (const imp of pageTree.imports) {
    if (isShadcnComponent(imp)) {
      const slug = slugFromComponent(imp)
      if (!bySlug.has(slug)) bySlug.set(slug, new Set())
      bySlug.get(slug)!.add(imp)
    }
  }

  for (const [slug, names] of bySlug) {
    const sorted = Array.from(names).sort()
    lines.push(`import { ${sorted.join(", ")} } from "@/components/ui/${slug}"`)
  }

  lines.push('import { cn } from "@/lib/utils"')

  return lines.join("\n")
}

// ─── Metadata export ─────────────────────────────────────────────────────────

function buildMetaExport(pageTree: PageUITree, projectName: string): string {
  const title = `${pageTree.route === "/" ? "Home" : pageTree.route.replace(/^\//, "").replace(/-/g, " ")} — ${projectName}`
  const desc = pageTree.purpose || `${projectName} — ${pageTree.route}`
  return `export const metadata: Metadata = {\n  title: ${JSON.stringify(title)},\n  description: ${JSON.stringify(desc)},\n}`
}

// ─── File path derivation ────────────────────────────────────────────────────

export function routeToFilePath(routePath: string): string {
  return routePath === "/" ? "app/page.tsx" : `app${routePath}/page.tsx`
}

function componentNameFromRoute(routePath: string): string {
  if (routePath === "/") return "HomePage"
  const parts = routePath.replace(/^\//, "").split("/").filter(Boolean)
  const camel = parts
    .map((segment) =>
      segment
        .split("-")
        .map((p) => (p[0]?.toUpperCase() ?? "") + p.slice(1))
        .join("")
    )
    .join("")
  return `${camel || "Page"}Page`
}

// ─── Main compile function ───────────────────────────────────────────────────

export interface CompiledPage {
  path: string
  content: string
  shadcnSlugs: Set<string>
}

export function compilePageTree(pageTree: PageUITree, projectName: string): CompiledPage {
  const importBlock = buildImportBlock(pageTree)
  const componentName = componentNameFromRoute(pageTree.route)

  // Collect shadcn slugs so the scaffold knows which ui files to emit
  const bySlug = new Map<string, Set<string>>()
  collectShadcnImports(pageTree.tree, bySlug)
  const shadcnSlugs = new Set<string>(bySlug.keys())

  // Build the JSX body
  const jsxBody = compileNode(pageTree.tree, { indent: 2 })

  // Build state declarations
  const stateDecls = pageTree.state.length > 0 ? buildStateDeclarations(pageTree.state) : ""

  // Build metadata (server components only)
  const metaBlock = pageTree.is_server_component ? buildMetaExport(pageTree, projectName) : ""

  const content = [
    importBlock,
    "",
    ...(metaBlock ? [metaBlock, ""] : []),
    `export default function ${componentName}() {`,
    ...(stateDecls ? [stateDecls] : []),
    "  return (",
    jsxBody,
    "  )",
    "}",
    "",
  ].join("\n")

  return {
    path: routeToFilePath(pageTree.route),
    content,
    shadcnSlugs,
  }
}

// ─── Batch compile all pages ─────────────────────────────────────────────────

export function compileAllPages(
  pageTrees: PageUITree[],
  projectName: string,
): { pages: CompiledPage[]; requiredSlugs: Set<string> } {
  const pages: CompiledPage[] = []
  const requiredSlugs = new Set<string>(["button", "badge", "card", "separator"])

  for (const tree of pageTrees) {
    const compiled = compilePageTree(tree, projectName)
    pages.push(compiled)
    for (const slug of compiled.shadcnSlugs) {
      requiredSlugs.add(slug)
    }
  }

  return { pages, requiredSlugs }
}
