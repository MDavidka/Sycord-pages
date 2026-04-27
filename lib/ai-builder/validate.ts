// Validates a generated page UI tree against the manifest, the
// component subset for that page, and the structural rules from
// the spec. Returns a list of validation issues; the orchestrator
// decides whether to ask the AI to repair, or use a fallback.

import type {
  ManifestPage,
  PageUITree,
  UINode,
  ValidationIssue,
  ValidationResult,
} from "./types"
import {
  HTML_PRIMITIVES,
  isHtmlPrimitive,
  isMotionWrapper,
  type ComponentsCheatsheet,
} from "./components-context"

const FORBIDDEN_GLOBAL_NODES = new Set([
  "Header",
  "Footer",
  "SiteHeader",
  "SiteFooter",
  "Nav",
  "Navigation",
  "Navbar",
])

export function validatePageTree(args: {
  page: ManifestPage
  tree: PageUITree
  cheatsheet: ComponentsCheatsheet
}): ValidationResult {
  const issues: ValidationIssue[] = []
  const allowed = new Set<string>(args.page.shadcnComponents)
  const root = args.tree.component

  if (!root || typeof root.name !== "string") {
    issues.push({ level: "error", message: "Root component is missing or invalid" })
    return { ok: false, issues }
  }

  if (!HTML_PRIMITIVES.has(root.name) && !isMotionWrapper(root.name)) {
    issues.push({
      level: "warning",
      message: `Root node should be an HTML primitive (e.g. main/section/div). Got: ${root.name}`,
    })
  }

  const seen = {
    sectionsHit: 0,
    nodes: 0,
  }

  walk(root, (node) => {
    seen.nodes += 1
    if (FORBIDDEN_GLOBAL_NODES.has(node.name)) {
      issues.push({
        level: "error",
        message: `Page tree must not include a global ${node.name}. Header and footer are scaffold-provided.`,
      })
    }
    if (
      !isHtmlPrimitive(node.name) &&
      !isMotionWrapper(node.name) &&
      !allowed.has(node.name) &&
      !args.cheatsheet.allowedNodeNames.has(node.name)
    ) {
      issues.push({
        level: "error",
        message: `Component "${node.name}" is not in the allowed subset for page "${args.page.path}"`,
      })
    }
    // Track section-like containers for the heuristic count.
    if (node.name === "section" || node.name === "FadeIn" || node.name === "Stagger") {
      seen.sectionsHit += 1
    }
    // Reject explicit imports / TSX leakage.
    if (node.props && typeof node.props === "object") {
      for (const [k, v] of Object.entries(node.props)) {
        if (k === "children" && Array.isArray(v)) continue
        if (typeof v === "string" && /^\$handler\.[A-Za-z_][A-Za-z0-9_]*$/.test(v) === false && k.startsWith("on")) {
          issues.push({
            level: "warning",
            message: `Handler prop "${k}" should reference a $handler.<name> placeholder, got "${v}"`,
          })
        }
      }
    }
  })

  if (seen.nodes < 6) {
    issues.push({ level: "warning", message: "Page tree is unusually small" })
  }
  if (seen.sectionsHit < 4) {
    issues.push({ level: "warning", message: "Page should include at least 4 meaningful sections" })
  }
  if (!args.page.title) {
    issues.push({ level: "error", message: "Page title is missing on the manifest entry" })
  }

  const ok = issues.every((i) => i.level !== "error")
  return { ok, issues }
}

function walk(node: UINode, cb: (n: UINode) => void): void {
  cb(node)
  if (!Array.isArray(node.children)) return
  for (const child of node.children) {
    if (child && typeof child === "object") walk(child as UINode, cb)
  }
}
