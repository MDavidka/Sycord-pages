// Syra TSX Compiler — generates deployable React component code from manifest sections.
// Each section is compiled independently (parallelizable). The compiler imports
// ONLY from the shadcn registry — never hallucinates component sources.

import { getEntry } from "./registry"
import type { ManifestElement, ManifestSection, ManifestPage, ManifestAST, GeneratedFile } from "./types"

const ESC_CHARS: Record<string, string> = {
  "&": "&amp;", "<": "&lt;", ">": "&gt;", "{": "&#123;", "}": "&#125;", "`": "&#96;",
}

function esc(s: string): string { return s.replace(/[&<>{}\`]/g, (c) => ESC_CHARS[c] || c) }
function jsxStr(s: string): string { return `"${esc(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` }

function compileElement(el: ManifestElement, indent = 0): string {
  const entry = getEntry(el.type)
  const tag = entry?.exports[0] ?? el.type
  const isVoid = entry?.voidElement ?? false
  const isClient = entry?.isClient ?? false
  const pad = "  ".repeat(indent)

  const attrs: string[] = []
  if (el.variant && el.variant !== "default") attrs.push(`variant=${jsxStr(el.variant)}`)
  if (el.size && el.size !== "default") attrs.push(`size=${jsxStr(el.size)}`)
  if (el.className) attrs.push(`className={cn(${jsxStr(el.className)})}`)
  const attrStr = attrs.length ? ` ${attrs.join(" ")}` : ""

  if (isVoid) return `${pad}<${tag}${attrStr} />`

  if (el.children?.length) {
    const children = el.children.map((c) => compileElement(c, indent + 1)).join("\n")
    return `${pad}<${tag}${attrStr}>\n${children}\n${pad}</${tag}>`
  }

  if (el.content) return `${pad}<${tag}${attrStr}>${esc(el.content)}</${tag}>`
  return `${pad}<${tag}${attrStr} />`
}

function collectImports(elements: ManifestElement[]): Map<string, Set<string>> {
  const imps = new Map<string, Set<string>>()
  function walk(el: ManifestElement) {
    const entry = getEntry(el.type)
    if (entry) {
      if (!imps.has(entry.importPath)) imps.set(entry.importPath, new Set())
      imps.get(entry.importPath)!.add(entry.exports[0])
    }
    for (const c of el.children ?? []) walk(c)
  }
  for (const el of elements) walk(el)
  return imps
}

function compileImports(elements: ManifestElement[]): string {
  const imps = collectImports(elements)
  const lines: string[] = []
  imps.has("@/components/ui/card") && imps.set("@/components/ui/card", new Set(["Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"]))
  for (const [path, names] of imps) {
    const sorted = [...names].sort()
    lines.push(`import { ${sorted.join(", ")} } from ${jsxStr(path)}`)
  }
  lines.push(`import { cn } from "@/lib/utils"`)
  lines.push(`import { Sparkles, ArrowRight, Check, Star, Zap, ShieldCheck, Rocket, Crown, Target, Flame, Layers, BarChart3, Code2, Palette, Globe, Users, Mail, Phone, MessageCircle, ChevronRight, ArrowUpRight } from "lucide-react"`)
  return lines.join("\n")
}

function sectionLayoutClass(layout?: string): string {
  switch (layout) {
    case "centered": return "flex flex-col items-center text-center max-w-4xl mx-auto"
    case "split": return "grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
    case "grid-2": return "grid grid-cols-1 sm:grid-cols-2 gap-6"
    case "grid-3": return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
    case "grid-4": return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
    case "asymmetric": return "grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-12"
    case "bento": return "grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-min"
    case "alternating": return "flex flex-col gap-16"
    default: return "flex flex-col items-center text-center max-w-4xl mx-auto"
  }
}

function sectionBg(bg?: string): string {
  switch (bg) {
    case "muted": return "bg-muted/50"
    case "card": return "bg-card"
    case "primary/5": return "bg-primary/5"
    case "accent/5": return "bg-accent/5"
    default: return ""
  }
}

function sectionPadding(pad?: string): string {
  switch (pad) {
    case "sm": return "py-8 sm:py-12"
    case "lg": return "py-20 sm:py-28"
    case "xl": return "py-24 sm:py-32"
    default: return "py-12 sm:py-16 lg:py-20"
  }
}

export function compileSection(section: ManifestSection): string {
  const needsClient = section.elements.some((el) => getEntry(el.type)?.isClient)
  const clientDir = needsClient ? '"use client";\n\n' : ""
  const imports = compileImports(section.elements)
  const layoutClass = sectionLayoutClass(section.layout)
  const bgClass = sectionBg(section.bg)
  const padClass = sectionPadding(section.padding)
  const elementsTsx = section.elements.map((el) => compileElement(el, 2)).join("\n")

  return `${clientDir}${imports}

export default function ${pascalCase(section.id)}() {
  return (
    <section id=${jsxStr(section.id)} className={cn(${jsxStr([bgClass, padClass].filter(Boolean).join(" ").trim())})}>
      <div className="container mx-auto px-4 sm:px-6">
        <div className={cn(${jsxStr(layoutClass)})}>
${elementsTsx}
        </div>
      </div>
    </section>
  )
}
`
}

export function compilePage(page: ManifestPage, projectId: string): GeneratedFile {
  const allElements = page.sections.flatMap((s) => s.elements)
  const hasClient = allElements.some((el) => getEntry(el.type)?.isClient)
  const clientDir = hasClient ? '"use client";\n\n' : ""
  const allImports = collectImports(allElements)
  const importLines: string[] = []
  for (const [path, names] of allImports) {
    importLines.push(`import { ${[...names].sort().join(", ")} } from ${jsxStr(path)}`)
  }
  importLines.push(`import { cn } from "@/lib/utils"`)

  const sectionVarNames = page.sections.map((s) => pascalCase(s.id) + "Section")

  const sectionRenders = page.sections
    .map((s) => {
      const code = compileSection(s)
      const varName = pascalCase(s.id) + "Section"
      return `${varName}`
    })
    .join(",\n  ")

  const jsx = `${clientDir}${importLines.join("\n")}

${page.sections.map((s) => {
  const code = compileSection(s)
  return code
}).join("\n\n")}

export const metadata = {
  title: ${jsxStr(page.metaTitle)},
  description: ${jsxStr(page.metaDescription)},
}

export default function Page() {
  return (
    <>
${page.sections.map((s) => `      <${pascalCase(s.id)} />`).join("\n")}
    </>
  )
}
`
  const filePath = page.path === "/" ? "app/page.tsx" : `app${page.path}/page.tsx`
  return { path: filePath, content: jsx, type: "page" }
}

export function compileLayout(manifest: ManifestAST): GeneratedFile {
  return {
    path: "app/layout.tsx",
    content: `import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: { default: ${jsxStr(manifest.projectName)}, template: \`%s — ${manifest.projectName}\` },
  description: ${jsxStr(manifest.tagline)},
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
`,
    type: "layout",
  }
}

export function compileConfigs(manifest: ManifestAST): GeneratedFile[] {
  const slug = manifest.projectName.toLowerCase().replace(/\s+/g, "-")
  return [
    {
      path: "package.json",
      content: JSON.stringify({ name: slug, version: "0.1.0", private: true, scripts: { dev: "next dev", build: "next build", start: "next start" }, dependencies: { next: "^16.0.0", react: "^19.0.0", "react-dom": "^19.0.0" } }, null, 2) + "\n",
      type: "config",
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify({ compilerOptions: { target: "ES2017", lib: ["dom", "dom.iterable", "esnext"], allowJs: true, skipLibCheck: true, strict: true, noEmit: true, module: "esnext", moduleResolution: "bundler", resolveJsonModule: true, isolatedModules: true, jsx: "preserve", incremental: true, plugins: [{ name: "next" }], paths: { "@/*": ["./*"] } }, include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"], exclude: ["node_modules"] }, null, 2) + "\n",
      type: "config",
    },
    {
      path: "next.config.mjs",
      content: `/** @type {import('next').NextConfig} */\nconst nextConfig = { images: { remotePatterns: [{ protocol: "https", hostname: "**" }] } }\nexport default nextConfig\n`,
      type: "config",
    },
    {
      path: "lib/utils.ts",
      content: `import { type ClassValue, clsx } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) { return twMerge(clsx(inputs)) }\n`,
      type: "config",
    },
    {
      path: "app/globals.css",
      content: `@import "tailwindcss";\n\n@theme {\n  --font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;\n  --radius-sm: 0.375rem;\n  --radius-md: 0.5rem;\n  --radius-lg: 0.75rem;\n  --radius-xl: 1rem;\n}\n\n@layer base {\n  * { border-color: transparent; }\n  body { background-color: var(--background); color: var(--foreground); font-feature-settings: "rlig" 1, "calt" 1; }\n}\n`,
      type: "style",
    },
  ]
}

export function compileManifest(manifest: ManifestAST, projectId: string): GeneratedFile[] {
  const files: GeneratedFile[] = [compileLayout(manifest), ...compileConfigs(manifest)]
  for (const page of manifest.pages) {
    files.push(compilePage(page, projectId))
  }
  return files
}

function pascalCase(s: string): string {
  return s.split(/[^a-zA-Z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join("")
}
