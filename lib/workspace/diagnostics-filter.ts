export type DiagnosticEntry = { file: string; line: number; message: string }

/** TS codes that are almost always sandbox/environment noise (no node_modules in sandbox). */
const IGNORED_TS_CODES = new Set<number>([
  2307, // Cannot find module — filtered selectively below
  7016, // Missing declaration file for untyped npm package
  2792, // Cannot find module (moduleResolution)
  6142, // Module resolved but jsx not set
  2305, // Module has no exported member (often untyped dep)
  2304, // Cannot find name — filtered selectively (React/JSX globals)
  2503, // Cannot find namespace 'React'
  2686, // React UMD global
  2790, // Type-only import issues from missing types
])

const PROJECT_PATH_PREFIXES = ["app/", "components/", "lib/", "hooks/", "src/", "pages/"]

function normalizePath(file: string): string {
  return file.replace(/\\/g, "/").replace(/^\/+/, "")
}

function isProjectSourceFile(file: string): boolean {
  const norm = normalizePath(file)
  if (!/\.(tsx?|jsx?)$/.test(norm)) return false
  if (norm.includes("node_modules/")) return false
  if (norm.startsWith(".next/")) return false
  return PROJECT_PATH_PREFIXES.some((p) => norm.startsWith(p)) || !norm.includes("/")
}

function shouldReportMissingModule(message: string): boolean {
  const match = message.match(/Cannot find module '([^']+)'/)
  if (!match) return false
  const mod = match[1]
  return mod.startsWith("@/components/ui/") || mod.startsWith("@/lib/") || mod.startsWith("@/hooks/")
}

function shouldReportMissingName(message: string): boolean {
  // Keep errors about user's own symbols; drop global/React noise from missing @types/react.
  if (!/Cannot find name '/.test(message)) return false
  const match = message.match(/Cannot find name '([^']+)'/)
  if (!match) return false
  const name = match[1]
  const envGlobals = new Set(["React", "JSX", "NodeJS", "Request", "Response", "Headers"])
  return !envGlobals.has(name)
}

function isEnvironmentalMessage(message: string): boolean {
  const lower = message.toLowerCase()
  if (lower.includes("node_modules")) return true
  if (/cannot find module '@types\//.test(message)) return true
  if (/could not find a declaration file for module '(@radix-ui|next|react)/.test(message)) return true
  if (lower.includes("esModuleInterop")) return true
  if (lower.includes("--jsx")) return true
  return false
}

export function isIgnoredDiagnostic(code: number, message: string): boolean {
  if (code === 2307 && shouldReportMissingModule(message)) return false
  if (code === 2304 && shouldReportMissingName(message)) return false
  if (isEnvironmentalMessage(message)) return true
  return IGNORED_TS_CODES.has(code)
}

/** Keep only errors Syra can fix in the user's project source (not sandbox/npm noise). */
export function filterActionableDiagnostics(
  errors: DiagnosticEntry[],
  projectFiles?: string[],
): DiagnosticEntry[] {
  const projectSet = new Set((projectFiles ?? []).map(normalizePath))

  return errors.filter((entry) => {
    const file = normalizePath(entry.file)
    if (!isProjectSourceFile(file)) return false

    if (projectSet.size > 0 && !projectSet.has(file)) {
      // Allow components/ui paths even if not in explicit list (registry installs)
      if (!file.startsWith("components/ui/")) return false
    }

    if (entry.message.includes("addShadcnComponent")) return true
    if (isEnvironmentalMessage(entry.message)) return false

    const modMatch = entry.message.match(/Cannot find module '([^']+)'/)
    if (modMatch) {
      const mod = modMatch[1]
      if (!mod.startsWith("@/") && !mod.startsWith(".")) return false
    }

    return true
  })
}

export function formatDiagnosticsForAI(errors: DiagnosticEntry[]): string {
  if (errors.length === 0) {
    return "[SYSTEM] ✅ TypeScript check passed: No actionable errors in your project source."
  }

  const lines = errors
    .slice(0, 40)
    .map((e) => `  ${normalizePath(e.file)}:${e.line} — ${e.message}`)
    .join("\n")

  return (
    `[SYSTEM] Found ${errors.length} actionable error(s) in YOUR project files (environment/npm noise filtered out):\n` +
    `${lines}\n\n` +
    "Fix these in your source files, then run typeCheck() again. " +
    "Do NOT run npm install — add packages by editing package.json if needed."
  )
}
