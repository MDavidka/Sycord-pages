// Component tree validation — validates JSON ComponentTrees against the
// COMPONENT_CHEATSHEET. Rejects unknown components, invalid props, malformed
// trees, unsafe hooks, and server/client violations.

import { COMPONENT_CHEATSHEET, ALLOWED_COMPONENT_NAMES, isAllowedProp, CLIENT_COMPONENTS } from "./cheatsheet"
import type { LayoutComponentNode, ComponentTree, ImportPlanEntry, LogicPlan, PageCompositionPlan } from "./types"

export interface TreeValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

const MAX_TREE_DEPTH = 10
const MAX_NODES = 500

export function validateComponentTree(tree: ComponentTree | LayoutComponentNode, context: string): TreeValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const seenIds = new Set<string>()

  const root = (tree as ComponentTree).root ?? (tree as LayoutComponentNode)
  if (!root || typeof root !== "object") {
    errors.push(`${context}: component tree is empty or invalid`)
    return { ok: false, errors, warnings }
  }

  validateNode(root, 0, context, errors, warnings, seenIds)

  return { ok: errors.length === 0, errors, warnings }
}

function validateNode(
  node: LayoutComponentNode,
  depth: number,
  context: string,
  errors: string[],
  warnings: string[],
  seenIds: Set<string>,
  nodeCount = { value: 0 },
): void {
  nodeCount.value++
  if (nodeCount.value > MAX_NODES) {
    if (!errors.some((e) => e.includes("node limit"))) {
      errors.push(`${context}: component tree exceeds ${MAX_NODES} nodes`)
    }
    return
  }

  if (depth > MAX_TREE_DEPTH) {
    errors.push(`${context}: component tree exceeds max depth ${MAX_TREE_DEPTH} at "${node.type}"`)
    return
  }

  if (!node.type || typeof node.type !== "string") {
    errors.push(`${context}: node at depth ${depth} missing "type" field`)
    return
  }

  if (!ALLOWED_COMPONENT_NAMES.has(node.type)) {
    errors.push(`${context}: unknown component type "${node.type}" — not in COMPONENT_CHEATSHEET`)
    return
  }

  const entry = COMPONENT_CHEATSHEET[node.type]

  if (depth === 0 && node.type !== "Page") {
    warnings.push(`${context}: root node should be "Page", got "${node.type}"`)
  }

  if (node.clientComponent) {
    if (depth === 0) {
      warnings.push(`${context}: root "Page" should not be marked clientComponent; use "use client" directive on child`)
    }
    if (!entry.isClient) {
      warnings.push(`${context}: "${node.type}" marked clientComponent but is not in CLIENT_COMPONENTS set`)
    }
  }

  if (node.props) {
    for (const key of Object.keys(node.props)) {
      if (key === "children") continue
      if (!isAllowedProp(node.type, key)) {
        warnings.push(`${context}: "${node.type}" has unsupported prop "${key}". Allowed: ${entry.props.join(", ")}`)
      }
      const value = node.props[key]
      if (typeof value === "string" && value.includes("<") && value.includes(">")) {
        errors.push(`${context}: "${node.type}.${key}" contains raw JSX/HTML — not allowed in props`)
      }
      if (typeof value === "string" && value.includes("${")) {
        errors.push(`${context}: "${node.type}.${key}" contains template literal — not allowed`)
      }
    }
  }

  if (node.logicBinding) {
    if (depth === 0) {
      warnings.push(`${context}: logicBinding on root Page node is ignored`)
    }
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(node.logicBinding)) {
      errors.push(`${context}: invalid logicBinding name "${node.logicBinding}"`)
    }
  }

  for (const child of node.children ?? []) {
    validateNode(child, depth + 1, context, errors, warnings, seenIds, nodeCount)
  }
}

