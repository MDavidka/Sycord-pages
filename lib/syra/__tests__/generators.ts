// Shared fast-check generators + a pinned copy of the pre-change parser for the
// Syra creative-builder property-based tests (Properties 1-9).
//
// The "pinned" reference parser (`legacyReferenceParse`) reproduces the exact
// projection the parser produced BEFORE design/manifest were added, so Property
// 6 can assert byte-for-byte backward compatibility of the existing fields.

import fc from "fast-check"
import type {
  ProjectFramework,
  RouterKind,
  SyraPlan,
  SyraPlanDesign,
  SyraPlanPage,
  SyraSiteManifest,
} from "../types"

// ---------------------------------------------------------------------------
// Primitive helpers
// ---------------------------------------------------------------------------

/**
 * A recognizable, always-non-empty, whitespace-free token. Using a labelled
 * token makes `expect(prompt).toContain(token)` assertions reliable and lets us
 * tell generated values apart in the prompt output.
 */
const token = (label: string): fc.Arbitrary<string> =>
  fc.integer({ min: 0, max: 100000 }).map((n) => `${label}-${n}`)

const optionalToken = (label: string): fc.Arbitrary<string | undefined> =>
  fc.option(token(label), { nil: undefined })

/** Distinct candidate page paths (unique within a single generated plan). */
const PATH_POOL = [
  "app/page.tsx",
  "app/about/page.tsx",
  "app/pricing/page.tsx",
  "app/contact/page.tsx",
  "app/blog/page.tsx",
  "app/features/page.tsx",
  "app/docs/page.tsx",
]

const uniquePaths = (max = PATH_POOL.length) =>
  fc.uniqueArray(fc.constantFrom(...PATH_POOL), { minLength: 1, maxLength: max })

// ---------------------------------------------------------------------------
// Framework generator (varied entryFile / router) — Property 7
// ---------------------------------------------------------------------------

export const arbitraryFramework: fc.Arbitrary<ProjectFramework> = fc.record({
  framework: fc.constantFrom("Next.js", "React (Vite)", "Static HTML"),
  router: fc.constantFrom<RouterKind>("app", "src-app", "pages", "unknown"),
  language: fc.constantFrom("typescript" as const, "javascript" as const, "unknown" as const),
  styling: fc.constant("Tailwind CSS"),
  packageManager: fc.constantFrom(
    "npm" as const,
    "pnpm" as const,
    "yarn" as const,
    "bun" as const,
    "unknown" as const,
  ),
  entryFile: fc.constantFrom(
    "app/page.tsx",
    "src/app/page.tsx",
    "pages/index.tsx",
    "index.html",
  ),
  componentsDir: fc.constant("components"),
  isEmpty: fc.boolean(),
  notes: fc.array(token("note"), { maxLength: 3 }),
})

// ---------------------------------------------------------------------------
// In-memory SyraPlan generator — Properties 8 & 9
// ---------------------------------------------------------------------------

const designArb: fc.Arbitrary<SyraPlanDesign> = fc.record({
  style: token("style"),
  colors: token("colors"),
  typography: token("typography"),
  layout: token("layout"),
})

const pageArbFor = (path: string): fc.Arbitrary<SyraPlanPage> =>
  fc.record({
    path: fc.constant(path),
    title: token("title"),
    purpose: token("purpose"),
    sections: fc.array(token("section"), { minLength: 1, maxLength: 4 }),
    design: fc.record({
      visualApproach: token("va"),
      mood: token("mood"),
      sectionLayouts: fc.array(token("sl"), { minLength: 1, maxLength: 3 }),
    }),
  })

export const arbitraryPlan: fc.Arbitrary<SyraPlan> = uniquePaths()
  .chain((paths) =>
    fc.record({
      summary: token("summary"),
      design: designArb,
      steps: fc.array(token("step"), { minLength: 1, maxLength: 4 }),
      pages: fc.tuple(...paths.map(pageArbFor)) as unknown as fc.Arbitrary<SyraPlanPage[]>,
      components: fc.array(token("components/comp"), { maxLength: 3 }),
      backend: fc.array(token("app/api/x/route.ts"), { maxLength: 3 }),
      sharedLayout: token("sharedLayout"),
      metadata: token("metadata"),
    }),
  )
  .map((p): SyraPlan => {
    const manifest: SyraSiteManifest = {
      routes: p.pages.map((pg) => pg.path),
      navigation: p.pages.map((pg) => ({ label: `navlabel-${pg.path}`, route: pg.path })),
      sharedLayout: p.sharedLayout,
      backendEndpoints: p.backend,
      metadata: p.metadata,
    }
    return {
      summary: p.summary,
      design: p.design,
      steps: p.steps,
      pages: p.pages,
      components: p.components,
      backend: p.backend,
      manifest,
      files: [],
    }
  })

