// Deterministic TSX Compiler — converts JSON ComponentTree → deployable TSX strings.
//
// This is a PURE function. It never invents components, props, or imports.
// Everything is resolved from the COMPONENT_CHEATSHEET.
//
// The compiler:
//   1. Traverses the component tree depth-first
//   2. Resolves each component against the cheatsheet
//   3. Compiles props safely (type-checked, JSON-safe values only)
//   4. Compiles children recursively
//   5. Generates proper JSX with correct self-closing tags
//   6. Collects all imports needed
//   7. Separates server and client component files

import {
  COMPONENT_CHEATSHEET,
  ALLOWED_COMPONENT_NAMES,
  CLIENT_COMPONENTS,
  getImportPath,
  isAllowedProp,
  type CheatsheetEntry,
} from "./cheatsheet"
import type { LayoutComponentNode, ComponentTree, ImportPlanEntry, PageCompositionPlan, LogicPlan } from "./types"

export interface CompiledPage {
  tsx: string
  importPlan: ImportPlanEntry[]
  needsClient: boolean
  logicCode: string | null
  diagnostics: CompilerDiagnostic[]
}

export interface CompilerResult {
  pages: CompiledPage[]
  diagnostics: CompilerDiagnostic[]
}

export interface CompilerDiagnostic {
  type: "error" | "warning"
  message: string
  path: string
  nodeType?: string
}

const VOID_ELEMENTS = new Set([
  "Input", "Textarea", "Image", "Separator", "Divider",
  "Spacer", "Skeleton", "Progress", "Checkbox", "Switch",
  "AvatarImage", "RadioGroupItem", "SelectValue", "Calendar",
])

const JSX_ESCAPE_MAP: Record<string, string> = {
  "{": "&#123;",
  "}": "&#125;",
  "`": "\\`",
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
}