export function validateImportPlan(imports: ImportPlanEntry[]): TreeValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const seen = new Map<string, Set<string>>()

  for (const imp of imports) {
    if (!imp.from || typeof imp.from !== "string") {
      errors.push(`ImportPlan: invalid "from" field: ${JSON.stringify(imp)}`)
      continue
    }
    if (!Array.isArray(imp.named) || imp.named.length === 0) {
      warnings.push(`ImportPlan: "${imp.from}" has no named imports`)
      continue
    }

    if (!seen.has(imp.from)) seen.set(imp.from, new Set())
    const names = seen.get(imp.from)!

    for (const name of imp.named) {
      if (names.has(name)) {
        warnings.push(`ImportPlan: duplicate import "${name}" from "${imp.from}"`)
      }
      names.add(name)
    }

    if (imp.from.startsWith("@/components/ui/")) {
      const componentName = imp.from.split("/").pop()!
      if (componentName && !ALLOWED_COMPONENT_NAMES.has(imp.named[0]) &&
          !["Card", "Accordion", "Tabs", "Alert", "Dialog", "Sheet", "Table", "Select"].some(
            (parent) => imp.named.every((n) => n.startsWith(parent)),
          )) {
        warnings.push(`ImportPlan: "${imp.from}" may contain unknown components`)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function validateLogicPlan(logic: LogicPlan): TreeValidation {
  const errors: string[] = []
  const warnings: string[] = []
  const stateNames = new Set<string>()
  const actionNames = new Set<string>()

  if (!logic) return { ok: true, errors, warnings }

  for (const state of logic.state ?? []) {
    if (!state.name || !/^[A-Za-z][A-Za-z0-9]*$/.test(state.name)) {
      errors.push(`LogicPlan: invalid state name "${state.name}"`)
    }
    if (stateNames.has(state.name)) {
      errors.push(`LogicPlan: duplicate state name "${state.name}"`)
    }
    stateNames.add(state.name)

    if (!["string", "number", "boolean", "array", "object"].includes(state.type)) {
      errors.push(`LogicPlan: invalid state type "${state.type}" for "${state.name}"`)
    }
  }

  for (const action of logic.actions ?? []) {
    if (!action.name || !/^[A-Za-z][A-Za-z0-9]*$/.test(action.name)) {
      errors.push(`LogicPlan: invalid action name "${action.name}"`)
    }
    if (actionNames.has(action.name)) {
      errors.push(`LogicPlan: duplicate action name "${action.name}"`)
    }
    actionNames.add(action.name)

    if (!stateNames.has(action.stateName)) {
      errors.push(`LogicPlan: action "${action.name}" references unknown state "${action.stateName}"`)
    }
  }

  for (const derived of logic.derived ?? []) {
    if (!derived.name) {
      errors.push("LogicPlan: derived value missing name")
    }
    for (const dep of derived.dependencies ?? []) {
      if (!stateNames.has(dep)) {
        warnings.push(`LogicPlan: derived "${derived.name}" depends on unknown state "${dep}"`)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function validatePageComposition(page: PageCompositionPlan): TreeValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!page.path) {
    errors.push("PageComposition: missing path")
  }
  if (!page.componentTree) {
    errors.push(`PageComposition "${page.path}": missing componentTree`)
    return { ok: false, errors, warnings }
  }

  const treeValidation = validateComponentTree(page.componentTree, `page "${page.path}"`)
  errors.push(...treeValidation.errors)
  warnings.push(...treeValidation.warnings)

  if (page.importPlan) {
    const importValidation = validateImportPlan(page.importPlan.imports)
    errors.push(...importValidation.errors)
    warnings.push(...importValidation.warnings)
  }

  if (page.logicPlan) {
    const logicValidation = validateLogicPlan(page.logicPlan)
    errors.push(...logicValidation.errors)
    warnings.push(...logicValidation.warnings)
  }

  return { ok: errors.length === 0, errors, warnings }
}

export function validateGeneratedFiles(files: Array<{ path: string; content: string }>): TreeValidation {
  const errors: string[] = []
  const warnings: string[] = []

  const requiredFiles = [
    "app/layout.tsx",
    "app/globals.css",
    "app/page.tsx",
    "package.json",
    "tsconfig.json",
    "next.config.mjs",
    "lib/utils.ts",
  ]

  const filePaths = new Set(files.map((f) => f.path))

  for (const required of requiredFiles) {
    if (!filePaths.has(required)) {
      errors.push(`Missing required file: ${required}`)
    }
  }

  for (const file of files) {
    if (file.path.includes(".env")) {
      errors.push(`env file detected: ${file.path} — env files must never be generated`)
    }
    if (file.content.includes("NEXT_PUBLIC_") && file.path.includes(".env")) {
      errors.push(`NEXT_PUBLIC_ env var in ${file.path}`)
    }
    const secretPatterns = [
      /sk-[A-Za-z0-9]{20,}/,
      /pk_[A-Za-z0-9]{20,}/,
      /Bearer\s+[A-Za-z0-9\-_]{20,}/,
      /TURSO_AUTH_TOKEN[\s=]+[A-Za-z0-9]+/,
      /DATABASE_URL[\s=]+postgres/,
    ]
    for (const pattern of secretPatterns) {
      if (pattern.test(file.content)) {
        errors.push(`Hard-coded secret detected in ${file.path}`)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}