// ---------------------------------------------------------------------------
// JSON-text generators feeding parsePlan — Properties 1-5
// ---------------------------------------------------------------------------

/** A plan-shaped plain object (some design/manifest content optionally omitted). */
export const arbitraryPlanSource: fc.Arbitrary<any> = uniquePaths().chain((paths) =>
  fc.record({
    summary: optionalToken("summary"),
    design: fc.option(
      fc.record({
        style: optionalToken("style"),
        colors: optionalToken("colors"),
        typography: optionalToken("typography"),
        layout: optionalToken("layout"),
      }),
      { nil: undefined },
    ),
    steps: fc.option(fc.array(token("step"), { maxLength: 4 }), { nil: undefined }),
    pages: fc.tuple(
      ...paths.map((path) =>
        fc.record({
          path: fc.constant(path),
          title: optionalToken("title"),
          purpose: optionalToken("purpose"),
          sections: fc.option(fc.array(token("section"), { maxLength: 4 }), { nil: undefined }),
          design: fc.option(
            fc.record({
              visualApproach: optionalToken("va"),
              mood: optionalToken("mood"),
              sectionLayouts: fc.option(fc.array(token("sl"), { maxLength: 3 }), {
                nil: undefined,
              }),
            }),
            { nil: undefined },
          ),
        }),
      ),
    ),
    components: fc.option(fc.array(token("components/comp"), { maxLength: 3 }), { nil: undefined }),
    backend: fc.option(fc.array(token("app/api/x/route.ts"), { maxLength: 3 }), { nil: undefined }),
    manifest: fc.option(
      fc.record({
        routes: fc.option(fc.array(token("route"), { maxLength: 3 }), { nil: undefined }),
        navigation: fc.option(
          fc.array(fc.record({ label: token("navlabel"), route: token("navroute") }), {
            maxLength: 3,
          }),
          { nil: undefined },
        ),
        sharedLayout: optionalToken("sharedLayout"),
        backendEndpoints: fc.option(fc.array(token("be/route.ts"), { maxLength: 3 }), {
          nil: undefined,
        }),
        metadata: optionalToken("metadata"),
      }),
      { nil: undefined },
    ),
    files: fc.option(
      fc.array(fc.record({ path: token("file/x.tsx"), purpose: token("purpose") }), {
        maxLength: 3,
      }),
      { nil: undefined },
    ),
  }),
)

/** A plan-shaped JSON string (parsePlan input). */
export const arbitraryPlanJson: fc.Arbitrary<string> = arbitraryPlanSource.map((o) =>
  JSON.stringify(o),
)

/** A legacy (pre-change) plan object: NO per-page design, NO manifest. */
export const arbitraryLegacyPlanSource: fc.Arbitrary<any> = uniquePaths().chain((paths) =>
  fc.record({
    summary: optionalToken("summary"),
    design: fc.option(
      fc.record({
        style: optionalToken("style"),
        colors: optionalToken("colors"),
        typography: optionalToken("typography"),
        layout: optionalToken("layout"),
      }),
      { nil: undefined },
    ),
    steps: fc.option(fc.array(token("step"), { maxLength: 4 }), { nil: undefined }),
    pages: fc.tuple(
      ...paths.map((path) =>
        fc.record({
          path: fc.constant(path),
          title: optionalToken("title"),
          purpose: optionalToken("purpose"),
          sections: fc.option(fc.array(token("section"), { maxLength: 4 }), { nil: undefined }),
        }),
      ),
    ),
    components: fc.option(fc.array(token("components/comp"), { maxLength: 3 }), { nil: undefined }),
    backend: fc.option(fc.array(token("app/api/x/route.ts"), { maxLength: 3 }), { nil: undefined }),
    files: fc.option(
      fc.array(fc.record({ path: token("file/x.tsx"), purpose: token("purpose") }), {
        maxLength: 3,
      }),
      { nil: undefined },
    ),
  }),
)

