// Lightweight static validation for generated files.
//
// This is intentionally heuristic (no full TS compile) but catches the mistakes
// the model most often makes: missing "use client" for interactive App Router
// components, an empty/missing home page, unbalanced brackets, and — most
// importantly — broken imports (wrong path, wrong capitalization, or a named
// export that doesn't exist). Fatal issues trigger automated repair rounds.

import type { ProjectFramework } from "./types"
import type { VirtualFs } from "./vfs"
import { SHADCN_EXPORTS } from "./shadcn"

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

/** Resolve a relative/aliased import to an existing VFS file (case-sensitive). */
function resolveModule(
  vfs: VirtualFs,
  fromPath: string,
  spec: string,
): "ok" | "external" | "unresolved" | { caseMismatch: string } {
  let base: string
  if (spec.startsWith("@/")) base = spec.slice(2)
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : ""
    const stack = dir ? dir.split("/") : []
    for (const seg of spec.split("/")) {
      if (seg === "" || seg === ".") continue
      if (seg === "..") stack.pop()
      else stack.push(seg)
    }
    base = stack.join("/")
  } else {
    return "external" // bare package import — handled by package.json
  }
  const exts = ["", ".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs", ".css", ".json", ".svg"]
  const indexes = ["/index.tsx", "/index.ts", "/index.jsx", "/index.js"]
  const candidates = [...exts.map((e) => base + e), ...indexes.map((e) => base + e)]
  for (const c of candidates) if (vfs.exists(c)) return "ok"
  // Case-insensitive fallback to detect capitalization mistakes.
  const lower = new Map(vfs.list().map((p) => [p.toLowerCase(), p]))
  for (const c of candidates) {
    const hit = lower.get(c.toLowerCase())
    if (hit) return { caseMismatch: hit }
  }
  return "unresolved"
}

/** Extract { specifier, importedNames } from a source file. */
function extractImports(src: string): { spec: string; names: string[] }[] {
  const out: { spec: string; names: string[] }[] = []
  const parseNamed = (clause: string): string[] => {
    const names: string[] = []
    const braced = clause.match(/\{([^}]*)\}/)
    if (braced) {
      for (const part of braced[1].split(",")) {
        const t = part.trim().replace(/^type\s+/, "")
        if (!t) continue
        const name = t.split(/\s+as\s+/)[0].trim()
        if (name) names.push(name)
      }
    }
    return names
  }
  let m: RegExpExecArray | null
  const re1 = /(?:import|export)\s+([\s\S]*?)\s+from\s*["']([^"']+)["']/g
  while ((m = re1.exec(src))) out.push({ spec: m[2], names: parseNamed(m[1]) })
  const re2 = /import\s*["']([^"']+)["']/g
  while ((m = re2.exec(src))) out.push({ spec: m[1], names: [] })
  const re3 = /(?:require|import)\(\s*["']([^"']+)["']\s*\)/g
  while ((m = re3.exec(src))) out.push({ spec: m[1], names: [] })
  return out
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

    // Import resolution — the #1 cause of build failures.
    for (const { spec, names } of extractImports(content)) {
      // Known design-system module: verify the named exports exist.
      const exportsForModule = SHADCN_EXPORTS[spec]
      if (exportsForModule) {
        const valid = new Set(exportsForModule)
        for (const n of names) {
          if (!valid.has(n)) {
            issues.push({
              path,
              level: "error",
              message: `"${n}" is not exported by ${spec}. Available: ${exportsForModule.join(", ")}.`,
            })
          }
        }
        continue
      }
      const r = resolveModule(vfs, path, spec)
      if (r === "unresolved") {
        issues.push({
          path,
          level: "error",
          message: `Import "${spec}" cannot be resolved — that file does not exist. Create it or fix the path.`,
        })
      } else if (typeof r === "object") {
        const fixed = r.caseMismatch.replace(/\.(tsx|ts|jsx|js)$/, "")
        issues.push({
          path,
          level: "error",
          message: `Import "${spec}" has wrong capitalization/path. The actual file is "${r.caseMismatch}" — import it exactly (e.g. "@/${fixed}").`,
        })
      }
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
