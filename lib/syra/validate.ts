// Lightweight static validation for generated files.
//
// This is intentionally heuristic (no full TS compile) but catches the mistakes
// the model most often makes: missing "use client" for interactive App Router
// components, an empty/missing home page, and obviously unbalanced brackets.
// Fatal issues trigger a single automated repair round in the agent.

import type { ProjectFramework } from "./types"
import type { VirtualFs } from "./vfs"

export interface ValidationIssue {
  path: string
  level: "error" | "warning"
  message: string
}

const CLIENT_SIGNALS = [
  "useState",
  "useEffect",
  "useRef",
  "useReducer",
  "useContext",
  "useCallback",
  "useMemo",
  "onClick",
  "onChange",
  "onSubmit",
  "framer-motion",
  "useRouter",
]

function bracketBalance(src: string): boolean {
  // Strip strings/comments crudely to reduce false positives.
  const cleaned = src
    .replace(/\/\/[^\n]*/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/`(?:\\.|[^`\\])*`/g, "``")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
  const pairs: Record<string, string> = { ")": "(", "]": "[", "}": "{" }
  const stack: string[] = []
  for (const ch of cleaned) {
    if (ch === "(" || ch === "[" || ch === "{") stack.push(ch)
    else if (ch === ")" || ch === "]" || ch === "}") {
      if (stack.pop() !== pairs[ch]) return false
    }
  }
  return stack.length === 0
}

export function validateFiles(vfs: VirtualFs, fw: ProjectFramework): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const isAppRouter = fw.router === "app" || fw.router === "src-app"

  for (const path of vfs.list()) {
    if (!/\.(tsx|jsx|ts|js)$/.test(path)) continue
    // Skip Syra-injected, known-good design-system + config files.
    if (path.startsWith("components/ui/") || path === "lib/utils.ts" || path === "next-env.d.ts") continue
    if (/(^|\/)(tailwind|postcss|next)\.config\.[cm]?js$/.test(path)) continue
    const content = vfs.read(path) || ""

    if (!content.trim()) {
      issues.push({ path, level: "error", message: "File is empty." })
      continue
    }

    if (!bracketBalance(content)) {
      issues.push({ path, level: "warning", message: "Possibly unbalanced brackets — review for truncation." })
    }

    // App Router client-component check.
    if (isAppRouter && /\.(tsx|jsx)$/.test(path)) {
      const usesClient = CLIENT_SIGNALS.some((s) => content.includes(s))
      const hasDirective = /^\s*["']use client["']/.test(content)
      const isLayoutOrServerOnly = /generateMetadata|export const metadata/.test(content)
      if (usesClient && !hasDirective && !isLayoutOrServerOnly) {
        issues.push({
          path,
          level: "error",
          message: 'Uses client-only features but is missing the "use client" directive at the top.',
        })
      }
    }

    if (/import\s+[^;]*from\s+["']react["']/.test(content) && content.includes("TODO")) {
      issues.push({ path, level: "warning", message: "Contains a TODO placeholder." })
    }
  }

  // Home page must exist and be non-trivial.
  const home = vfs.read(fw.entryFile)
  if (home == null) {
    issues.push({ path: fw.entryFile, level: "error", message: "Home/entry page was not created." })
  } else if (home.trim().length < 40) {
    issues.push({ path: fw.entryFile, level: "warning", message: "Home page looks too small." })
  }

  return issues
}
