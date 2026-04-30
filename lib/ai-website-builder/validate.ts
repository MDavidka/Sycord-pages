// Validators for both the AI-generated manifest (pre-render) and the
// emitted file payload (post-render). Both phases collect errors and
// warnings so the API can return useful diagnostics.

import type {
  BuilderFile,
  BuildValidationResult,
  GeneratedProjectManifest,
  PagePlan,
  SectionPlan,
} from "./types"

const FORBIDDEN_PHRASES = [
  "lorem ipsum",
  "production-ready responsive",
  "production ready responsive",
  "blah blah",
  "todo",
  "coming soon",
  "placeholder text",
  "responsive behavior",
]

const ALLOWED_KINDS: ReadonlySet<string> = new Set([
  "hero",
  "feature-grid",
  "stats",
  "testimonials",
  "pricing",
  "faq",
  "contact",
  "gallery",
  "product-grid",
  "comparison",
  "process",
  "cta",
  "logos",
  "team",
  "blog-preview",
])

export interface ManifestValidation {
  ok: boolean
  errors: string[]
  warnings: string[]
}

export function validateManifest(manifest: GeneratedProjectManifest): ManifestValidation {
  const errors: string[] = []
  const warnings: string[] = []

  if (!manifest?.brief?.projectName) errors.push("brief.projectName missing")
  if (!Array.isArray(manifest?.pages) || manifest.pages.length === 0) {
    errors.push("pages array missing or empty")
    return { ok: false, errors, warnings }
  }

  // Validate route table
  const seen = new Set<string>()
  for (const [i, page] of manifest.pages.entries()) {
    if (typeof page?.path !== "string") {
      errors.push(`pages[${i}].path missing`)
      continue
    }
    if (seen.has(page.path)) errors.push(`duplicate route ${page.path}`)
    seen.add(page.path)
    if (!Array.isArray(page.sections) || page.sections.length === 0) {
      errors.push(`pages[${i}] (${page.path}) has no sections`)
      continue
    }
  }
  if (!seen.has("/")) errors.push('home route "/" missing')

  // Per-page checks
  for (const page of manifest.pages) {
    pageWarnings(page, manifest.pages.map((p) => p.path), errors, warnings)
  }

  // Forbidden phrases (low priority — warnings only)
  const blob = JSON.stringify(manifest).toLowerCase()
  for (const bad of FORBIDDEN_PHRASES) {
    if (blob.includes(bad)) warnings.push(`copy contains generic phrase: "${bad}"`)
  }

  return { ok: errors.length === 0, errors, warnings }
}

function pageWarnings(
  page: PagePlan,
  knownRoutes: string[],
  errors: string[],
  warnings: string[],
) {
  for (const [i, section] of page.sections.entries()) {
    if (!section?.kind) {
      errors.push(`pages[${page.path}].sections[${i}].kind missing`)
      continue
    }
    if (!ALLOWED_KINDS.has(section.kind)) {
      errors.push(`pages[${page.path}].sections[${i}] unknown kind "${section.kind}"`)
    }
    sectionWarnings(page, section, i, knownRoutes, warnings)
  }

  if (page.path === "/" && page.sections.length < 5) {
    warnings.push(`home page has only ${page.sections.length} sections (target 5+)`)
  }
  // Detect repeated kind+variant combos in a row.
  let prev = ""
  for (const section of page.sections) {
    const sig = `${section.kind}:${section.variant ?? ""}`
    if (sig === prev) {
      warnings.push(`page ${page.path} has repeated layout: ${sig}`)
    }
    prev = sig
  }
  // Check internal hrefs.
  const hrefs = collectHrefs(page.sections)
  for (const href of hrefs) {
    if (!href || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) continue
    if (href.startsWith("#")) continue
    if (!knownRoutes.includes(href)) {
      warnings.push(`page ${page.path} links to unknown route "${href}"`)
    }
  }
}

function sectionWarnings(
  page: PagePlan,
  section: SectionPlan,
  i: number,
  _knownRoutes: string[],
  warnings: string[],
) {
  const where = `${page.path} sections[${i}](${section.kind})`
  switch (section.kind) {
    case "hero":
      if (!section.heading) warnings.push(`${where}: missing heading`)
      break
    case "pricing":
      if (!section.items?.length) warnings.push(`${where}: pricing has no tiers`)
      else if (!section.items.some((it) => it.highlighted)) {
        warnings.push(`${where}: no highlighted tier`)
      }
      break
    case "faq":
      if (!section.items?.length) warnings.push(`${where}: faq has no items`)
      break
    case "testimonials":
      if (!section.items?.length) warnings.push(`${where}: testimonials has no quotes`)
      break
    case "stats":
      if ((section.items?.length ?? 0) < 3) warnings.push(`${where}: stats should have 3+ values`)
      break
    case "feature-grid":
      if ((section.items?.length ?? 0) < 3) warnings.push(`${where}: feature-grid should have 3+ items`)
      break
    case "product-grid":
    case "gallery":
    case "team":
    case "logos":
    case "blog-preview":
    case "process":
      if (!section.items?.length) warnings.push(`${where}: needs items`)
      break
    case "comparison":
      if (!section.items?.length) warnings.push(`${where}: comparison needs row items`)
      break
  }
}

