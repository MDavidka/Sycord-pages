import type { ProjectMemory, FileSummary, GeneratedFile, DesignSystem, Diagnostic } from "./types"
import { computeContentHash, computeProjectRevision } from "./cache"

export function buildProjectMemory(
  projectId: string,
  files: GeneratedFile[],
  existingMemory?: ProjectMemory | null,
  diagnostics?: Diagnostic[],
): ProjectMemory {
  const revision = computeProjectRevision(files)
  const now = new Date().toISOString()

  const fileEntries = files.map((f) => ({
    name: f.name,
    contentHash: f.contentHash ?? computeContentHash(f.content),
    size: f.size ?? f.content.length,
    usedFor: f.usedFor ?? "",
    updatedAt: f.updatedAt ?? now,
  }))

  const summaries = files.map((f) => buildFileSummary(f))

  const routeMap = files
    .filter((f) => f.name.startsWith("app/") && (f.name.endsWith("page.tsx") || f.name.endsWith("page.ts")))
    .map((f) => {
      const route = f.name
        .replace(/^app\//, "/")
        .replace(/\/page\.(tsx|ts)$/, "")
        .replace(/\/$/, "")
      return {
        route: route || "/",
        file: f.name,
      }
    })

  const importGraph: Array<{ from: string; to: string }> = []
  for (const file of files) {
    if (file.name.endsWith(".tsx") || file.name.endsWith(".ts") || file.name.endsWith(".jsx") || file.name.endsWith(".js")) {
      const imports = file.content.match(/from\s+["'](\.\/[^"']+|\.\.\/[^"']+|@\/[^"']+)["']/g) || []
      for (const imp of imports) {
        const match = imp.match(/from\s+["']([^"']+)["']/)
        if (match) {
          const importPath = match[1].replace(/^@\//, "")
          const dir = file.name.split("/").slice(0, -1).join("/")
          const resolved = resolveRelativePath(dir, importPath)
          if (files.some((f) => f.name === resolved || f.name === resolved + ".tsx" || f.name === resolved + ".ts")) {
            importGraph.push({ from: file.name, to: resolved })
          }
        }
      }
    }
  }

  const designSystem = buildDesignSystem(files)

  const recentRequests = existingMemory?.recentRequests ?? []

  return {
    version: "syra-memory-v1",
    projectId,
    revision,
    createdAt: existingMemory?.createdAt ?? now,
    updatedAt: now,
    files: fileEntries,
    summaries,
    routeMap,
    importGraph,
    designSystem,
    diagnostics: diagnostics ?? [],
    recentRequests,
    lastGoodBuild: existingMemory?.lastGoodBuild ?? null,
  }
}

export function buildFileSummary(file: GeneratedFile): FileSummary {
  const extensions = file.name.split(".").pop()?.toLowerCase()
  const isLayout = file.name.endsWith("layout.tsx") || file.name.endsWith("layout.ts")
  const isPage = file.name.endsWith("page.tsx") || file.name.endsWith("page.ts")
  const isConfig = file.name.endsWith("json")
  const isStyle = file.name.endsWith("css")
  const isUtility = file.name.includes("utils") || file.name.includes("types")
  const isComponent = file.name.includes("components/")

  const role = isLayout ? "layout"
    : isPage ? "page"
    : isConfig ? "config"
    : isStyle ? "style"
    : isUtility ? "utility"
    : isComponent ? "component"
    : "file"

  const route = file.name
    .replace(/^app\//, "/")
    .replace(/\/page\.(tsx|ts)$/, "")
    .replace(/\/layout\.(tsx|ts)$/, "")
    .replace(/\/$/, "") || null

  const exports = extractExports(file.content)
  const imports = extractImports(file.content)

  const componentNames = file.content.match(/export\s+(?:default\s+)?(?:async\s+)?function\s+(\w+)/g)
    ?.map((m) => m.replace(/export\s+(?:default\s+)?(?:async\s+)?function\s+/, "")) ?? []

  const shadcnMatch = file.content.match(/from\s+["']@\/components\/ui\/([^"']+)["']/g)
  const shadcn = shadcnMatch?.map((m) => {
    const match = m.match(/ui\/([^"']+)/)
    return match?.[1] ?? ""
  }).filter(Boolean) ?? []

  const designTokens: string[] = []
  const tokenMatch = file.content.match(/bg-\w+|text-\w+|border-\w+|ring-\w+|shadow-\w+/g)
  if (tokenMatch) {
    designTokens.push(...tokenMatch.slice(0, 10))
  }

  let summary = ""
  if (isLayout) summary = "Root layout with metadata and providers"
  else if (isPage) summary = `Page at route ${route ?? "/"}`
  else if (isConfig) summary = "Configuration file"
  else if (isStyle) summary = "Global styles and CSS tokens"
  else if (isUtility) summary = "Utility functions and helpers"
  else if (isComponent) summary = `UI component: ${file.name.split("/").pop()}`
  else summary = "Project file"

  return {
    name: file.name,
    role,
    route: route && route !== "/" ? route : isPage ? "/" : null,
    summary,
    exports,
    imports,
    components: componentNames,
    shadcn,
    designTokens,
    lastModified: file.updatedAt ?? new Date().toISOString(),
    contentHash: file.contentHash ?? computeContentHash(file.content),
  }
}

function extractExports(code: string): string[] {
  const exports: string[] = []
  const lines = code.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^export\s+(?:interface|type|enum|const|let|var|function|async\s+function|class|abstract\s+class|default)\s+/.test(trimmed)) {
      let cleaned = trimmed
        .replace(/\{.*$/, "{ ... }")
        .replace(/;$/, "")
        .trim()
      if (cleaned.length < 80) {
        exports.push(cleaned)
      } else {
        exports.push(cleaned.slice(0, 76) + "...")
      }
    }
  }
  return exports.slice(0, 20)
}

function extractImports(code: string): string[] {
  const imports: string[] = []
  const lines = code.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(/^import\s+(?:(?:type\s+)?\{[^}]+\}|(?:type\s+)?\w+)\s+from\s+["']([^"']+)["']/)
    if (match) {
      imports.push(match[1])
    }
  }
  return imports
}

function resolveRelativePath(dir: string, importPath: string): string {
  if (importPath.startsWith("@/")) {
    return importPath.slice(2)
  }
  if (importPath.startsWith("./") || importPath.startsWith("../")) {
    const parts = dir.split("/").filter(Boolean)
    const importParts = importPath.split("/")
    for (const part of importParts) {
      if (part === "..") parts.pop()
      else if (part !== ".") parts.push(part)
    }
    return parts.join("/")
  }
  return importPath
}

function buildDesignSystem(files: GeneratedFile[]): DesignSystem {
  const cssFile = files.find((f) => f.name.endsWith("globals.css") || f.name.endsWith("style.css"))

  const colors: string[] = []
  const fonts: string[] = []
  const radius: string[] = []
  const tailwindPatterns: string[] = []
  let notes = ""

  if (cssFile) {
    const lines = cssFile.content.split("\n")
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith("--")) {
        if (trimmed.includes("color") || trimmed.includes("background") || trimmed.includes("foreground")) {
          colors.push(trimmed)
        } else if (trimmed.includes("radius")) {
          radius.push(trimmed)
        }
      }
      if (trimmed.includes("font-family")) {
        fonts.push(trimmed)
      }
    }
  }

  return {
    colors: colors.length > 0 ? colors : ["--background", "--foreground"],
    fonts,
    radius,
    tailwindPatterns,
    notes,
  }
}
