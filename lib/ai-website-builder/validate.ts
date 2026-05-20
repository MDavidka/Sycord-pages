// Validators for both the AI-generated manifest (pre-render) and the
// emitted file payload (post-render). Both phases collect errors and
// warnings so the API can return useful diagnostics.

import type {
  BuilderFile,
  BuildValidationResult,
  ComponentNode,
  GeneratedProjectManifest,
  PagePlan,
  SectionPlan,
} from "./types"
import { isAllowedComponentNode } from "./sections"

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
  "custom",
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
  if (!manifest?.designDirection?.concept) warnings.push("designDirection.concept missing")
  if (manifest?.deploymentMode !== "next-server") errors.push('deploymentMode must be "next-server"')
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
  const componentIds = new Set<string>()
  for (const [i, section] of page.sections.entries()) {
    if (!section?.kind) {
      errors.push(`pages[${page.path}].sections[${i}].kind missing`)
      continue
    }
    if (section.componentTree) {
      validateComponentTree(section.componentTree, `pages[${page.path}].sections[${i}].componentTree`, componentIds, errors, warnings)
    }
    if (!ALLOWED_KINDS.has(section.kind)) {
      errors.push(`pages[${page.path}].sections[${i}] unknown kind "${section.kind}"`)
    }
    sectionWarnings(page, section, i, knownRoutes, warnings)
  }

  if (page.path === "/" && page.sections.length < 5) {
    warnings.push(`home page has only ${page.sections.length} sections (target 5+)`)
  }
  if (page.path === "/") {
    const conservative = new Set(["hero:centered", "hero:split", "feature-grid:cards", "feature-grid:icon-grid", "cta:banner"])
    const conservativeCount = page.sections.filter((section) => conservative.has(`${section.kind}:${section.variant ?? ""}`)).length
    const uniqueKinds = new Set(page.sections.map((section) => section.kind))
    if (conservativeCount >= Math.max(3, Math.ceil(page.sections.length * 0.6))) {
      warnings.push("home page uses mostly conservative variants; consider cinematic, magazine-cover, asymmetric-bento, proof-led, gallery, or process sections")
    }
    if (uniqueKinds.size < Math.min(5, page.sections.length)) {
      warnings.push(`home page has only ${uniqueKinds.size} distinct section kinds`)
    }
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
    case "custom":
      return
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
    collectComponentHrefs(s.componentTree, out)
  }
  return out
}

function collectComponentHrefs(node: ComponentNode | undefined, out: string[]) {
  if (!node) return
  if (typeof node.props?.href === "string") out.push(node.props.href)
  for (const child of node.children ?? []) collectComponentHrefs(child, out)
}

function isJsonSafe(value: unknown, depth = 0): boolean {
  if (depth > 6) return false
  if (value === null) return true
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return true
  if (Array.isArray(value)) return value.every((entry) => isJsonSafe(entry, depth + 1))
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).every((entry) => isJsonSafe(entry, depth + 1))
  return false
}

function containsRawJsx(value: unknown): boolean {
  return typeof value === "string" && (/<[A-Z_a-z][^>]*>/.test(value) || /<\/[A-Z_a-z]/.test(value) || /\{.*=>.*\}/.test(value))
}