export const arbitraryLegacyPlanJson: fc.Arbitrary<string> = arbitraryLegacyPlanSource.map((o) =>
  JSON.stringify(o),
)

/** Free text guaranteed to contain no parseable JSON (forces the catch fallback). */
export const arbitraryNonJsonText: fc.Arbitrary<string> = fc
  .string()
  .filter((s) => !s.includes("{") && !s.includes("}"))
  .filter((s) => {
    try {
      JSON.parse(s)
      return false
    } catch {
      return true
    }
  })

// ---------------------------------------------------------------------------
// Pinned legacy reference parser (pre-change parser output projection) —
// Property 6 backward-compatibility comparison. DO NOT evolve this with the
// real parser; it is intentionally frozen.
// ---------------------------------------------------------------------------

export interface LegacyPlanProjection {
  summary: string
  design: SyraPlanDesign
  steps: string[]
  pages: { path: string; title: string; purpose: string; sections: string[] }[]
  components: string[]
  backend: string[]
  files: { path: string; purpose: string }[]
}

function legacyAsStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean)
  return []
}

export function legacyReferenceParse(text: string): LegacyPlanProjection {
  let raw = (text || "").trim()
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1)

  const fallbackDesign: SyraPlanDesign = {
    style: "modern, polished, responsive",
    colors: "theme tokens with a clear accent",
    typography: "strong headings, readable body",
    layout: "sticky top nav, spacious sections, footer",
  }

  try {
    const obj = JSON.parse(raw)

    const design: SyraPlanDesign = {
      style: String(obj?.design?.style || fallbackDesign.style).trim(),
      colors: String(obj?.design?.colors || fallbackDesign.colors).trim(),
      typography: String(obj?.design?.typography || fallbackDesign.typography).trim(),
      layout: String(obj?.design?.layout || fallbackDesign.layout).trim(),
    }

    const pages = Array.isArray(obj.pages)
      ? obj.pages
          .map((p: any) => ({
            path: String(p?.path || "").trim(),
            title: String(p?.title || "").trim() || "Page",
            purpose: String(p?.purpose || "").trim(),
            sections: legacyAsStringArray(p?.sections),
          }))
          .filter((p: any) => p.path)
      : []

    const components = legacyAsStringArray(obj.components)
    const backend = legacyAsStringArray(obj.backend)

    const explicitFiles = Array.isArray(obj.files)
      ? obj.files
          .map((f: any) => ({ path: String(f?.path || "").trim(), purpose: String(f?.purpose || "").trim() }))
          .filter((f: any) => f.path)
      : []
    const derivedFiles = [
      ...pages.map((p: any) => ({ path: p.path, purpose: `${p.title} page` })),
      ...components.map((c) => ({ path: c, purpose: "shared component" })),
      ...backend.map((b) => ({ path: b.split(/\s/)[0].trim(), purpose: "backend" })),
    ].filter((f) => f.path && /[/.]/.test(f.path))
    const files = explicitFiles.length ? explicitFiles : derivedFiles

    const steps = legacyAsStringArray(obj.steps)
    return {
      summary: String(obj.summary || "Build the requested website").trim(),
      design,
      steps: steps.length ? steps : ["Design the pages", "Build shared layout", "Generate each page", "Wire backend"],
      pages,
      components,
      backend,
      files,
    }
  } catch {
    return {
      summary: "Build the requested website",
      design: fallbackDesign,
      steps: ["Inspect the project", "Generate the requested files", "Validate output"],
      pages: [],
      components: [],
      backend: [],
      files: [],
    }
  }
}

/** Project a full plan down to the legacy field set for backward-compat checks. */
export function projectLegacyFields(plan: SyraPlan): LegacyPlanProjection {
  return {
    summary: plan.summary,
    design: plan.design,
    steps: plan.steps,
    pages: plan.pages.map((p) => ({
      path: p.path,
      title: p.title,
      purpose: p.purpose,
      sections: p.sections,
    })),
    components: plan.components,
    backend: plan.backend,
    files: plan.files,
  }
}
