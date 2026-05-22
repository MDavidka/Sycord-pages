// Post-generation syntax linting and import repair for generated TSX.
//
// The block renderers and AI output can produce minor syntax issues:
//   - Single-quotes wrapped in double braces:  className={{'...'}}
//   - JSX components used without an import
//   - Backtick nesting inside template literals
//   - `class=` instead of `className=`, `for=` instead of `htmlFor=`
//   - Duplicate attribute names (className twice)
//
// This module scans every generated file, fixes fixable issues, and
// injects missing import statements before the content reaches build
// validation. Only shadcn UI components from @/components/ui/* and
// known library imports (lucide-react, next/link, next/image) are
// auto-injected; unknown components trigger a warning.

import type { BuilderFile } from "./types"

export interface LintResult {
  fixed: string[]
  missingImports: string[]
  warnings: string[]
}

// All shadcn components we support in generated output. Tags that match
// these names need a `@/components/ui/<name>` import.
const SHADCN_TAGS = new Set([
  "Button",
  "Badge",
  "Card",
  "CardHeader",
  "CardTitle",
  "CardDescription",
  "CardContent",
  "CardFooter",
  "Accordion",
  "AccordionItem",
  "AccordionTrigger",
  "AccordionContent",
  "Tabs",
  "TabsList",
  "TabsTrigger",
  "TabsContent",
  "Input",
  "Textarea",
  "Label",
  "Avatar",
  "AvatarImage",
  "AvatarFallback",
  "Separator",
  "Select",
  "SelectTrigger",
  "SelectValue",
  "SelectContent",
  "SelectItem",
  "SelectGroup",
  "Checkbox",
  "Switch",
  "Skeleton",
  "Progress",
  "Alert",
  "AlertTitle",
  "AlertDescription",
  "Dialog",
  "DialogTrigger",
  "DialogContent",
  "DialogHeader",
  "DialogTitle",
  "DialogDescription",
  "Table",
  "TableHeader",
  "TableBody",
  "TableRow",
  "TableHead",
  "TableCell",
  "Sheet",
  "SheetTrigger",
  "SheetContent",
  "Breadcrumb",
  "BreadcrumbList",
  "BreadcrumbItem",
  "BreadcrumbLink",
  "Pagination",
  "PaginationContent",
  "PaginationPrevious",
  "PaginationNext",
  "PaginationItem",
  "PaginationLink",
  "Tooltip",
  "TooltipTrigger",
  "TooltipContent",
  "HoverCard",
  "HoverCardTrigger",
  "HoverCardContent",
])

// Tags that map to known non-shadcn imports we can auto-inject.
const KNOWN_IMPORTS: Record<string, { from: string; named: boolean }> = {
  "Link": { from: "next/link", named: false },
  "Image": { from: "next/image", named: false },
  "Check": { from: "lucide-react", named: true },
  "ChevronRight": { from: "lucide-react", named: true },
  "ChevronDown": { from: "lucide-react", named: true },
  "ChevronUp": { from: "lucide-react", named: true },
  "ArrowRight": { from: "lucide-react", named: true },
  "ArrowUpRight": { from: "lucide-react", named: true },
  "BarChart3": { from: "lucide-react", named: true },
  "X": { from: "lucide-react", named: true },
  "Star": { from: "lucide-react", named: true },
  "Heart": { from: "lucide-react", named: true },
  "Crown": { from: "lucide-react", named: true },
  "Sparkles": { from: "lucide-react", named: true },
  "Zap": { from: "lucide-react", named: true },
  "Rocket": { from: "lucide-react", named: true },
  "ShieldCheck": { from: "lucide-react", named: true },
  "Globe": { from: "lucide-react", named: true },
  "Mail": { from: "lucide-react", named: true },
  "Phone": { from: "lucide-react", named: true },
  "MapPin": { from: "lucide-react", named: true },
}

// ---- Public API ----