function validateComponentTree(
  node: ComponentNode,
  where: string,
  ids: Set<string>,
  errors: string[],
  warnings: string[],
  depth = 0,
) {
  if (depth > 10) {
    errors.push(`${where}: component tree exceeds maximum depth`)
    return
  }
  if (!node.id) errors.push(`${where}: component node id missing`)
  else if (ids.has(node.id)) errors.push(`${where}: duplicate component node id "${node.id}"`)
  else ids.add(node.id)

  if (!isAllowedComponentNode(node.component)) {
    errors.push(`${where}: unknown component "${node.component}"`)
  }
  if (node.props !== undefined && !isJsonSafe(node.props)) {
    errors.push(`${where}: props must be JSON-safe`)
  }
  if (containsRawJsx(node.text)) {
    errors.push(`${where}: text must not contain raw JSX`)
  }
  for (const [key, value] of Object.entries(node.props ?? {})) {
    if (containsRawJsx(value)) errors.push(`${where}.props.${key}: raw JSX strings are not allowed`)
    if (/^on[A-Z]/.test(key)) warnings.push(`${where}.props.${key}: event handler prop ignored by renderer`)
    if (key === "href" && typeof value === "string" && !/^(\/|#|https?:\/\/|mailto:|tel:)/.test(value)) {
      errors.push(`${where}.props.href: invalid link "${value}"`)
    }
  }
  for (const [i, child] of (node.children ?? []).entries()) {
    validateComponentTree(child, `${where}.children[${i}]`, ids, errors, warnings, depth + 1)
  }
}

export interface RunBuildValidationOpts {
  needsDatabase?: boolean
  deploymentMode?: GeneratedProjectManifest["deploymentMode"]
  // Integration ids (matching Sycord's envVar.integration field, e.g.
  // "stripe", "firebase", "resend") that are actually connected on the
  // project. If provided, the validator flags any imports of those
  // integration SDKs in generated files.
  connectedIntegrationIds?: string[]
}

// Patterns we treat as hard-coded secrets in generated source. The file
// scaffolder only reads secrets via `process.env.X`, so anything matching
// these patterns is a planner/AI slip we want to surface.
const HARD_CODED_SECRET_PATTERNS: { name: string; pattern: RegExp }[] = [
  { name: "libsql URL", pattern: /libsql:\/\/[A-Za-z0-9._-]+/g },
  { name: "Turso auth token", pattern: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g },
  { name: "Stripe secret key", pattern: /sk_(?:live|test)_[A-Za-z0-9]{12,}/g },
  { name: "Stripe publishable key", pattern: /pk_(?:live|test)_[A-Za-z0-9]{12,}/g },
  { name: "Generic hex API key", pattern: /(?:api[_-]?key|apikey)\s*[:=]\s*["'][A-Za-z0-9]{24,}["']/gi },
]

// File-level validators run AFTER rendering. They catch obvious TSX issues:
// missing default exports, dangling shadcn imports, missing required files,
// duplicate routes that crept through, etc.
export function runBuildValidation(files: BuilderFile[], opts: RunBuildValidationOpts = {}): BuildValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const fileMap = new Map(files.map((f) => [f.path, f.content]))
  const needsDatabase = opts.needsDatabase ?? false
  const deploymentMode = opts.deploymentMode ?? "next-server"

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
  for (const path of fileMap.keys()) {
    if (/^\.env(?:\.|$)/.test(path) || /\/\.env(?:\.|$)/.test(path)) {
      errors.push(`${path} must not be generated; use project env vars / VM deploy env`)
    }
  }

  // Database-specific required files (only when the planner said so).
  if (needsDatabase) {
    const dbRequired = [
      "lib/db/client.ts",
      "lib/db/schema.ts",
      "lib/db/queries.ts",
    ]
    for (const need of dbRequired) {
      if (!fileMap.has(need)) errors.push(`missing required database file: ${need}`)
    }
    const packageJson = fileMap.get("package.json") || ""
    if (!/\"@libsql\/client\"/.test(packageJson)) {
      errors.push("package.json missing @libsql/client dependency required for Turso integration")
    }
  } else {
    // When no DB is needed, we shouldn't emit dangling db imports either.
    for (const [p, c] of fileMap) {
      if (/@\/lib\/db\//.test(c) && p !== "lib/db/client.ts") {
        errors.push(`${p} imports @/lib/db/* but needsDatabase is false`)
      }
    }
    const packageJson = fileMap.get("package.json") || ""
    if (/\"@libsql\/client\"/.test(packageJson)) {
      errors.push("package.json must not include @libsql/client when needsDatabase is false")
    }
  }

  if (deploymentMode !== "next-server") {
    errors.push('deploymentMode must be "next-server"')
  }
  const nextConfig = fileMap.get("next.config.mjs")
  if (!nextConfig) {
    errors.push("next.config.mjs must exist")
  } else if (/output\s*:\s*["']export["']/.test(nextConfig)) {
    errors.push('next.config.mjs must not contain output: "export"')
  }
  const packageJson = fileMap.get("package.json") || ""
  try {
    const pkg = JSON.parse(packageJson) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
    if (!pkg.scripts?.start || !pkg.scripts.start.includes("next start")) {
      errors.push('package.json must include a working "start" script using next start')
    } else if (!pkg.scripts.start.includes("-H 0.0.0.0")) {
      errors.push('package.json start script must bind to 0.0.0.0 for VM runner compatibility')
    }
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }
    for (const dep of ["next", "react", "react-dom"]) {
      if (!deps[dep]) errors.push(`package.json missing ${dep} dependency`)
    }
  } catch {
    errors.push("package.json must be valid JSON")
  }

  // If any file imports @/lib/db/*, the client file must exist.
  const dbImport = /@\/lib\/db\/([a-z-]+)/g
  for (const [p, c] of fileMap) {
    let m: RegExpExecArray | null
    while ((m = dbImport.exec(c)) != null) {
      const path = `lib/db/${m[1]}.ts`
      if (!fileMap.has(path)) {
        errors.push(`${p} imports @/lib/db/${m[1]} but ${path} is missing`)
      }
    }
  }

  // Site config must include a logo initials fallback so the header/footer
  // never render an empty badge when no logo URL is configured.
  const siteConfig = fileMap.get("lib/site-config.ts") || ""
  if (siteConfig && !/\"logoInitials\"\s*:\s*\"[A-Za-z0-9]{1,4}\"/.test(siteConfig)) {
    errors.push("lib/site-config.ts must include a non-empty logoInitials fallback")
  }

  // Hard-coded secret detection. Generated output must not include `.env`
  // files; runtime secrets come from project settings / deploy env only.
  const secretSkip = new Set(["package.json"])
  for (const [p, c] of fileMap) {
    if (secretSkip.has(p)) continue
    for (const { name, pattern } of HARD_CODED_SECRET_PATTERNS) {
      pattern.lastIndex = 0
      if (pattern.test(c)) {
        errors.push(`${p} appears to contain a hard-coded ${name}; secrets must only be read from process.env`)
      }
    }
  }

  // Check for integration SDK imports that the user hasn't actually
  // connected. Only flags obvious integration packages; string keywords
  // like "stripe" in marketing copy are ignored.
  if (opts.connectedIntegrationIds !== undefined) {
    const connected = new Set(opts.connectedIntegrationIds)
    const integrationSdkChecks: Array<{ id: string; patterns: RegExp[] }> = [
      { id: "stripe", patterns: [/from\s+["']stripe["']/, /from\s+["']@stripe\//] },
      { id: "firebase", patterns: [/from\s+["']firebase\//, /from\s+["']firebase-admin/] },
      { id: "resend", patterns: [/from\s+["']resend["']/] },
      { id: "clerk", patterns: [/from\s+["']@clerk\//] },
      { id: "supabase", patterns: [/from\s+["']@supabase\/supabase-js["']/] },
      { id: "openai", patterns: [/from\s+["']openai["']/] },
      { id: "paypal", patterns: [/from\s+["']@paypal\//] },
      { id: "mongodb", patterns: [/from\s+["']mongodb["']/, /from\s+["']mongoose["']/] },
    ]
    for (const [p, c] of fileMap) {
      if (p === "package.json" || /^\.env(?:\.|$)/.test(p)) continue
      for (const { id, patterns } of integrationSdkChecks) {
        if (connected.has(id)) continue
        for (const pattern of patterns) {
          if (pattern.test(c)) {
            errors.push(`${p} imports a ${id} SDK but the ${id} integration is not connected to this project`)
            break
          }
        }
      }
    }
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
