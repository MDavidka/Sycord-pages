// Single source of truth for a generated Vite project.
//
// Every AI stage (style, logic) and the deterministic orchestrator receive
// this manifest so they plan with knowledge of the WHOLE app — not just the
// page in front of them. Previously each stage ran blind: the style call for
// /about didn't know what /contact exported, so inter-page references were
// guesses that often missed. With a manifest the file/slug/logic/component
// names are pre-computed and consistent end-to-end.
//
// The manifest is built deterministically from the architect plan — no extra
// AI roundtrip is required to produce it.

import type { PlanEntry } from "./plan-types"

export interface ManifestPage {
  /** PascalCase React component name, e.g. "About" → exports function About(). */
  componentName: string
  /** React Router path starting with "/". First page is always "/". */
  route: string
  /** Filesystem-safe slug, e.g. "/" → "index", "/pricing" → "pricing". */
  slug: string
  /** Relative path of the emitted page file, e.g. "src/pages/about.tsx". */
  pageFile: string
  /** Relative path of the emitted logic module, e.g. "src/lib/about-logic.ts". */
  logicFile: string
  /** Import specifier for the logic module, e.g. "@/lib/about-logic". */
  logicModule: string
  /** Human-readable title set in <title> via document.title, e.g. "About Us". */
  pageTitle: string
  /** Short purpose/description from the architect plan (2–4 sentences). */
  description?: string
  /** Concrete user-facing features to implement on the page. */
  features?: string[]
}

export interface ManifestRouterRoute {
  path: string
  componentName: string
  importPath: string // e.g. "./pages/about"
}

export interface ManifestRouter {
  type: "react-router-dom"
  root: "App.tsx"
  routes: ManifestRouterRoute[]
}

export interface ProjectManifest {
  /** Full website brief the user typed into the builder. */
  brief: string
  pages: ManifestPage[]
  router: ManifestRouter
}

function toPascalCase(input: string): string {
  const candidate = (
    input
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("") || "GeneratedPage"
  )
  return /^[A-Za-z_]/.test(candidate) ? candidate : `Page${candidate}`
}

function pageSlug(routePath: string, fallbackPageName: string): string {
  if (routePath === "/") return "index"
  const slug = routePath
    .replace(/^\//, "")
    .replace(/[/:]+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  return slug || fallbackPageName.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "index"
}

/**
 * Turn the architect plan into a ProjectManifest. Deterministic: same plan
 * in ⇒ same manifest out. No AI call involved. Handles slug collisions by
 * suffixing `-2`, `-3`, …
 */
export function buildProjectManifest(brief: string, plan: PlanEntry[]): ProjectManifest {
  const used = new Set<string>()
  const pages: ManifestPage[] = plan.map((p, i) => {
    const componentName = toPascalCase(p.title || `Page${i + 1}`)
    const route = typeof p.path === "string" && p.path.trim() ? p.path.trim() : `/page-${i + 1}`
    let slug = pageSlug(route, componentName)
    let n = 2
    while (used.has(slug)) {
      slug = `${pageSlug(route, componentName)}-${n++}`
    }
    used.add(slug)
    const pageFile = `src/pages/${slug}.tsx`
    const logicFile = `src/lib/${slug}-logic.ts`
    const logicModule = `@/lib/${slug}-logic`
    const pageTitle = p.title || componentName
    return {
      componentName,
      route,
      slug,
      pageFile,
      logicFile,
      logicModule,
      pageTitle,
      description: p.description,
      features: p.features,
    }
  })

  const router: ManifestRouter = {
    type: "react-router-dom",
    root: "App.tsx",
    routes: pages.map((p) => ({
      path: p.route,
      componentName: p.componentName,
      importPath: `./pages/${p.slug}`,
    })),
  }

  return { brief, pages, router }
}

/**
 * Compact human-readable rendering of the manifest used inside AI prompts.
 * Models read this verbatim to understand what every sibling page is, what
 * file it lives in, and what it exports — which is the whole point of the
 * manifest: no more blind per-file generation.
 */
export function renderManifestForPrompt(manifest: ProjectManifest): string {
  const lines: string[] = []
  lines.push("PROJECT MANIFEST (authoritative — every sibling file is listed here):")
  lines.push(`  brief: ${manifest.brief}`)
  lines.push(`  pages:`)
  for (const p of manifest.pages) {
    lines.push(`    - component: ${p.componentName}`)
    lines.push(`      route: ${p.route}`)
    lines.push(`      pageFile: ${p.pageFile}`)
    lines.push(`      logicFile: ${p.logicFile}   (import specifier: ${p.logicModule})`)
    lines.push(`      pageTitle: ${JSON.stringify(p.pageTitle)}`)
    if (p.description) lines.push(`      description: ${p.description}`)
    if (p.features && p.features.length) {
      lines.push(`      features:`)
      for (const f of p.features) lines.push(`        • ${f}`)
    }
  }
  lines.push(`  router:`)
  lines.push(`    type: ${manifest.router.type}`)
  lines.push(`    root: ${manifest.router.root}`)
  for (const r of manifest.router.routes) {
    lines.push(`    - ${r.path} → ${r.componentName} (${r.importPath})`)
  }
  return lines.join("\n")
}
