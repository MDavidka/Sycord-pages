import type { GeneratedFile, ContextPack, FileSummary, Diagnostic } from "./types"
import { computeContentHash, CacheManager } from "./cache"
import type { CacheStats } from "./cache"
import { buildFileSummary } from "./memory"

interface RagOptions {
  maxChars?: number
  prompt?: string
  selectedFile?: string
  diagnostics?: Diagnostic[]
  deployLogs?: string[]
  mode?: string
}

export function buildRagContext(
  files: GeneratedFile[],
  options: RagOptions = {},
): ContextPack {
  const maxChars = options.maxChars ?? 40000
  const prompt = options.prompt ?? ""
  const selectedFile = options.selectedFile
  const diagnostics = options.diagnostics ?? []
  const deployLogs = options.deployLogs ?? []
  const mode = options.mode ?? "generate"

  const promptLower = prompt.toLowerCase()

  const scored: Array<{ file: GeneratedFile; score: number }> = files.map((file) => {
    let score = 0
    const nameLower = file.name.toLowerCase()

    // +40 if filename/path mentioned in prompt
    if (promptLower.includes(nameLower)) score += 40

    // +35 if route matches prompt
    const routeMatch = file.name.match(/^app\/(.*?)\/(?:page|layout)\./)
    if (routeMatch) {
      const route = routeMatch[1].toLowerCase()
      if (promptLower.includes(route)) score += 35
    }

    // +30 if file has previous diagnostic
    if (diagnostics.some((d) => d.file === file.name)) score += 30

    // +25 for layout/globals/utils/types/package
    if (
      file.name.endsWith("layout.tsx") ||
      file.name.endsWith("layout.ts") ||
      file.name.endsWith("globals.css") ||
      file.name.includes("utils.ts") ||
      file.name.includes("types.ts") ||
      file.name === "package.json" ||
      file.name === "tsconfig.json"
    ) {
      score += 25
    }

    // +20 if recently modified
    if (file.updatedAt) {
      const updated = new Date(file.updatedAt).getTime()
      const oneHour = 3600000
      if (Date.now() - updated < oneHour * 4) score += 20
    }

    // +15 semantic keywords match
    const keywords = extractKeywords(prompt)
    for (const kw of keywords) {
      if (nameLower.includes(kw)) {
        score += 15
        break
      }
    }

    // +10 same folder as selected file
    if (selectedFile) {
      const selectedDir = selectedFile.split("/").slice(0, -1).join("/")
      const fileDir = file.name.split("/").slice(0, -1).join("/")
      if (selectedDir && fileDir === selectedDir) score += 10
    }

    // +50 for explicitly selected file
    if (selectedFile && file.name === selectedFile) score += 50

    return { file, score }
  })

  scored.sort((a, b) => b.score - a.score)

  let totalChars = 0
  const fullFiles: GeneratedFile[] = []
  const summaryFiles: FileSummary[] = []
  const fileSummaryHits = 0
  const fileSummaryMisses = 0

  for (const { file } of scored) {
    if (totalChars + file.content.length <= maxChars) {
      fullFiles.push(file)
      totalChars += file.content.length
    } else {
      const summary = getOrCreateFileSummary(file)
      summaryFiles.push(summary)
    }
  }

  // Ensure mandatory files are always in fullFiles
  const mandatoryNames = ["package.json", "tsconfig.json", "app/globals.css", "app/layout.tsx", "app/page.tsx", "lib/utils.ts"]
  for (const name of mandatoryNames) {
    if (!fullFiles.some((f) => f.name === name)) {
      const file = files.find((f) => f.name === name)
      if (file) {
        fullFiles.push(file)
      }
    }
  }

  // Build route map
  const routeMap = files
    .filter((f) => f.name.startsWith("app/") && (f.name.endsWith("page.tsx") || f.name.endsWith("page.ts")))
    .map((f) => ({
      route: f.name.replace(/^app\//, "/").replace(/\/page\.(tsx|ts)$/, "").replace(/\/$/, "") || "/",
      file: f.name,
    }))

  // Build import graph (simplified)
  const importGraph: Array<{ from: string; to: string }> = []
  for (const file of files) {
    if (file.name.endsWith(".tsx") || file.name.endsWith(".ts")) {
      const imports = file.content.match(/from\s+["'](\.\/[^"']+|\.\.\/[^"']+|@\/[^"']+)["']/g) || []
      for (const imp of imports) {
        const match = imp.match(/from\s+["']([^"']+)["']/)
        if (match) {
          importGraph.push({ from: file.name, to: match[1] })
        }
      }
    }
  }

  // Get available shadcn components
  const shadcnComponents = new Set<string>()
  for (const file of fullFiles) {
    const matches = file.content.match(/from\s+["']@\/components\/ui\/([^"']+)["']/g)
    if (matches) {
      for (const m of matches) {
        const match = m.match(/ui\/([^"']+)/)
        if (match) shadcnComponents.add(match[1])
      }
    }
  }

  const designSystem = fullFiles.find((f) => f.name.endsWith("globals.css") || f.name.endsWith("style.css"))
    ? {
      colors: [],
      fonts: [],
      radius: [],
      tailwindPatterns: [],
      notes: "Extracted from globals.css",
    }
    : {
      colors: [],
      fonts: [],
      radius: [],
      tailwindPatterns: [],
      notes: "",
    }

  const cacheStats: CacheStats = {
    systemPromptHit: false,
    cheatsheetHit: false,
    memoryHit: false,
    fileSummaryHits,
    fileSummaryMisses,
    planHit: false,
  }

  return {
    fullFiles,
    summaryFiles,
    designSystem,
    routeMap,
    importGraph,
    availableShadcnComponents: [...shadcnComponents],
    dependencyReport: "",
    diagnostics,
    cacheStats,
  }
}

function extractKeywords(prompt: string): string[] {
  const cleaned = prompt.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return cleaned.split(" ").filter((w) => w.length > 3)
}

function getOrCreateFileSummary(file: GeneratedFile): FileSummary {
  const contentHash = file.contentHash ?? computeContentHash(file.content)

  const cached = CacheManager.getFileSummary(contentHash)
  if (cached) return cached as FileSummary

  return buildFileSummary(file)
}
