import { createHash } from "crypto"
import type { GeneratedFile, ProjectMemory } from "@/lib/ai/types"
import { fileSummaryCache, cacheKey } from "@/lib/ai/cache"

export const NEXTJS_CORE_FILES = [
  "package.json",
  "tsconfig.json",
  "app/globals.css",
  "app/layout.tsx",
  "app/page.tsx",
  "lib/utils.ts",
] as const

export const NEXTJS_STRUCTURE = `
project/
├── package.json
├── tsconfig.json
├── next.config.mjs
├── app/
│   ├── globals.css
│   ├── layout.tsx          (root layout with metadata)
│   ├── page.tsx             (homepage)
│   └── [route]/
│       └── page.tsx         (route pages)
├── components/
│   └── ui/                  (shadcn/ui components)
├── lib/
│   ├── utils.ts             (cn() utility)
│   └── types.ts             (shared types)
└── public/                  (static assets)
`

export const GENERATION_ORDER = [
  "package.json",
  "tsconfig.json",
  "lib/utils.ts",
  "lib/types.ts",
  "app/globals.css",
  "app/layout.tsx",
  "app/page.tsx",
  "components/",
  "public/",
]

export function contentHash(content: string): string {
  return createHash("md5").update(content).digest("hex").slice(0, 12)
}

export function extractExportSummary(code: string): { exports: string[]; imports: string[] } {
  const exports: string[] = []
  const imports: string[] = []
  const lines = code.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^export\s+(default\s+)?(async\s+)?(function|const|let|var|class|interface|type|enum)\s+/.test(trimmed)) {
      exports.push(trimmed.replace(/\{.*$/, "").replace(/;$/, "").trim())
    }
    if (/^import\s+/.test(trimmed)) {
      imports.push(trimmed)
    }
  }
  return { exports, imports }
}

export function extractDesignSystem(files: GeneratedFile[]): ProjectMemory["designSystem"] {
  const cssFile = files.find(f => f.name.endsWith("globals.css") || f.name.endsWith("style.css"))
  const tokens: string[] = []
  const colors: string[] = []
  const fonts: string[] = []
  if (cssFile) {
    const lines = cssFile.content.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (/^--[\w-]+\s*:/.test(trimmed)) {
        tokens.push(trimmed)
        if (/color|bg-|text-|border-/.test(trimmed)) colors.push(trimmed)
        if (/font|family/.test(trimmed)) fonts.push(trimmed)
      }
    }
  }
  return {
    tokens,
    colors,
    fonts,
    radius: "",
    layoutRules: [],
  }
}

export function buildImportGraph(files: GeneratedFile[]): Record<string, string[]> {
  const graph: Record<string, string[]> = {}
  for (const file of files) {
    const imports: string[] = []
    const matches = file.content.matchAll(/from\s+["'](@\/[^"']+)["']/g)
    for (const m of matches) imports.push(m[1])
    graph[file.name] = imports
  }
  return graph
}

export function buildRouteMap(files: GeneratedFile[]): Record<string, string> {
  const routes: Record<string, string> = {}
  for (const file of files) {
    if (file.name === "app/page.tsx") routes["/"] = file.name
    else if (file.name.startsWith("app/") && file.name.endsWith("/page.tsx")) {
      const route = file.name.replace("app/", "").replace("/page.tsx", "").replace(/\([^)]+\)/g, "").replace(/\[([^\]]+)\]/g, ":$1")
      routes[route || "/"] = file.name
    }
  }
  return routes
}

export function getSmartContext(files: GeneratedFile[], currentTask: string): string {
  if (!files || files.length === 0) return "No files generated yet."
  const coreFiles = files.filter(f => NEXTJS_CORE_FILES.includes(f.name as any))
  const taskFiles = currentTask
    ? files.filter(f => f.name.toLowerCase().includes(currentTask.toLowerCase()))
    : []
  const recentFiles = [...files].sort((a, b) => (b.usedFor ? 1 : 0) - (a.usedFor ? 1 : 0)).slice(0, 5)
  const included = new Map<string, GeneratedFile>()
  for (const f of [...coreFiles, ...taskFiles, ...recentFiles]) included.set(f.name, f)
  const otherFiles = files.filter(f => !included.has(f.name))
  let context = "KEY FILES (full content):\n"
  for (const [, file] of included) {
    const { exports } = extractExportSummary(file.content)
    const hash = contentHash(file.content)
    const cached = fileSummaryCache.get(hash)
    if (cached) {
      context += `\n--- ${file.name} (cached) ---\n${cached}\n`
    } else {
      context += `\n--- ${file.name} (${file.usedFor || "unknown"}) ---\n${file.content}\n`
      fileSummaryCache.set(hash, exports.slice(0, 10).join("\n"), 15 * 60 * 1000)
    }
  }
  if (otherFiles.length > 0) {
    context += "\nOTHER FILES (names only):\n"
    for (const f of otherFiles) context += `- ${f.name} (${f.usedFor || "unknown"})\n`
  }
  return context
}

export function buildProjectMemory(files: GeneratedFile[], revision: string, lastGoodBuild: string | null, recentRequests: string[], recentDiagnostics: string[]): ProjectMemory {
  const designSystem = extractDesignSystem(files)
  const importGraph = buildImportGraph(files)
  const routeMap = buildRouteMap(files)
  return {
    revision,
    files: files.map(f => ({
      name: f.name,
      contentHash: contentHash(f.content),
      usedFor: f.usedFor,
      updatedAt: new Date().toISOString(),
      size: f.content.length,
    })),
    summaries: files.map(f => {
      const { exports, imports } = extractExportSummary(f.content)
      const route = routeMap[f.name] ? Object.entries(routeMap).find(([, v]) => v === f.name)?.[0] || "n/a" : "n/a"
      const role = f.name.startsWith("app/") ? "page" : f.name.startsWith("components/") ? "component" : f.name.startsWith("lib/") ? "utility" : "other"
      return { name: f.name, summary: f.usedFor, exports, imports, route, role }
    }),
    designSystem,
    importGraph,
    routeMap,
    lastGoodBuild,
    recentUserRequests: recentRequests.slice(-10),
    recentDiagnostics: recentDiagnostics.slice(-10),
  }
}
