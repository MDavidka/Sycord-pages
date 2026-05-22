// Post-generation syntax linting and import repair for generated TSX.
//
// Handles four critical deployment-breaking issues:
//   1. Duplicate imports — merges into existing import lines instead of appending
//   2. Case sensitivity — forces all @/components/ui/* paths to lowercase (Linux-compatible)
//   3. Lucide-react barrel conflicts — merges ALL lucide-react imports into one line
//   4. Sub-component grouping — CardHeader/CardTitle/CardFooter all live in card.tsx
//
// Also fixes common AI syntax errors:
//   - Single-quotes wrapped in double braces:  className={{'...'}}
//   - JSX components used without an import
//   - Backtick nesting inside template literals
//   - `class=` instead of `className=`, `for=` instead of `htmlFor=`
//   - Duplicate attribute names

import type { BuilderFile } from "./types"

export interface LintResult {
  fixed: string[]
  missingImports: string[]
  warnings: string[]
}

// ---- Component-to-File Registry ----
// Maps every shadcn component (including sub-components) to its actual
// parent file on disk. This is the single source of truth for where
// components live — the AI never guesses paths.
//
// shadcn/ui file structure:
//   components/ui/card.tsx     → exports Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
//   components/ui/avatar.tsx   → exports Avatar, AvatarImage, AvatarFallback
//   components/ui/accordion.tsx→ exports Accordion, AccordionItem, AccordionTrigger, AccordionContent
//   ...etc

const COMPONENT_REGISTRY: Record<string, string> = {
  // Single-file components (component name === file name)
  "Button": "button",
  "Badge": "badge",
  "Input": "input",
  "Textarea": "textarea",
  "Label": "label",
  "Separator": "separator",
  "Checkbox": "checkbox",
  "Switch": "switch",
  "Skeleton": "skeleton",
  "Progress": "progress",
  // Card family — all live in card.tsx
  "Card": "card",
  "CardHeader": "card",
  "CardTitle": "card",
  "CardDescription": "card",
  "CardContent": "card",
  "CardFooter": "card",
  // Avatar family — all live in avatar.tsx
  "Avatar": "avatar",
  "AvatarImage": "avatar",
  "AvatarFallback": "avatar",
  // Accordion family — all live in accordion.tsx
  "Accordion": "accordion",
  "AccordionItem": "accordion",
  "AccordionTrigger": "accordion",
  "AccordionContent": "accordion",
  // Tabs family — all live in tabs.tsx
  "Tabs": "tabs",
  "TabsList": "tabs",
  "TabsTrigger": "tabs",
  "TabsContent": "tabs",
  // Select family — all live in select.tsx
  "Select": "select",
  "SelectTrigger": "select",
  "SelectValue": "select",
  "SelectContent": "select",
  "SelectItem": "select",
  "SelectGroup": "select",
  // Alert family — all live in alert.tsx
  "Alert": "alert",
  "AlertTitle": "alert",
  "AlertDescription": "alert",
  // Dialog family — all live in dialog.tsx
  "Dialog": "dialog",
  "DialogTrigger": "dialog",
  "DialogContent": "dialog",
  "DialogHeader": "dialog",
  "DialogTitle": "dialog",
  "DialogDescription": "dialog",
  // Table family — all live in table.tsx
  "Table": "table",
  "TableHeader": "table",
  "TableBody": "table",
  "TableRow": "table",
  "TableHead": "table",
  "TableCell": "table",
  // Sheet family — all live in sheet.tsx
  "Sheet": "sheet",
  "SheetTrigger": "sheet",
  "SheetContent": "sheet",
  // Breadcrumb family — all live in breadcrumb.tsx
  "Breadcrumb": "breadcrumb",
  "BreadcrumbList": "breadcrumb",
  "BreadcrumbItem": "breadcrumb",
  "BreadcrumbLink": "breadcrumb",
  // Pagination family — all live in pagination.tsx
  "Pagination": "pagination",
  "PaginationContent": "pagination",
  "PaginationPrevious": "pagination",
  "PaginationNext": "pagination",
  "PaginationItem": "pagination",
  "PaginationLink": "pagination",
  // Tooltip family — all live in tooltip.tsx
  "Tooltip": "tooltip",
  "TooltipTrigger": "tooltip",
  "TooltipContent": "tooltip",
  // HoverCard family — all live in hover-card.tsx
  "HoverCard": "hover-card",
  "HoverCardTrigger": "hover-card",
  "HoverCardContent": "hover-card",
}