function collectHrefs(sections: SectionPlan[]): string[] {
  const out: string[] = []
  for (const s of sections) {
    if (s.primaryCta?.href) out.push(s.primaryCta.href)
    if (s.secondaryCta?.href) out.push(s.secondaryCta.href)
    for (const it of s.items ?? []) {
      if (it.href) out.push(it.href)
      if (it.cta?.href) out.push(it.cta.href)
    }
  }
  return out
}

// File-level validators run AFTER rendering. They catch obvious TSX issues:
// missing default exports, dangling shadcn imports, missing required files,
// duplicate routes that crept through, etc.
export function runBuildValidation(files: BuilderFile[]): BuildValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const fileMap = new Map(files.map((f) => [f.path, f.content]))

  const required = [
    "package.json",
    "tsconfig.json",
    "postcss.config.js",
    "next.config.mjs",
    "app/layout.tsx",
    "app/globals.css",
    "app/page.tsx",
    "components/site-header.tsx",
    "components/site-footer.tsx",
    "components/ui/button.tsx",
    "components/ui/badge.tsx",
    "components/ui/card.tsx",
    "components/ui/separator.tsx",
    "lib/utils.ts",
    "lib/site-config.ts",
    "lib/generated-manifest.ts",
  ]
  for (const need of required) {
    if (!fileMap.has(need)) errors.push(`missing required file: ${need}`)
  }

  const tsxFiles = files.filter((f) => f.path.endsWith(".tsx"))
  const routeFiles = tsxFiles.filter((f) => f.path.startsWith("app/") && f.path.endsWith("/page.tsx") || f.path === "app/page.tsx")

  // Default export check on routes.
  for (const f of routeFiles) {
    if (!/export\s+default\s+function/.test(f.content)) {
      errors.push(`route file missing default export: ${f.path}`)
    }
  }

  // Empty file check.
  for (const [p, c] of fileMap) {
    if (!c.trim()) errors.push(`empty file: ${p}`)
  }

  // shadcn import → local component must exist.
  const knownUiFiles = new Set(
    files.filter((f) => f.path.startsWith("components/ui/")).map((f) => f.path.replace(/\.tsx$/, "")),
  )
  const shadcnImport = /from\s+"@\/components\/ui\/([a-z-]+)"/g
  for (const f of tsxFiles) {
    let m: RegExpExecArray | null
    while ((m = shadcnImport.exec(f.content)) != null) {
      const slug = m[1]
      if (!knownUiFiles.has(`components/ui/${slug}`)) {
        errors.push(`${f.path} imports @/components/ui/${slug} but components/ui/${slug}.tsx is missing`)
      }
    }
  }

  // Forbidden filler.
  for (const [p, c] of fileMap) {
    const lower = c.toLowerCase()
    for (const bad of FORBIDDEN_PHRASES) {
      if (lower.includes(bad)) warnings.push(`${p} contains "${bad}"`)
    }
  }

  // Postcss / next config sanity.
  const postcss = fileMap.get("postcss.config.js") || ""
  if (!postcss.includes("@tailwindcss/postcss")) {
    errors.push("postcss.config.js must use @tailwindcss/postcss plugin")
  }
  const nextConfig = fileMap.get("next.config.mjs") || ""
  if (!nextConfig.includes("output:") || !nextConfig.includes("export")) {
    warnings.push('next.config.mjs should set output: "export" for static deploy')
  }

  // Duplicate routes.
  const routes = new Set<string>()
  for (const f of routeFiles) {
    const route = f.path === "app/page.tsx" ? "/" : f.path.replace(/^app/, "").replace(/\/page\.tsx$/, "")
    if (routes.has(route)) errors.push(`duplicate route emitted: ${route}`)
    routes.add(route)
  }

  return { ok: errors.length === 0, errors, warnings, attempts: 1 }
}

// Quality score in [0, 100] based on warnings + section variety.
export function computeQualityScore(manifest: GeneratedProjectManifest, build: BuildValidationResult): number {
  let score = 100
  score -= build.errors.length * 10
  score -= build.warnings.length * 2
  // Reward unique section kinds on home page.
  const home = manifest.pages.find((p) => p.path === "/")
  if (home) {
    const kinds = new Set(home.sections.map((s) => s.kind))
    score += Math.min(20, kinds.size * 3)
  }
  // Reward multiple distinct internal pages.
  if (manifest.pages.length >= 3) score += 5
  if (manifest.pages.length >= 5) score += 5
  return Math.max(0, Math.min(100, score))
}