export function lintAndRepairFile(file: BuilderFile): { content: string; result: LintResult } {
  let content = file.content
  if (!content.trim()) return { content, result: { fixed: [], missingImports: [], warnings: [] } }

  const result: LintResult = { fixed: [], missingImports: [], warnings: [] }

  // Phase 1: Fix syntax errors in the body
  content = fixSyntaxErrors(content, result)

  // Phase 2: Fix import block — find used tags and inject missing imports
  content = fixImports(content, file.path, result)

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
  // Fix: className={{'...'}} -> className="..."
  // Matches className={{' followed by content until '}}
  content = content.replace(
    /className=\{\{'(.*?)'\}\}/g,
    (_full: string, inner: string) => {
      result.fixed.push(`className={{'...'}} -> className="..."`)
      const escaped = inner.replace(/"/g, "&quot;")
      return `className="${escaped}"`
    },
  )

  // Fix: className={{"... ..."}} -> className="..."
  content = content.replace(
    /className=\{\{"(.*?)"\}\}/g,
    (_full: string, inner: string) => {
      result.fixed.push(`className={{"..."}} -> className="..."`)
      const cleaned = inner
        .replace(/\\"/g, '"')
        .replace(/['`]/g, "")
        .replace(/\$\{[^}]+\}/g, "")
        .trim()
      if (!cleaned) return `className=""`
      return `className="${cleaned}"`
    },
  )

  // Fix: Duplicate className — keep only the first one
  // This catches patterns like className="..." className="..."
  const dupClassNames = content.match(/className="[^"]*"\s+className="[^"]*"/g)
  if (dupClassNames) {
    for (const dup of dupClassNames) {
      const first = dup.match(/(className="[^"]*")/)?.[1] ?? ""
      content = content.replace(dup, first)
    }
    result.fixed.push("duplicate className removed")
  }

  // Fix: class= -> className= (common mistake in React)
  if (/\bclass=/.test(content) && !/\bclassName=/.test(content)) {
    content = content.replace(/\bclass=/g, "className=")
    result.fixed.push("class= -> className=")
  }

  // Fix: for= -> htmlFor= in JSX context
  if (/\bfor=/.test(content)) {
    const forCount = (content.match(/\bfor="/g) || []).length
    if (forCount > 0) {
      content = content.replace(/\bfor="/g, "htmlFor=\"")
      result.fixed.push("for= -> htmlFor=")
    }
  }

  // Fix: Backtick inside attribute value — swap to quotes
  // Pattern: onClick={`...`} where ... contains backticks
  content = content.replace(
    /=\{`([^`]*`[^`]*)`\}/g,
    (_full: string) => {
      result.fixed.push("nested backtick in template literal")
      const inner = _full.slice(2, -2)
      const cleaned = inner.replace(/[`]/g, "'").replace(/\$\{/g, "${")
      return `={"${cleaned.replace(/"/g, "&quot;")}"}`
    },
  )

  // Fix: Template literal with backtick inside — escape or convert
  // e.g. `translateX(-${100 - (value || 0)}%)` is valid
  // But `<div className={`...`}>` wrapping JSX is not — those get caught above

  // Fix: Empty style={{}} — remove it
  content = content.replace(/\s+style=\{\{\}\}/g, "")

  // Fix: Self-closing tags that shadcn doesn't support
  // <Badge /> is fine, but we never want <img> without alt
  content = content.replace(
    /<img\s+(?!.*alt=)/g,
    (match: string) => match.replace(">", ' alt="" />'),
  )

  // Fix: Unescaped braces in text content
  // Pattern: text that accidentally has { or } which JSX interprets as expressions
  // We already have esc() in blocks.ts, but let's catch edge cases here too
  content = content.replace(
    />\s*\{([^{}]*?)\}\s*</g,
    (_full: string, inner: string) => {
      if (/^[\s"'A-Za-z0-9.,!?\-:;()]+$/.test(inner)) {
        result.fixed.push("unescaped brace in text content")
        return `>${inner}<`
      }
      return _full
    },
  )

  return content
}

// ---- Import repair ----

function fixImports(content: string, _filePath: string, result: LintResult): string {
  // Split: everything before first import/export (preamble) + import block + body
  const lines = content.split("\n")

  // Find the import/export block boundaries
  let importStart = -1
  let importEnd = -1
  let metaStart = -1

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (importStart === -1 && (line.startsWith("import ") || line.startsWith('"use client"'))) {
      importStart = line.startsWith('"use client"') ? i : i
    }
    if (importStart !== -1 && importEnd === -1 && line.startsWith("export const metadata")) {
      importEnd = i - 1
      metaStart = i
      break
    }
    if (importStart !== -1 && importEnd === -1 && line.startsWith("export default function")) {
      importEnd = i - 1
      break
    }
  }

  if (importStart === -1) {
    // No imports found — this might be a config file, skip
    return content
  }
  if (importEnd === -1 || importEnd < importStart) {
    importEnd = importStart
  }

  const preamble = lines.slice(0, importStart).join("\n")
  const importBlock = lines.slice(importStart, importEnd + 1).join("\n")
  const bodyStart = metaStart > 0 ? metaStart : importEnd + 1
  const body = lines.slice(bodyStart).join("\n")

  // Scan the body for JSX component tags
  const usedTags = findUsedComponentTags(body)

  // Check which tags are already imported
  const existingImports = parseExistingImports(importBlock)
  const knownImportSlugs = new Map(existingImports.map((i) => [i.slug, i]))

  // Build missing imports
  const missingShadcn: string[] = []
  const missingKnown: Array<{ tag: string; from: string; named: boolean }> = []

  for (const tag of usedTags) {
    if (knownImportSlugs.has(tag)) continue

    if (SHADCN_TAGS.has(tag)) {
      missingShadcn.push(tag)
    } else if (KNOWN_IMPORTS[tag]) {
      const info = KNOWN_IMPORTS[tag]
      const slug = info.named ? tag : "default"
      if (!knownImportSlugs.has(slug) && !importBlock.includes(fromPattern(info.from))) {
        missingKnown.push({ tag, from: info.from, named: info.named ?? true })
      }
    }
  }

  if (missingShadcn.length === 0 && missingKnown.length === 0) {
    return content
  }

  // Build new import lines
  const newImports: string[] = []
  const deduped = new Set(missingShadcn)
  if (deduped.size > 0) {
    const sorted = Array.from(deduped).sort()
    newImports.push(`import { ${sorted.join(", ")} } from "@/components/ui/${sorted[0]}"`)
    result.missingImports.push(...sorted.map((s) => `@/components/ui/${s}`))
  }

  for (const miss of missingKnown) {
    if (miss.named) {
      newImports.push(`import { ${miss.tag} } from "${miss.from}"`)
    } else {
      newImports.push(`import ${miss.tag} from "${miss.from}"`)
    }
    result.missingImports.push(miss.from)
  }

  // Insert new imports into the import block (after the last existing import)
  const importLines = importBlock.split("\n").filter((l) => l.trim())
  const insertionIndex = importLines.length
  importLines.splice(insertionIndex, 0, ...newImports)

  // Reconstruct
  const before = preamble ? preamble + "\n" : ""
  const newImportBlock = importLines.join("\n")
  const after = body

  return before + newImportBlock + "\n\n" + after
}

function findUsedComponentTags(body: string): string[] {
  const tags = new Set<string>()

  // Match JSX component tags: <ComponentName ...> or <ComponentName .../>
  // Must start with uppercase letter (React convention)
  const tagRegex = /<([A-Z][A-Za-z0-9]*)\b/g
  let m: RegExpExecArray | null
  while ((m = tagRegex.exec(body)) !== null) {
    tags.add(m[1])
  }

  return Array.from(tags)
}

interface ParsedImport {
  slug: string
  from: string
}

function parseExistingImports(importBlock: string): ParsedImport[] {
  const result: ParsedImport[] = []

  // import { X, Y } from "..."
  const namedRe = /import\s+\{([^}]+)\}\s+from\s+["']([^"']+)["']/g
  let m: RegExpExecArray | null
  while ((m = namedRe.exec(importBlock)) !== null) {
    const names = m[1].split(",").map((n) => n.trim()).filter(Boolean)
    const from = m[2]
    for (const name of names) {
      // Handle "type X" imports
      const clean = name.replace(/^type\s+/, "")
      result.push({ slug: clean, from })
    }
  }

  // import X from "..."
  const defaultRe = /import\s+([A-Z][A-Za-z0-9]*)\s+from\s+["']([^"']+)["']/g
  while ((m = defaultRe.exec(importBlock)) !== null) {
    result.push({ slug: m[1], from: m[2] })
  }

  // import * as X from "..."
  const starRe = /import\s+\*\s+as\s+(\w+)\s+from\s+["']([^"']+)["']/g
  while ((m = starRe.exec(importBlock)) !== null) {
    result.push({ slug: m[1], from: m[2] })
  }

  return result
}

function fromPattern(from: string): string {
  // Approximate match for whether `from` appears in the import block
  return from
}

// Re-export for use in the pipeline
export default lintAllFiles