// Derive: all known component tag names
const SHADCN_TAGS = new Set(Object.keys(COMPONENT_REGISTRY))

// Non-shadcn tags that map to known modules
const KNOWN_TAGS: Record<string, { from: string; named: boolean }> = {
  "Link": { from: "next/link", named: false },
  "Image": { from: "next/image", named: false },
}

// All lucide-react icons we might encounter
const LUCIDE_ICONS = new Set([
  "Check", "ChevronRight", "ChevronDown", "ChevronUp",
  "ArrowRight", "ArrowUpRight", "ArrowLeft", "ArrowUp",
  "BarChart3", "LineChart", "TrendingUp",
  "X", "Menu", "Star", "Heart", "Crown",
  "Sparkles", "Zap", "Rocket", "Flame",
  "ShieldCheck", "Shield", "Lock",
  "Globe", "Map", "MapPin", "Compass", "Target",
  "Mail", "Phone", "MessageCircle", "MessageSquare",
  "Users", "User", "UserPlus",
  "Search", "Filter", "Sliders",
  "Sun", "Moon", "Cloud", "Rainbow",
  "Code2", "Wand2", "Brush", "Palette", "Layers",
  "Play", "Pause", "Volume2",
  "Download", "Upload", "Share2",
  "Plus", "Minus", "ExternalLink",
  "Info", "AlertTriangle", "AlertCircle",
  "Calendar", "Clock", "Timer",
  "CreditCard", "DollarSign", "ShoppingCart", "ShoppingBag", "Package",
  "FileText", "Folder", "Database",
  "Settings", "Wrench", "Camera", "Video",
])

// ---- Public API ----

export function lintAndRepairFile(file: BuilderFile): { content: string; result: LintResult } {
  let content = file.content
  if (!content.trim()) return { content, result: { fixed: [], missingImports: [], warnings: [] } }

  const result: LintResult = { fixed: [], missingImports: [], warnings: [] }

  // Phase 1: Fix syntax errors in the body
  content = fixSyntaxErrors(content, result)

  // Phase 2: Fix import block — lowercase paths, deduplicate, merge barrels
  content = fixImports(content, result)

  return { content, result }
}

export function lintAllFiles(files: BuilderFile[], log?: (msg: string) => void): BuilderFile[] {
  const out: BuilderFile[] = []
  for (const file of files) {
    const { content, result } = lintAndRepairFile(file)
    if (result.fixed.length > 0) {
      log?.(`lint [${file.path}]: fixed ${result.fixed.join(", ")}`)
    }
    if (result.missingImports.length > 0) {
      log?.(`lint [${file.path}]: injected imports for ${result.missingImports.join(", ")}`)
    }
    if (result.warnings.length > 0) {
      log?.(`lint [${file.path}]: warnings — ${result.warnings.join("; ")}`)
    }
    out.push({ path: file.path, content })
  }
  return out
}

// ---- Syntax fixers ----

