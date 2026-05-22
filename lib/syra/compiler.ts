// Syra Deterministic Compiler — converts SiteManifest → deployable TSX files.
//
// The compiler is PURE. It never invents components, props, or imports.
// Everything resolves through the REGISTRY. The AI produces a manifest JSON;
// the compiler produces the actual code.
//
// Compiler stages:
//   1. Resolve imports from registry
//   2. Generate page TSX from section elements
//   3. Generate app/layout.tsx + app/globals.css
//   4. Generate config files (package.json, tsconfig)
//   5. Generate lib/utils.ts + lib/site-config.ts
//   6. Separate server vs client components with "use client"

import { getRegistryEntry, isClientComponent, isVoidElement } from "./registry"
import type { ManifestElement, ManifestPage, ManifestSection, SiteManifest, GeneratedFile } from "./types"

const JSX_SPECIAL: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  "{": "&#123;",
  "}": "&#125;",
  "`": "&#96;",
}

function esc(text: string): string {
  return text.replace(/[&<>{}\`]/g, (c) => JSX_SPECIAL[c] ?? c)
}

function jsxStr(s: string): string {
  return `"${esc(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function propValue(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v === "boolean") return v ? "true" : "false"
  if (typeof v === "number") return String(v)
  if (typeof v === "string") return jsxStr(v)
  return JSON.stringify(v)
}

function compileProps(el: ManifestElement): string {
  const parts: string[] = []
  if (el.variant && el.variant !== "default") {
    parts.push(`variant=${jsxStr(el.variant)}`)
  }
  if (el.size && el.size !== "default") {
    parts.push(`size=${jsxStr(el.size)}`)
  }
  if (el.className) {
    parts.push(`className=${jsxStr(el.className)}`)
  }
  if (el.props) {
    for (const [key, value] of Object.entries(el.props)) {
      if (key === "className" || key === "variant" || key === "size" || key === "children") continue
      parts.push(`${key}={${propValue(value)}}`)
    }
  }
  return parts.join(" ")
}

function compileElement(el: ManifestElement, depth: number, parentIsClient: boolean): string {
  const entry = getRegistryEntry(el.type)
  const isVoid = entry?.voidElement ?? isVoidElement(el.type)
  const isClient = entry?.isClient ?? isClientComponent(el.type)
  const needsClientFlag = isClient && !parentIsClient

  const elProps = compileProps(el)
  const propsStr = elProps ? ` ${elProps}` : ""

  if (isVoid) {
    return `<${el.type}${propsStr} />`
  }

  if (el.children && el.children.length > 0) {
    const childTsx = el.children
      .map((c) => compileElement(c, depth + 1, isClient || parentIsClient))
      .join("\n")
    const indent = "  ".repeat(depth + 1)
    return `<${el.type}${propsStr}>\n${indent}${childTsx}\n${"  ".repeat(depth)}</${el.type}>`
  }

  if (el.content) {
    const safeContent = esc(el.content)
    return `<${el.type}${propsStr}>${safeContent}</${el.type}>`
  }

  return `<${el.type}${propsStr} />`
}

function buildImportBlock(elements: ManifestElement[]): Map<string, Set<string>> {
  const imports = new Map<string, Set<string>>()

  function collect(el: ManifestElement) {
    const entry = getRegistryEntry(el.type)
    if (entry) {
      if (!imports.has(entry.importPath)) {
        imports.set(entry.importPath, new Set())
      }
      // Add the main export that matches our usage
      const exportName = entry.exports[0]
      if (exportName) {
        imports.get(entry.importPath)!.add(exportName)
      }
    }
    for (const child of el.children ?? []) {
      collect(child)
    }
  }

  for (const el of elements) collect(el)
  return imports
}

function buildSectionImports(sections: ManifestSection[]): Map<string, Set<string>> {
  const allImports = new Map<string, Set<string>>()

  for (const section of sections) {
    const sectionImports = buildImportBlock(section.elements)
    for (const [path, names] of sectionImports) {
      if (!allImports.has(path)) allImports.set(path, new Set())
      for (const name of names) allImports.get(path)!.add(name)
    }
  }

  return allImports
}

function sectionBgClass(bg?: string): string {
  switch (bg) {
    case "muted": return "bg-muted/50"
    case "card": return "bg-card"
    case "primary/5": return "bg-primary/5"
    case "accent/5": return "bg-accent/5"
    default: return ""
  }
}

function sectionPadding(padding?: string): string {
  switch (padding) {
    case "sm": return "py-8 sm:py-12"
    case "lg": return "py-20 sm:py-28 lg:py-32"
    case "xl": return "py-24 sm:py-32 lg:py-40"
    default: return "py-12 sm:py-16 lg:py-20"
  }
}

function compileSection(section: ManifestSection): string {
  const bg = sectionBgClass(section.bg)
  const pad = sectionPadding(section.padding)
  const needsClient = section.elements.some((el) => isClientComponent(el.type))
  const clientDirective = needsClient ? '"use client"\n\n' : ""

  const layoutClass = (() => {
    switch (section.layout) {
      case "centered": return "flex flex-col items-center text-center max-w-4xl mx-auto"
      case "split": return "grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
      case "grid-2col": return "grid grid-cols-1 sm:grid-cols-2 gap-6"
      case "grid-3col": return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      case "grid-4col": return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      case "alternating": return "flex flex-col gap-16"
      case "bento": return "grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min"
      case "marquee": return "flex overflow-x-auto gap-8 pb-4"
      default: return "flex flex-col items-center text-center max-w-4xl mx-auto"
    }
  })()

  const elementsTsx = section.elements
    .map((el) => compileElement(el, 2, needsClient))
    .join("\n")

  return `${clientDirective}export function ${toPascalCase(section.id)}() {
  return (
    <section id={${jsxStr(section.id)}} className={${jsxStr(`${bg} ${pad}`.trim())}}>
      <div className="container mx-auto px-4 sm:px-6">
        <div className={${jsxStr(layoutClass)}}>
${elementsTsx}
        </div>
      </div>
    </section>
  )
}`
}

function compilePageFile(page: ManifestPage): GeneratedFile {
  const imports = buildSectionImports(page.sections)
  const hasClient = page.sections.some((s) => s.elements.some((el) => isClientComponent(el.type)))

  const importLines: string[] = []
  for (const [path, names] of imports) {
    const sorted = Array.from(names).sort()
    importLines.push(`import { ${sorted.join(", ")} } from ${jsxStr(path)}`)
  }

  const importBlock = importLines.length > 0 ? importLines.join("\n") + "\n" : ""
  const clientDirective = hasClient ? '"use client"\n\n' : ""

  const metaBlock = `export const metadata = {
  title: ${jsxStr(page.metaTitle)},
  description: ${jsxStr(page.metaDescription)},
}`

  const sectionImports = page.sections.map((s) => `${toPascalCase(s.id)}`).join(", ")

  // For multi-section pages, we import sections separately
  const sectionsTsx = page.sections
    .map((s, i) => compileSection(s))
    .join("\n\n")

  const sectionNames = page.sections.map((s) => toPascalCase(s.id))

  const componentExport = `export default function Page() {
  return (
    <>
${sectionNames.map((name) => `      <${name} />`).join("\n")}
    </>
  )
}`

  const tsx = `${clientDirective}${importBlock}
// Generated page sections
${sectionsTsx}

${metaBlock}

${componentExport}
`

  const filePath = page.path === "/" ? "app/page.tsx" : `app${page.path}/page.tsx`

  return { path: filePath, content: tsx, type: "page" }
}

function compileLayout(manifest: SiteManifest): GeneratedFile {
  const layoutTsx = `import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: {
    default: ${jsxStr(manifest.projectName)},
    template: \`%s — ${manifest.projectName}\`,
  },
  description: ${jsxStr(manifest.tagline)},
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <div className="relative flex min-h-screen flex-col">
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  )
}
`
  return { path: "app/layout.tsx", content: layoutTsx, type: "layout" }
}

function compileGlobalsCss(manifest: SiteManifest): GeneratedFile {
  const tailwindImport = `@import "tailwindcss";\n`
  const themeVars = `@theme {
  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
}\n`

  const baseStyles = `@layer base {
  * {
    border-color: transparent;
  }
  body {
    background-color: var(--background);
    color: var(--foreground);
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}\n`

  const tailwindDirectives = tailwindImport + themeVars + baseStyles
  return { path: "app/globals.css", content: tailwindDirectives, type: "style" }
}

function compilePackageJson(manifest: SiteManifest): GeneratedFile {
  const pkg = {
    name: manifest.projectName.toLowerCase().replace(/\s+/g, "-"),
    version: "0.1.0",
    private: true,
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
    },
    dependencies: {
      next: "^16.0.0",
      react: "^19.0.0",
      "react-dom": "^19.0.0",
    },
  }

  return {
    path: "package.json",
    content: JSON.stringify(pkg, null, 2) + "\n",
    type: "config",
  }
}

function compileTsConfig(): GeneratedFile {
  const tsconfig = {
    compilerOptions: {
      target: "ES2017",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: true,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      plugins: [{ name: "next" }],
      paths: { "@/*": ["./*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
    exclude: ["node_modules"],
  }

  return {
    path: "tsconfig.json",
    content: JSON.stringify(tsconfig, null, 2) + "\n",
    type: "config",
  }
}

function compileUtils(): GeneratedFile {
  const utilsTs = `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
  return { path: "lib/utils.ts", content: utilsTs, type: "component" }
}

function compileSiteConfig(manifest: SiteManifest): GeneratedFile {
  const config = {
    name: manifest.projectName,
    tagline: manifest.tagline,
    theme: manifest.theme,
    colorScheme: manifest.colorScheme,
    pages: manifest.pages.map((p) => ({ path: p.path, title: p.title })),
  }

  const tsx = `export const siteConfig = ${JSON.stringify(config, null, 2)} as const

export type SiteConfig = typeof siteConfig
`
  return { path: "lib/site-config.ts", content: tsx, type: "config" }
}

function compileNextConfig(): GeneratedFile {
  const mjs = `/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
}

export default nextConfig
`
  return { path: "next.config.mjs", content: mjs, type: "config" }
}

// ── Public API ──────────────────────────────────────────────────

export function compileManifest(manifest: SiteManifest): GeneratedFile[] {
  const files: GeneratedFile[] = []

  // Pages
  for (const page of manifest.pages) {
    files.push(compilePageFile(page))
  }

  // Core files
  files.push(compileLayout(manifest))
  files.push(compileGlobalsCss(manifest))
  files.push(compilePackageJson(manifest))
  files.push(compileTsConfig())
  files.push(compileNextConfig())
  files.push(compileUtils())
  files.push(compileSiteConfig(manifest))

  return files
}

function toPascalCase(s: string): string {
  return s
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join("")
}
