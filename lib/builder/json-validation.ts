// ── Step 8: JSON Validation ─────────────────────────────────────────
// Validate generated page JSON before conversion. No AI call.

import type { UiTreeEnvelope, ManifestPage, ValidationResult, UiNode } from "./types"

const ALLOWED_HTML = new Set([
  "main", "div", "section", "header", "footer", "nav", "aside", "article",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "ul", "ol", "li",
  "img", "figure", "figcaption", "blockquote", "pre", "code",
  "form", "label", "fieldset", "legend",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "strong", "em", "br", "hr",
])

const ALLOWED_SHADCN = new Set([
  "Button", "Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter",
  "Badge", "Input", "Textarea", "Separator",
  "Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent",
  "Tabs", "TabsList", "TabsTrigger", "TabsContent",
  "Avatar", "AvatarImage", "AvatarFallback",
  "Table", "TableHeader", "TableBody", "TableRow", "TableHead", "TableCell",
  "Select", "SelectTrigger", "SelectValue", "SelectContent", "SelectItem",
])

const ALLOWED_MOTION = new Set([
  "FadeIn", "Stagger", "StaggerItem", "MotionCard",
])

const FORBIDDEN_ELEMENTS = new Set([
  "SiteHeader", "SiteFooter", "Header", "Footer", "Navbar", "Navigation",
])

function countNodes(node: UiNode): number {
  let count = 1
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child)
    }
  }
  return count
}

function collectInfo(
  node: UiNode,
  components: Set<string>,
  handlers: Set<string>,
  states: Set<string>,
  warnings: string[],
  errors: string[],
) {
  const { name, props, children } = node

  if (FORBIDDEN_ELEMENTS.has(name)) {
    errors.push(`Forbidden element: ${name} (global chrome is handled in layout)`)
  }

  if (!ALLOWED_HTML.has(name) && !ALLOWED_SHADCN.has(name) && !ALLOWED_MOTION.has(name)) {
    warnings.push(`Unknown component: ${name}`)
  }

  if (ALLOWED_SHADCN.has(name) || ALLOWED_MOTION.has(name)) {
    components.add(name)
  }

  if (props) {
    for (const [key, val] of Object.entries(props)) {
      if (typeof val === "string") {
        if (val.startsWith("$handler.")) handlers.add(val.replace("$handler.", ""))
        if (val.startsWith("$state.")) states.add(val.replace("$state.", ""))
        if (val.includes("lorem") || val.includes("Lorem")) {
          warnings.push(`Lorem ipsum detected in ${name}.${key}`)
        }
      }
    }
  }

  if (node.text) {
    if (node.text.includes("lorem") || node.text.includes("Lorem")) {
      warnings.push(`Lorem ipsum detected in ${name} text`)
    }
  }

  if (children) {
    for (const child of children) {
      collectInfo(child, components, handlers, states, warnings, errors)
    }
  }
}

export function validatePageJson(
  envelope: UiTreeEnvelope,
  page: ManifestPage,
  manifestRoutes: string[],
): ValidationResult {
  const warnings: string[] = []
  const errors: string[] = []

  if (!envelope || envelope.type !== "ui-tree") {
    errors.push("Missing or invalid envelope type")
  }

  if (!envelope.component) {
    errors.push("Missing root component")
    return {
      valid: false,
      nodeCount: 0,
      usedComponents: [],
      usedHandlers: [],
      usedStates: [],
      warnings,
      errors,
    }
  }

  const nodeCount = countNodes(envelope.component)
  if (nodeCount < 5) {
    warnings.push(`Low node count: ${nodeCount} (expected at least 10)`)
  }

  const components = new Set<string>()
  const handlers = new Set<string>()
  const states = new Set<string>()

  collectInfo(envelope.component, components, handlers, states, warnings, errors)

  // Check for page title
  let hasTitle = false
  function findTitle(node: UiNode) {
    if (node.name === "h1" && node.text) hasTitle = true
    if (node.children) node.children.forEach(findTitle)
  }
  findTitle(envelope.component)
  if (!hasTitle) {
    warnings.push("No visible h1 page title found")
  }

  // Check mobile-first classes
  let hasMobileFirst = false
  function checkResponsive(node: UiNode) {
    if (node.props?.className && typeof node.props.className === "string") {
      const cls = node.props.className
      if (cls.includes("sm:") || cls.includes("md:") || cls.includes("lg:")) {
        hasMobileFirst = true
      }
    }
    if (node.children) node.children.forEach(checkResponsive)
  }
  checkResponsive(envelope.component)
  if (!hasMobileFirst) {
    warnings.push("No responsive breakpoint classes found (sm:/md:/lg:)")
  }

  const valid = errors.length === 0

  return {
    valid,
    nodeCount,
    usedComponents: [...components],
    usedHandlers: [...handlers],
    usedStates: [...states],
    warnings,
    errors,
  }
}