function fixSyntaxErrors(content: string, result: LintResult): string {
  // Fix: className={{'...'}} → className="..."
  content = content.replace(
    /className=\{\{'(.*?)'\}\}/g,
    (_full: string, inner: string) => {
      result.fixed.push(`className={{'...'}} → className="..."`)
      return `className="${inner.replace(/"/g, "&quot;")}"`
    },
  )

  // Fix: className={{"... ..."}} → className="..."
  content = content.replace(
    /className=\{\{"(.*?)"\}\}/g,
    (_full: string, inner: string) => {
      result.fixed.push(`className={{"..."}} → className="..."`)
      const cleaned = inner.replace(/\\"/g, '"').replace(/['`]/g, "").replace(/\$\{[^}]+\}/g, "").trim()
      return cleaned ? `className="${cleaned}"` : `className=""`
    },
  )

  // Fix: Duplicate className on same element
  const dupClassNames = content.match(/className="[^"]*"\s+className="[^"]*"/g)
  if (dupClassNames) {
    for (const dup of dupClassNames) {
      const first = dup.match(/(className="[^"]*")/)?.[1] ?? ""
      content = content.replace(dup, first)
    }
    result.fixed.push("duplicate className removed")
  }

  // Fix: class= → className=
  if (/\bclass=/.test(content) && !/\bclassName=/.test(content)) {
    const count = (content.match(/\bclass=/g) || []).length
    content = content.replace(/\bclass=/g, "className=")
    result.fixed.push(`class= → className= (${count}x)`)
  }

  // Fix: for= → htmlFor= in JSX context
  const forMatches = content.match(/\bfor="/g)
  if (forMatches && forMatches.length > 0) {
    content = content.replace(/\bfor="/g, `htmlFor="`)
    result.fixed.push(`for= → htmlFor= (${forMatches.length}x)`)
  }

  // Fix: Empty style={{}} → remove
  const styleCount = (content.match(/\s+style=\{\{\}\}/g) || []).length
  if (styleCount > 0) {
    content = content.replace(/\s+style=\{\{\}\}/g, "")
    result.fixed.push(`removed empty style={{}} (${styleCount}x)`)
  }

  // Fix: Orphan keys — key={i} or key={index} on elements not inside a .map()
  // The AI often copies key={i} from loop templates into static JSX blocks
  // where the variable i doesn't exist, causing TS2304: Cannot find name 'i'.
  content = fixOrphanKeys(content, result)

  return content
}

// ---- Orphan key detection ----
// Finds key={X} where X is a loop variable (i, index, etc.) but the element
// is NOT inside a .map() callback. Strips the orphan key attribute.

const LOOP_VARIABLES = new Set(["i", "index", "idx", "item", "row", "col", "cell", "el", "entry", "v", "x", "k"])

function fixOrphanKeys(content: string, result: LintResult): string {
  const lines = content.split("\n")
  let fixed = 0

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const line = lines[lineNum]

    // Match key={varname} — both curly braces and string forms
    const keyMatch = line.match(/\bkey=\{(\w+)\}/)
    if (!keyMatch) continue
    const varName = keyMatch[1]
    if (!LOOP_VARIABLES.has(varName)) continue

    // Search backwards for a .map( callback that introduces this variable
    if (!hasEnclosingMap(lines, lineNum, varName)) {
      // Strip the orphan key — replace key={varname} (with optional surrounding space)
      lines[lineNum] = line.replace(/\s*key=\{(\w+)\}\s*/, " ").replace(/\s{2,}/g, " ").trimEnd()
      // Also fix trailing " >" → ">"
      lines[lineNum] = lines[lineNum].replace(/\s+>/g, ">").replace(/>\s+$/g, ">")
      if (lines[lineNum].trim() === "") lines[lineNum] = ""
      fixed++
    }
  }

  if (fixed > 0) {
    result.fixed.push(`stripped ${fixed} orphan key={var} not in .map()`)
  }

  return lines.join("\n")
}

function hasEnclosingMap(lines: string[], startLine: number, varName: string): boolean {
  // Look backwards up to 30 lines for a .map(( pattern that introduces varName
  const searchStart = Math.max(0, startLine - 30)
  let depth = 0

  for (let i = startLine; i >= searchStart; i--) {
    const line = lines[i]

    // Track function scope boundaries — if we hit a function/export keyword,
    // we've left the JSX scope and can stop
    if (/^(export |function |const \w+ = \(.*\) =>|const \w+ = function)/.test(line.trim()) && depth === 0) {
      return false
    }

    // Track brace depth
    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length
    depth += opens - closes

    // Look for .map((item, i) => or .map((item, index) =>
    const mapMatch = line.match(/\.map\(\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)/)
    if (mapMatch && (mapMatch[2] === varName || mapMatch[1] === varName)) {
      return true
    }

    // Also match single-param .map((item) =>
    const singleMatch = line.match(/\.map\(\s*\(\s*(\w+)\s*\)/)
    if (singleMatch && singleMatch[1] === varName) {
      return true
    }

    // JSX .map pattern: {items.map((item, i) => ...
    const jsxMatch = line.match(/\.map\(\s*\(\s*(\w+)\s*,?\s*(\w*)\s*\)\s*=>/)
    if (jsxMatch && (jsxMatch[2] === varName || jsxMatch[1] === varName)) {
      return true
    }
  }

  return false
}

// ---- Import repair — the core fixer for all three issues ----

function fixImports(content: string, result: LintResult): string {
  const lines = content.split("\n")

  // Find import/export block boundaries
  let preambleEnd = 0
  let importStart = -1
  let importEnd = -1
  let bodyStart = lines.length

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (line.startsWith('"use client"') || line.startsWith("'use client'")) {
      preambleEnd = i + 1
      continue
    }
    if (line.startsWith("import ") || line.startsWith("export type {")) {
      if (importStart === -1) importStart = i
      importEnd = i
      continue
    }
    if (importEnd !== -1 && line.length > 0 && !line.startsWith("import ") && !line.startsWith("export type {")) {
      bodyStart = i
      break
    }
  }

  if (importStart === -1) return content
  if (importEnd < importStart) importEnd = importStart

  const preamble = lines.slice(0, preambleEnd).join("\n")
  const importLines = lines.slice(importStart, importEnd + 1)
  const body = lines.slice(bodyStart).join("\n")

  // Parse existing imports
  const existing = parseImportBlock(importLines)

  // Scan body for used JSX component tags
  const usedTags = findUsedComponentTags(body)

  // Determine what's missing
  const missing = computeMissing(usedTags, existing)

  if (missing.length === 0) {
    // Still check for case issues in existing paths
    const fixedLines = lowercaseShadcnPaths(importLines)
    const hasPathFix = fixedLines.some((l, i) => l !== importLines[i])
    if (!hasPathFix) return content
    const fixed = [...lines.slice(0, importStart), ...fixedLines, ...lines.slice(importEnd + 1)]
    result.fixed.push("lowercased shadcn import paths")
    return fixed.join("\n")
  }

  // Merge missing tags into existing import lines
  let hasMerge = false
  for (const miss of missing) {
    const wasMerged = mergeIntoExisting(miss, existing)
    if (wasMerged) hasMerge = true
  }

  // Rebuild import block from the merged existing state
  const rebuiltLines = importLinesFromExisting(existing)
  const rebuiltBlock = rebuiltLines.join("\n")

  // Count injected
  const allImported = new Set<string>()
  for (const imp of existing) {
    for (const tag of imp.tags) allImported.add(tag)
  }
  for (const miss of missing) {
    if (!allImported.has(miss)) {
      result.missingImports.push(miss)
    }
  }

  const before = preamble ? preamble + "\n" : ""
  return before + rebuiltBlock + "\n\n" + body
}

// ---- Helper: resolve a component tag to its canonical @/components/ui/<file> path ----

function resolveComponentFile(tag: string): string | null {
  const file = COMPONENT_REGISTRY[tag]
  if (!file) return null
  return `@/components/ui/${file}`
}

// Normalize any @/components/ui/* path to its canonical lowercase form,
// resolving sub-component imports to their parent file.
function normalizeImportPath(path: string): string {
  const uiMatch = path.match(/^@\/components\/ui\/(.+)$/)
  if (!uiMatch) return path
  const name = uiMatch[1].toLowerCase()
  // Check if this path matches a known parent file in the registry.
  // If multiple tags map to the same file, resolve to that file.
  for (const [tag, file] of Object.entries(COMPONENT_REGISTRY)) {
    if (file === name) return `@/components/ui/${file}`
  }
  // Fallback: lowercase only (handles unknown UI components gracefully)
  return `@/components/ui/${name}`
}

// ---- Import data model ----

interface ImportEntry {
  from: string        // canonical path (normalized)
  named: boolean      // true = import { X, Y }, false = import X
  tags: string[]      // imported symbols
  originalLine: string
}

function parseImportBlock(lines: string[]): ImportEntry[] {
  const entries: ImportEntry[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed.startsWith("import ")) continue

    const namedMatch = trimmed.match(/^import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/)
    if (namedMatch) {
      const tags = namedMatch[1].split(",").map((s) => s.replace(/^type\s+/, "").trim()).filter(Boolean)
      entries.push({ from: normalizeImportPath(namedMatch[2]), named: true, tags, originalLine: line })
      continue
    }

    const defaultMatch = trimmed.match(/^import\s+([A-Za-z0-9_]+)\s+from\s+["']([^"']+)["']/)
    if (defaultMatch) {
      entries.push({ from: defaultMatch[2], named: false, tags: [defaultMatch[1]], originalLine: line })
      continue
    }

    const starMatch = trimmed.match(/^import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/)
    if (starMatch) {
      entries.push({ from: starMatch[2], named: false, tags: [starMatch[1]], originalLine: line })
      continue
    }
  }

  return entries
}

function importLinesFromExisting(existing: ImportEntry[]): string[] {
  // Step 1: Re-group ALL shadcn entries by their canonical parent file.
  // This fixes AI-generated imports like:
  //   import { CardHeader } from "@/components/ui/cardheader"  // wrong file!
  //   import { CardContent } from "@/components/ui/cardcontent" // wrong file!
  // into:
  //   import { CardHeader, CardContent } from "@/components/ui/card"

  const byFile = new Map<string, { named: boolean; tags: Set<string>; defaultTag?: string }>()

  // Lucide-react gets special handling
  let lucideTags = new Set<string>()
  let hasLucideDefault = false

  for (const entry of existing) {
    if (entry.from === "lucide-react") {
      if (entry.named) {
        for (const t of entry.tags) lucideTags.add(t)
      } else {
        hasLucideDefault = true
      }
      continue
    }

    const from = normalizeImportPath(entry.from)
    if (!byFile.has(from)) {
      byFile.set(from, { named: entry.named, tags: new Set() })
    }
    const group = byFile.get(from)!
    for (const t of entry.tags) group.tags.add(t)
    if (!entry.named && entry.tags[0]) {
      group.defaultTag = entry.tags[0]
    }
  }

  const out: string[] = []

  // Emit lucide-react as one merged line
  if (lucideTags.size > 0) {
    out.push(`import { ${[...lucideTags].sort().join(", ")} } from "lucide-react"`)
  }
  if (hasLucideDefault) {
    out.push(`import LucideIcon from "lucide-react"`)
  }

  // Emit non-lucide imports grouped by canonical file
  for (const [from, group] of byFile) {
    if (group.named) {
      const sorted = [...group.tags].sort()
      out.push(`import { ${sorted.join(", ")} } from "${from}"`)
    } else if (group.defaultTag) {
      out.push(`import ${group.defaultTag} from "${from}"`)
    }
  }

  return out
}

function computeMissing(usedTags: string[], existing: ImportEntry[]): string[] {
  const imported = new Set<string>()
  for (const entry of existing) {
    for (const tag of entry.tags) imported.add(tag)
  }

  const missing: string[] = []
  for (const tag of usedTags) {
    if (imported.has(tag)) continue
    if (COMPONENT_REGISTRY[tag]) {
      missing.push(tag)
      continue
    }
    if (KNOWN_TAGS[tag]) {
      missing.push(tag)
      continue
    }
    if (LUCIDE_ICONS.has(tag)) {
      missing.push(tag)
      continue
    }
  }

  return [...new Set(missing)]
}

function mergeIntoExisting(tag: string, existing: ImportEntry[]): boolean {
  // Determine what module this tag belongs to
  let targetFrom: string | null = null
  let named = true

  if (COMPONENT_REGISTRY[tag]) {
    targetFrom = resolveComponentFile(tag) // uses registry → "@/components/ui/card" for CardHeader
  } else if (KNOWN_TAGS[tag]) {
    targetFrom = KNOWN_TAGS[tag].from
    named = KNOWN_TAGS[tag].named
  } else if (LUCIDE_ICONS.has(tag)) {
    targetFrom = "lucide-react"
  }

  if (!targetFrom) return false

  // Find an existing entry with the SAME canonical path
  for (const entry of existing) {
    const existingPath = normalizeImportPath(entry.from)
    if (existingPath === normalizeImportPath(targetFrom) && entry.named === named) {
      if (!entry.tags.includes(tag)) {
        entry.tags.push(tag)
      }
      return true
    }
  }

  // No existing entry for this canonical file — create one
  existing.push({ from: normalizeImportPath(targetFrom), named, tags: [tag], originalLine: "" })
  return true
}

function lowercaseShadcnPaths(lines: string[]): string[] {
  return lines.map((line) => {
    return line.replace(
      /from\s+("@\/components\/ui\/[^"]+")|from\s+('@\/components\/ui\/[^']+')/g,
      (match) => {
        const prefix = match.startsWith("from \"") ? "from \"" : "from '"
        const quote = match.startsWith("from \"") ? "\"" : "'"
        const inner = match.slice(prefix.length, -1)
        const normalized = normalizeImportPath(inner)
        if (normalized !== inner) return `${prefix}${normalized}${quote}`
        return match
      },
    )
  })
}

function findUsedComponentTags(body: string): string[] {
  const tags = new Set<string>()
  const tagRegex = /<([A-Z][A-Za-z0-9]*)\b/g
  let m: RegExpExecArray | null
  while ((m = tagRegex.exec(body)) !== null) {
    tags.add(m[1])
  }
  return Array.from(tags)
}

export default lintAllFiles
