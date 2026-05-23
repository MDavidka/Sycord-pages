// Syra Compiler — deterministic ManifestAST → deployable TSX + JSON files.
// Generates: layout-map.json, header.tsx, footer.tsx, [sectionId].tsx per section.
// Every import is resolved from the REGISTRY. No hallucination possible.

import { getPrimitive, isClient as isClientPrimitive } from "./registry"
import type { ManifestAST, ManifestSection, ManifestComponent, ManifestPage, GeneratedFile } from "./types"

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "{": "&#123;", "}": "&#125;", "`": "&#96;" }
function esc(s: string): string { return s.replace(/[&<>{}\`]/g, (c) => ESC[c] ?? c) }
function jsxStr(s: string): string { return `"${esc(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` }

// ── Layout Map ───────────────────────────────────────────────────

export function compileLayoutMap(manifest: ManifestAST): GeneratedFile {
  return {
    path: `components/generated/${manifest.siteMetadata.projectId}/layout-map.json`,
    content: JSON.stringify(manifest, null, 2),
    type: "layout-map",
  }
}

// ── Header ────────────────────────────────────────────────────────

export function compileHeader(manifest: ManifestAST): GeneratedFile {
  const navLinks = manifest.routingGraph
    .filter((e) => e.actionType === "PUSH_ROUTE")
    .map((e) => ({ id: e.triggerElementId, pageId: e.sourcePageId, target: e.targetPageId }))

  const projectId = manifest.siteMetadata.projectId
  const siteName = manifest.siteMetadata.siteName

  return {
    path: `components/generated/${projectId}/header.tsx`,
    content: `import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Menu } from "lucide-react"

export default function SyraHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <a href="/" className="flex items-center gap-2 text-sm font-semibold">
          ${jsxStr(siteName)}
        </a>
        <nav className="hidden md:flex items-center gap-6">
${navLinks.map((l) => `          <a href=${jsxStr(l.target)} className="text-sm text-muted-foreground hover:text-foreground transition-colors">${l.pageId}</a>`).join("\n")}
        </nav>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
`,
    type: "header",
  }
}

// ── Footer ────────────────────────────────────────────────────────

export function compileFooter(manifest: ManifestAST): GeneratedFile {
  const projectId = manifest.siteMetadata.projectId
  const siteName = manifest.siteMetadata.siteName

  return {
    path: `components/generated/${projectId}/footer.tsx`,
    content: `import { cn } from "@/lib/utils"

export default function SyraFooter() {
  return (
    <footer className="border-t border-border/40 py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} ${jsxStr(siteName)}. Built with Syra AI.
          </p>
        </div>
      </div>
    </footer>
  )
}
`,
    type: "footer",
  }
}

// ── Section Compiler ──────────────────────────────────────────────

function compileComponent(comp: ManifestComponent, indent = 0): string {
  const entry = getPrimitive(comp.shadcnPrimitive)
  const tag = entry?.mainExport ?? comp.shadcnPrimitive
  const isVoid = entry?.voidElement ?? false
  const pad = "  ".repeat(indent)

  const attrs: string[] = []
  if (comp.styles?.customTailwindClasses) {
    const classes = comp.styles.customTailwindClasses
    if (classes.length > 0) attrs.push(`className=${jsxStr(classes)}`)
  }
  if (comp.props) {
    for (const [key, value] of Object.entries(comp.props)) {
      if (key === "className" || key === "children") continue
      if (typeof value === "string") attrs.push(`${key}=${jsxStr(value)}`)
      else if (typeof value === "boolean" && value) attrs.push(key)
      else attrs.push(`${key}={${JSON.stringify(value)}}`)
    }
  }
  const attrStr = attrs.length ? ` ${attrs.join(" ")}` : ""

  if (isVoid) return `${pad}<${tag}${attrStr} />`

  if (comp.children?.length) {
    const children = comp.children.map((c) => compileComponent(c, indent + 1)).join("\n")
    const childText = comp.props?.children
    const inner = childText && typeof childText === "string" ? `${esc(childText)}` : `\n${children}\n${pad}`
    return `${pad}<${tag}${attrStr}>${inner}</${tag}>`
  }

  const text = comp.props?.children
  if (text && typeof text === "string") return `${pad}<${tag}${attrStr}>${esc(text)}</${tag}>`

  return `${pad}<${tag}${attrStr} />`
}

function collectSectionImports(section: ManifestSection): Map<string, Set<string>> {
  const imps = new Map<string, Set<string>>()
  function walk(comp: ManifestComponent) {
    const entry = getPrimitive(comp.shadcnPrimitive)
    if (entry) {
      if (!imps.has(entry.importPath)) imps.set(entry.importPath, new Set())
      imps.get(entry.importPath)!.add(entry.mainExport)
    }
    for (const c of comp.children ?? []) walk(c)
  }
  for (const comp of section.components) walk(comp)
  return imps
}

function compileSectionImports(section: ManifestSection): string {
  const imps = collectSectionImports(section)
  const lines: string[] = []
  for (const [path, names] of imps) {
    lines.push(`import { ${[...names].sort().join(", ")} } from ${jsxStr(path)}`)
  }
  lines.push(`import { cn } from "@/lib/utils"`)
  return lines.join("\n")
}

function layoutClasses(section: ManifestSection): string {
  const cols = section.gridCols ?? 1
  const gridMap: Record<number, string> = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
    5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
    6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  }

  if (section.layoutContainer === "container-grid") {
    return `grid ${gridMap[cols] || "grid-cols-1"} gap-6`
  }
  if (section.layoutContainer === "container-flex") {
    return "flex flex-col items-center text-center max-w-4xl mx-auto"
  }
  return ""
}

export function compileSection(section: ManifestSection, projectId: string): GeneratedFile {
  const needsClient = section.components.some((c) => isClientPrimitive(c.shadcnPrimitive))
  const imports = compileSectionImports(section)
  const clientDir = needsClient ? '"use client";\n\n' : ""
  const layoutClass = layoutClasses(section)
  const elements = section.components.map((c) => compileComponent(c, 2)).join("\n")

  return {
    path: `components/generated/${projectId}/${section.sectionId}.tsx`,
    content: `${clientDir}${imports}

export default function ${pascalCase(section.sectionId)}() {
  return (
    <section id=${jsxStr(section.sectionId)} className="py-16 sm:py-20">
      <div className="container mx-auto px-4 sm:px-6">
        <div className={cn(${jsxStr(layoutClass)})}>
${elements}
        </div>
      </div>
    </section>
  )
}
`,
    type: "section",
  }
}

// ── Page Compiler — wraps header + sections + footer ──────────────

export function compilePage(page: ManifestPage, manifest: ManifestAST): GeneratedFile {
  const projectId = manifest.siteMetadata.projectId
  const sections = page.layout.sections
  const needsClient = sections.some((s) => s.components.some((c) => isClientPrimitive(c.shadcnPrimitive)))

  const sectionImports = sections
    .map((s) => `import ${pascalCase(s.sectionId)} from "@/components/generated/${projectId}/${s.sectionId}"`)
    .join("\n")

  const headerImport = page.layout.headerEnabled
    ? `import SyraHeader from "@/components/generated/${projectId}/header"`
    : ""

  const footerImport = page.layout.footerEnabled
    ? `import SyraFooter from "@/components/generated/${projectId}/footer"`
    : ""

  const clientDir = needsClient ? '"use client";\n\n' : ""

  return {
    path: page.slug === "/" ? "app/page.tsx" : `app/${page.slug}/page.tsx`,
    content: `${clientDir}${headerImport ? headerImport + "\n" : ""}${footerImport ? footerImport + "\n" : ""}${sectionImports}

export const metadata = {
  title: ${jsxStr(page.title)},
  description: ${jsxStr(page.metaDescription)},
}

export default function Page() {
  return (
    <>
${page.layout.headerEnabled ? "      <SyraHeader />" : ""}
${sections.map((s) => `      <${pascalCase(s.sectionId)} />`).join("\n")}
${page.layout.footerEnabled ? "      <SyraFooter />" : ""}
    </>
  )
}
`,
    type: "page",
  }
}

// ── Full Manifest Compilation ─────────────────────────────────────

export function compileManifest(manifest: ManifestAST): GeneratedFile[] {
  const files: GeneratedFile[] = [compileLayoutMap(manifest)]
  const projectId = manifest.siteMetadata.projectId

  const hasHeader = manifest.pages.some((p) => p.layout.headerEnabled)
  const hasFooter = manifest.pages.some((p) => p.layout.footerEnabled)
  if (hasHeader) files.push(compileHeader(manifest))
  if (hasFooter) files.push(compileFooter(manifest))

  for (const page of manifest.pages) {
    for (const section of page.layout.sections) {
      files.push(compileSection(section, projectId))
    }
    files.push(compilePage(page, manifest))
  }

  return files
}

function pascalCase(s: string): string {
  return s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("")
}