function esc(value: unknown): string {
  if (value === undefined || value === null) return ""
  return String(value).replace(/[{}`&<>]/g, (c) => JSX_ESCAPE_MAP[c] ?? c).trim()
}

function jsxStr(value: unknown): string {
  if (value === undefined || value === null) return '""'
  const s = esc(value)
  return JSON.stringify(s)
}

function safeBoolean(value: unknown): boolean {
  return value === true
}

function safeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const n = Number(value)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

function compilePropValue(value: unknown, propName: string): string {
  if (value === null) return "{null}"
  if (value === undefined) return ""
  if (typeof value === "boolean") return `{${JSON.stringify(value)}}`
  if (typeof value === "number") return `{${JSON.stringify(value)}}`
  if (typeof value === "string") return jsxStr(value)
  if (typeof value === "object") return `{${JSON.stringify(value)}}`
  return jsxStr(String(value))
}

function compileProps(node: LayoutComponentNode, entry: CheatsheetEntry): string {
  if (!node.props || Object.keys(node.props).length === 0) return ""

  const parts: string[] = []
  for (const [key, value] of Object.entries(node.props)) {
    if (key === "children") continue
    if (!isAllowedProp(node.type, key)) continue

    if (typeof value === "string") {
      parts.push(`${key}=${jsxStr(value)}`)
    } else if (typeof value === "number" && Number.isFinite(value)) {
      parts.push(`${key}={${JSON.stringify(value)}}`)
    } else if (typeof value === "boolean") {
      if (value) parts.push(key)
    } else if (value === null) {
      parts.push(`${key}={null}`)
    } else if (typeof value === "object") {
      parts.push(`${key}={${JSON.stringify(value)}}`)
    }
  }

  return parts.length ? ` ${parts.join(" ")}` : ""
}

function compileTextChild(text: string): string {
  return esc(text)
}

function collectImports(node: LayoutComponentNode, imports: Map<string, Set<string>>): void {
  const entry = COMPONENT_CHEATSHEET[node.type]
  if (!entry) return

  const importPath = entry.import
  if (importPath) {
    if (!imports.has(importPath)) imports.set(importPath, new Set())
    imports.get(importPath)!.add(node.type)
  }

  for (const child of node.children ?? []) {
    collectImports(child, imports)
  }
}

function compileNode(node: LayoutComponentNode, depth: number, diagnostics: CompilerDiagnostic[], pagePath: string): string {
  const entry = COMPONENT_CHEATSHEET[node.type]
  if (!entry) {
    diagnostics.push({
      type: "warning",
      message: `Unknown component type "${node.type}" at depth ${depth}`,
      path: pagePath,
      nodeType: node.type,
    })
    return compileChildren(node.children ?? [], depth, diagnostics, pagePath)
  }

  const isVoid = VOID_ELEMENTS.has(node.type)
  const hasTextChildren = node.props?.children && typeof node.props.children === "string"
  const hasNodeChildren = node.children && node.children.length > 0
  const compProps = compileProps(node, entry)
  const isClientHint = node.clientComponent ?? CLIENT_COMPONENTS.has(node.type)

  if (isVoid) {
    if (isClientHint) {
      return `<${node.type}${compProps} />`
    }
    return `<${node.type}${compProps} />`
  }

  // Text-only children via props.children
  if (hasTextChildren && !hasNodeChildren) {
    const text = compileTextChild(String(node.props!.children))
    return `<${node.type}${compProps}>${text}</${node.type}>`
  }

  // Node children
  if (hasNodeChildren) {
    const childrenTsx = compileChildren(node.children!, depth + 1, diagnostics, pagePath)
    return `<${node.type}${compProps}>\n${childrenTsx}\n</${node.type}>`
  }

  // Empty element
  return `<${node.type}${compProps} />`
}

function compileChildren(
  children: LayoutComponentNode[],
  depth: number,
  diagnostics: CompilerDiagnostic[],
  pagePath: string,
): string {
  return children
    .map((child) => compileNode(child, depth, diagnostics, pagePath))
    .filter(Boolean)
    .join("\n")
}

function compileImportBlock(imports: Map<string, Set<string>>): string {
  const lines: string[] = []

  // Group imports by path
  for (const [from, named] of imports.entries()) {
    const sorted = Array.from(named).sort()
    lines.push(`import { ${sorted.join(", ")} } from ${JSON.stringify(from)}`)
  }

  return lines.join("\n")
}

function compileClientImports(imports: Map<string, Set<string>>): string {
  const lines: string[] = []

  for (const [from, named] of imports.entries()) {
    const sorted = Array.from(named).sort()
    lines.push(`import { ${sorted.join(", ")} } from ${JSON.stringify(from)}`)
  }

  return lines.join("\n")
}

function compileLogicCode(logic: LogicPlan): string {
  if (!logic?.state?.length && !logic?.actions?.length) return ""

  const sections: string[] = []

  if (logic.state.length > 0) {
    sections.push("  // State")
    const usedReactFeatures = new Set<string>(["useState"])
    for (const s of logic.state) {
      const initVal = JSON.stringify(s.initialValue)
      sections.push(`  const [${s.name}, set${s.name.charAt(0).toUpperCase() + s.name.slice(1)}] = useState(${initVal})`)
    }
  }

  if (logic.derived?.length) {
    const usedMemo = logic.derived.length > 0
    if (usedMemo) {
      sections.unshift("")
      sections.unshift("  const __deps: Record<string, unknown> = {}")
    }
  }

  if (logic.actions.length > 0) {
    sections.push("")
    for (const action of logic.actions) {
      const statePascal = action.stateName.charAt(0).toUpperCase() + action.stateName.slice(1)
      const setter = `set${statePascal}`
      switch (action.type) {
        case "setter":
          sections.push(`  const ${action.name} = useCallback((value) => ${setter}(value), [])`)
          break
        case "toggle":
          sections.push(`  const ${action.name} = useCallback(() => ${setter}((prev) => !prev), [])`)
          break
        case "increment":
          sections.push(`  const ${action.name} = useCallback(() => ${setter}((prev) => (typeof prev === "number" ? prev + 1 : prev)), [])`)
          break
        case "decrement":
          sections.push(`  const ${action.name} = useCallback(() => ${setter}((prev) => (typeof prev === "number" ? prev - 1 : prev)), [])`)
          break
        case "push":
          sections.push(`  const ${action.name} = useCallback((item) => ${setter}((prev) => Array.isArray(prev) ? [...prev, item] : prev), [])`)
          break
        case "remove":
          sections.push(`  const ${action.name} = useCallback((index) => ${setter}((prev) => Array.isArray(prev) ? prev.filter((_, i) => i !== index) : prev), [])`)
          break
        case "reset":
          const stateDef = logic.state.find((s) => s.name === action.stateName)
          const initVal = stateDef ? JSON.stringify(stateDef.initialValue) : "null"
          sections.push(`  const ${action.name} = useCallback(() => ${setter}(${initVal}), [])`)
          break
      }
    }
  }

  return sections.join("\n")
}

function detectLogicImports(logic: LogicPlan): ImportPlanEntry | null {
  if (!logic?.state?.length && !logic?.actions?.length) return null

  const hooks = new Set<string>()
  if (logic.state.length > 0) hooks.add("useState")
  if (logic.actions.length > 0) hooks.add("useCallback")

  return {
    from: "react",
    named: Array.from(hooks),
  }
}

function deduplicateImports(entries: ImportPlanEntry[]): ImportPlanEntry[] {
  const grouped = new Map<string, Set<string>>()
  for (const entry of entries) {
    if (!grouped.has(entry.from)) {
      grouped.set(entry.from, new Set())
    }
    for (const name of entry.named) {
      grouped.get(entry.from)!.add(name)
    }
  }

  const result: ImportPlanEntry[] = []
  for (const [from, named] of grouped.entries()) {
    result.push({ from, named: Array.from(named).sort() })
  }
  return result
}

export function compileComponentTree(tree: ComponentTree, pagePath: string): CompiledPage {
  const diagnostics: CompilerDiagnostic[] = []
  const importMap = new Map<string, Set<string>>()
  collectImports(tree.root, importMap)

  const compiled = compileNode(tree.root, 0, diagnostics, pagePath)
  const needsClient = CLIENT_COMPONENTS.has(tree.root.type) || (tree.root.clientComponent ?? false)

  return {
    tsx: compiled,
    importPlan: Array.from(importMap.entries()).map(([from, named]) => ({
      from,
      named: Array.from(named).sort(),
    })),
    needsClient,
    logicCode: null,
    diagnostics,
  }
}

export function compilePage(page: PageCompositionPlan): CompiledPage {
  const diagnostics: CompilerDiagnostic[] = []
  const importMap = new Map<string, Set<string>>()
  collectImports(page.componentTree, importMap)

  const compiled = compileNode(page.componentTree, 0, diagnostics, page.path)
  let needsClient = CLIENT_COMPONENTS.has(page.componentTree.type) || (page.componentTree.clientComponent ?? false)

  let logicCode: string | null = null
  let logicImport: ImportPlanEntry | null = null

  if (page.logicPlan) {
    logicCode = compileLogicCode(page.logicPlan)
    logicImport = detectLogicImports(page.logicPlan)
    needsClient = true
  }

  const allImports = Array.from(importMap.entries()).map(([from, named]) => ({
    from,
    named: Array.from(named).sort(),
  }))

  if (logicImport) {
    allImports.push(logicImport)
  }

  const deduplicated = deduplicateImports(allImports)

  return {
    tsx: compiled,
    importPlan: deduplicated,
    needsClient,
    logicCode,
    diagnostics,
  }
}

export function renderPageFile(page: PageCompositionPlan): { tsx: string; fileName: string } {
  const { tsx, importPlan, needsClient, logicCode } = compilePage(page)

  const clientHeader = needsClient ? '"use client"\n\n' : ""
  const importBlock = importPlan.length
    ? importPlan
        .map((imp) => `import { ${imp.named.join(", ")} } from ${JSON.stringify(imp.from)}`)
        .join("\n")
    : ""

  const metaBlock = `export const metadata = {
  title: ${JSON.stringify(page.metaTitle)},
  description: ${JSON.stringify(page.metaDescription)},
}`

  let componentContent = ""
  if (needsClient && logicCode) {
    componentContent = `export default function Page() {\n${logicCode}\n\n  return (\n    ${tsx}\n  )\n}`
  } else if (needsClient) {
    componentContent = `export default function Page() {\n  return (\n    ${tsx}\n  )\n}`
  } else {
    componentContent = `${metaBlock}\n\nexport default function Page() {\n  return (\n    ${tsx}\n  )\n}`
  }

  const fileTsx = `${clientHeader}${importBlock ? importBlock + "\n\n" : ""}${componentContent}\n`

  const filePath = page.path === "/" ? "app/page.tsx" : `app${page.path}/page.tsx`

  return { tsx: fileTsx, fileName: filePath }
}
