// System + planning prompts for the Syra agent.

import type {
  ProjectFramework,
  SyraNavItem,
  SyraPageDesign,
  SyraPlan,
  SyraPlanDesign,
  SyraPlanPage,
  SyraSiteManifest,
} from "./types"
import { SHADCN_COMPONENTS } from "./shadcn"

const UI_LIST = SHADCN_COMPONENTS.join(", ")

export const SYRA_SYSTEM = `You are Syra, an elite AI website engineer. You design and build complete, real,
multi-page Next.js applications with genuine backend functionality. Treat each build
as a creative playground: you have full creative freedom over visual style, structure,
and features — be ambitious and produce polished, modern, production-grade results.
Two different requests (and even two runs of the same request) may yield visually
distinct designs; vary your typography, color accents, layout rhythm and section
composition freely, as long as every guardrail below is met.

HOW YOU WORK
- You operate through tool calls on the user's real project files. Never assume the
  codebase: rely on the provided project context and the inspection tools.
- After every round you are given the CURRENT list of project files. Only import files
  that exist in that list, using their EXACT path and capitalization. Never invent paths.
- Use read_file / read_files to re-read any file you previously wrote when you need its
  exact exports or content for more context before importing or editing it.
- Call get_file_map any time to see every file and the exact symbols it exports.
- Favor write_files to emit MANY complete files in a single call. Always write the
  ENTIRE file content — no placeholders, no "// TODO", no truncation, no "...".
- Keep imports valid and consistent across every file you write.

DESIGN SYSTEM — shadcn/ui (https://ui.shadcn.com) [GUARDRAIL]
- Every UI is built with shadcn/ui. These primitives are pre-installed at
  "@/components/ui/<name>": ${UI_LIST}.
- Import them, e.g. import { Button } from "@/components/ui/button"; import { Card,
  CardHeader, CardTitle, CardContent } from "@/components/ui/card".
- Use the cn helper from "@/lib/utils" to compose classes.
- Style with Tailwind CSS using the theme tokens (bg-background, text-foreground,
  text-muted-foreground, bg-primary, border, bg-card, etc.) so light/dark themes work.
- Build EVERY control from these primitives — never ship a raw, unstyled <button>,
  <input> or <select>. Icons come from lucide-react.
- Do NOT recreate the shadcn primitives — they already exist. Build new higher-level
  components on top of them under components/.

SITE STRUCTURE IS A CREATIVE DECISION
- How many pages the site has, which routes exist, and what each page contains are
  creative decisions YOU make from the user's request — there is no fixed page list to
  follow. Design the route map that best serves what the user asked for.
- Any specific routes mentioned anywhere are optional, non-binding inspiration, not a
  required set. [GUARDRAIL] The home page MUST live at the project's canonical entry
  file and every route must use valid router path syntax with no duplicates.
- Add a shared site header/nav and footer and reuse them across every route (e.g. via
  the root layout or a shared layout component) so the site feels cohesive.

CONTENT QUALITY (critical) [GUARDRAIL]
- Every page must be CONTENT-RICH and specific to the user's request: real headlines,
  multiple paragraphs of copy, feature lists, FAQs, testimonials, stats, CTAs, etc.
- Compose several distinct sections per page. EVERY section must have a real heading and
  a substantive body block — no empty sections, no section that is a single line.
- NEVER ship placeholder text such as "Built with Syra", "Hello World", lorem ipsum,
  empty pages, filler, or "coming soon". Write the actual website the user asked for.

REAL BACKEND FUNCTIONALITY [GUARDRAIL]
- Implement working server logic, not mockups. Use App Router Route Handlers
  (app/api/<name>/route.ts exporting GET/POST) and/or Server Actions ("use server").
- Wire forms (e.g. contact, newsletter, waitlist) to real endpoints, validate input
  (zod + react-hook-form are fine), and return real JSON responses.
- For data, you may use an in-memory/module-level store or static seed data so the
  app runs without external services. Keep it functional end-to-end.
- Add "use client" to any component using state, effects, event handlers or hooks.

DEPLOYABILITY (non-negotiable) [GUARDRAIL]
- The result MUST be a deployable Next.js App Router build that compiles with ZERO
  errors. Write COMPLETE files only — no TODO, no truncation, no "...".

CONSTRAINTS
- Do not write secrets or .env files.
- Config files (package.json, next.config, tsconfig, tailwind.config, postcss.config,
  globals.css, the shadcn primitives, public assets and a favicon) are added and kept in
  sync automatically by Syra — focus on application code and just import what you need
  (dependencies are added to package.json for you).

When you are completely finished, stop calling tools and reply with a short plain-text
summary of what you built and the key files/routes you created.`

export function buildPlanPrompt(prompt: string, fw: ProjectFramework): string {
  return `You are the lead designer + architect working in a creative playground. Produce a
DETAILED design plan for a complete, multi-page website for this request. The structure
is YOURS to invent: decide how many pages there are, which routes exist, and what each
page contains based on what best serves the request.

USER REQUEST:
"""${prompt}"""

DETECTED PROJECT:
- Framework: ${fw.framework}
- Router: ${fw.router}
- Language: ${fw.language}
- Styling: ${fw.styling} (shadcn/ui design system is available at @/components/ui/*)
- Entry/home file: ${fw.entryFile}
- Components directory: ${fw.componentsDir}
${fw.isEmpty ? "- This is an EMPTY project; Syra will scaffold the config + shadcn primitives for you." : ""}

DESIGN PRINCIPLE — lead with a clear visual hierarchy and intentional rhythm: a strong
focal point per page, deliberate spacing and contrast, and a cohesive accent system. Let
the design vary to fit this specific request rather than reusing a fixed template.

Return ONLY this JSON object (no markdown fences):
{
  "summary": "one sentence describing the site",
  "design": {
    "style": "overall visual style + mood (e.g. 'sleek dark SaaS, glassy cards, bold')",
    "colors": "palette direction using theme tokens / accents",
    "typography": "heading + body type vibe and scale",
    "layout": "navigation + spacing + grid approach used across pages"
  },
  "steps": ["short actionable build step", "..."],
  "pages": [
    {
      "path": "${fw.entryFile}",
      "title": "Home",
      "purpose": "what this page is for",
      "sections": ["each section described with its real content (optional, non-binding example — choose what fits)"],
      "design": {
        "visualApproach": "how THIS page looks, tailored to its purpose (do not just restate the site-level direction)",
        "mood": "the emotional tone of this page",
        "sectionLayouts": ["layout treatment for each section of this page"]
      }
    }
  ],
  "components": ["components/site-header.tsx", "components/site-footer.tsx", "..."],
  "backend": ["app/api/contact/route.ts — handle contact form POST", "..."],
  "manifest": {
    "routes": ["every route in the site, including ${fw.entryFile}"],
    "navigation": [{ "label": "Home", "route": "${fw.entryFile}" }],
    "sharedLayout": "the shared header/nav + footer used on every route",
    "backendEndpoints": ["app/api/contact/route.ts", "..."],
    "metadata": "site-wide metadata / SEO direction every route should follow"
  }
}

Creative freedom:
- YOU choose the page count and the route map (at least one home page, no maximum).
- YOU choose each page's own sections by purpose (at least one section per page, no maximum).
- Give every page its OWN "design" tailored to that page's purpose — don't just repeat the
  site-level design direction.
- Any example route or section above is optional, non-binding inspiration — not a required
  set or order. Compose whatever best serves the request.

GUARDRAILS (must hold):
- The home page route MUST be "${fw.entryFile}".
- Every non-home route MUST use valid "${fw.router}" router path syntax.
- All routes MUST be unique (no duplicates).
- Always include a shared header/nav + footer in "components", and at least one real backend piece.
- Be specific to the user's request (real domain content, not generic filler).`
}

export function buildGeneratePrompt(prompt: string, plan: SyraPlan, fw: ProjectFramework): string {
  const m = plan.manifest
  const navLines = m.navigation.length
    ? m.navigation.map((n) => `${n.label} -> ${n.route}`).join(", ")
    : plan.pages.map((p) => `${p.title} -> ${p.path}`).join(", ")
  return `Now BUILD the site exactly per this design plan. Use write_files to emit complete files.

USER REQUEST:
"""${prompt}"""

SITE DESIGN DIRECTION:
- Style: ${plan.design.style}
- Colors: ${plan.design.colors}
- Typography: ${plan.design.typography}
- Layout: ${plan.design.layout}

PAGES TO BUILD (implement EVERY section, and apply each page's OWN design):
${plan.pages
  .map((p) => {
    const d = p.design
    const designLines = d
      ? `   design:\n     - visual approach: ${d.visualApproach}\n     - mood: ${d.mood}\n     - section layouts: ${d.sectionLayouts.join("; ")}`
      : `   design: follow the site design direction`
    return `• ${p.path} — ${p.title}: ${p.purpose}\n   sections:\n${p.sections
      .map((s) => `     - ${s}`)
      .join("\n")}\n${designLines}`
  })
  .join("\n")}

SITE MANIFEST (keep every route coherent):
- Navigation (use the SAME nav on every route): ${navLines}
- Shared layout: ${m.sharedLayout}
- Metadata / SEO: every route's metadata MUST follow this direction: ${m.metadata}

SHARED COMPONENTS: ${plan.components.join(", ") || "site header + footer"}
BACKEND: ${(m.backendEndpoints.length ? m.backendEndpoints : plan.backend).join(", ") || "a contact/newsletter route handler"}

Implementation requirements:
- Home page path MUST be "${fw.entryFile}". Build every page and EVERY section above with
  real, specific copy — multiple paragraphs, lists, stats, testimonials, FAQs, CTAs. Every
  section must have a real heading + substantive body (no empty sections).
- Apply EACH page's own design (visual approach, mood, section layouts) on top of the site
  direction: cohesive color accents, strong typographic hierarchy, generous spacing, rounded
  cards, hover states, responsive grids. Make it look designed, not default.
- Build the UI from shadcn/ui primitives (@/components/ui/*): ${UI_LIST}. Icons: lucide-react.
  Never ship a raw, unstyled control.
- Reuse the shared header/nav + footer on every route, and give each route metadata that
  follows the manifest's metadata/SEO direction.
- Implement the backend pieces and wire forms to real endpoints.
- Add "use client" to interactive components. Write COMPLETE files (no placeholders/TODO).
- Write 2-4 files per write_files call across rounds. Keep going until every page + component exists.
- When everything is built, stop calling tools and reply with a short summary.`
}

/** Sent when the model failed to write any real files — forces it to build now. */
export function buildForceGenerateMessage(prompt: string, plan: SyraPlan, fw: ProjectFramework): string {
  const pages = plan.pages.length
    ? plan.pages.map((p) => `- ${p.path} (${p.title}): ${p.sections.slice(0, 6).join("; ")}`).join("\n")
    : `- ${fw.entryFile}: hero + features + testimonials + CTA + footer\n- app/about/page.tsx: story + team + values\n- app/contact/page.tsx: contact form wired to /api/contact`
  return `You have NOT created the website files yet. Stop explaining and CALL write_files NOW.

Build the pages below with COMPLETE, detailed content — every section, real copy, multiple
pages. No placeholder text, no "Built with Syra", no empty pages. Apply the design style:
${plan.design.style || "modern, polished, responsive"}.

USER REQUEST:
"""${prompt}"""

PAGES TO CREATE (home page MUST be "${fw.entryFile}"):
${pages}

Use write_files with 2-4 files per call. Build the UI from @/components/ui/* (shadcn).`
}

function asStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean)
  return []
}

/** De-duplicate a string array preserving first-seen order. */
function uniq(values: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of values) {
    if (v && !seen.has(v)) {
      seen.add(v)
      out.push(v)
    }
  }
  return out
}

/** Coerce a raw value into well-formed nav items (drops incomplete entries). */
function asNavItems(v: any): SyraNavItem[] {
  if (!Array.isArray(v)) return []
  return v
    .map((n) => {
      if (n && typeof n === "object") {
        return { label: String(n.label ?? "").trim(), route: String(n.route ?? "").trim() }
      }
      return { label: "", route: "" }
    })
    .filter((n) => n.label && n.route)
}

/**
 * Derive a complete per-page design from the site-level design direction. Used
 * whenever the model omits (or empties) a page's own `design`. Pure + total:
 * always returns non-empty `visualApproach`/`mood` and a non-empty
 * `sectionLayouts` array (Design Decision 2).
 */
export function defaultPageDesign(design: SyraPlanDesign): SyraPageDesign {
  const style = String(design?.style ?? "").trim()
  const colors = String(design?.colors ?? "").trim()
  const layout = String(design?.layout ?? "").trim()

  const visualApproach = style || "clean, modern, content-first visual approach"
  const mood = [style, colors].filter(Boolean).join(" — ") || "polished and confident"
  const sectionLayouts = [layout || "stacked, spacious sections with a clear visual hierarchy"]

  return { visualApproach, mood, sectionLayouts }
}

/**
 * Complete the site manifest field-by-field, retaining any supplied non-empty
 * content and deriving everything else from the plan (Design Decision 3):
 * - `routes`: supplied routes unioned with every page path (always a superset
 *   of the page routes; when nothing is supplied, equal to the page routes).
 * - `navigation`: supplied entries, else one `{label, route}` per page.
 * - `sharedLayout`: supplied text, else a sensible default shared layout.
 * - `backendEndpoints`: supplied list, else the plan's backend list.
 * - `metadata`: supplied text, else derived from the site-level design.
 * Pure + total: every field is always present and well-typed.
 */
export function deriveManifest(
  pages: SyraPlanPage[],
  components: string[],
  backend: string[],
  design: SyraPlanDesign,
  supplied?: Partial<SyraSiteManifest> | null,
): SyraSiteManifest {
  const suppliedRoutes = asStringArray(supplied?.routes)
  const suppliedNav = asNavItems(supplied?.navigation)
  const suppliedSharedLayout = String(supplied?.sharedLayout ?? "").trim()
  const suppliedBackend = asStringArray(supplied?.backendEndpoints)
  const suppliedMetadata = String(supplied?.metadata ?? "").trim()

  const pagePaths = pages.map((p) => p.path).filter(Boolean)

  // Always a superset of the page routes; when no routes are supplied this is
  // exactly the page routes (Property 4).
  const routes = uniq([...suppliedRoutes, ...pagePaths])

  const navigation = suppliedNav.length
    ? suppliedNav
    : pages.filter((p) => p.path).map((p) => ({ label: p.title || "Page", route: p.path }))

  const sharedLayout =
    suppliedSharedLayout ||
    "Shared site header/nav + footer applied to every route via the root layout"

  const backendEndpoints = suppliedBackend.length ? suppliedBackend : backend

  const metadata =
    suppliedMetadata ||
    [design?.style, design?.colors]
      .map((s) => String(s ?? "").trim())
      .filter(Boolean)
      .join("; ") ||
    "Descriptive, unique per-route titles + meta descriptions following the site design"

  return { routes, navigation, sharedLayout, backendEndpoints, metadata }
}

/** Defensive JSON extraction for the detailed plan response. */
export function parsePlan(text: string): SyraPlan {
  let raw = (text || "").trim()
  // Strip markdown fences if the model added them.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  // Grab the outermost JSON object.
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

    const pages: SyraPlanPage[] = Array.isArray(obj.pages)
      ? obj.pages
          .map((p: any) => {
            // Use the model's per-page design only when fully present + non-empty;
            // otherwise derive it from the site-level design (R2.4, R2.5).
            const coerced: SyraPageDesign = {
              visualApproach: String(p?.design?.visualApproach || "").trim(),
              mood: String(p?.design?.mood || "").trim(),
              sectionLayouts: asStringArray(p?.design?.sectionLayouts),
            }
            const pageDesign: SyraPageDesign =
              coerced.visualApproach && coerced.mood && coerced.sectionLayouts.length
                ? coerced
                : defaultPageDesign(design)
            return {
              path: String(p?.path || "").trim(),
              title: String(p?.title || "").trim() || "Page",
              purpose: String(p?.purpose || "").trim(),
              sections: asStringArray(p?.sections),
              design: pageDesign,
            }
          })
          .filter((p: SyraPlanPage) => p.path)
      : []

    const components = asStringArray(obj.components)
    const backend = asStringArray(obj.backend)

    // Complete the site manifest: retain any model-supplied content, derive the rest.
    const manifest = deriveManifest(pages, components, backend, design, obj?.manifest)

    // Derive the flat file list from explicit files or from pages/components/backend.
    const explicitFiles = Array.isArray(obj.files)
      ? obj.files
          .map((f: any) => ({ path: String(f?.path || "").trim(), purpose: String(f?.purpose || "").trim() }))
          .filter((f: any) => f.path)
      : []
    const derivedFiles = [
      ...pages.map((p) => ({ path: p.path, purpose: `${p.title} page` })),
      ...components.map((c) => ({ path: c, purpose: "shared component" })),
      ...backend.map((b) => ({ path: b.split(/\s/)[0].trim(), purpose: "backend" })),
    ].filter((f) => f.path && /[/.]/.test(f.path))
    const files = explicitFiles.length ? explicitFiles : derivedFiles

    const steps = asStringArray(obj.steps)
    return {
      summary: String(obj.summary || "Build the requested website").trim(),
      design,
      steps: steps.length ? steps : ["Design the pages", "Build shared layout", "Generate each page", "Wire backend"],
      pages,
      components,
      backend,
      manifest,
      files,
    }
  } catch {
    // No parseable JSON: return a schema-valid plan whose manifest still has the
    // canonical home route as its single entry point (R3.7, Design Decision 1).
    const home = "app/page.tsx"
    return {
      summary: "Build the requested website",
      design: fallbackDesign,
      steps: ["Inspect the project", "Generate the requested files", "Validate output"],
      pages: [],
      components: [],
      backend: [],
      manifest: {
        routes: [home],
        navigation: [{ label: "Home", route: home }],
        sharedLayout: "Shared site header/nav + footer applied to every route via the root layout",
        backendEndpoints: [],
        metadata: "Descriptive, unique per-route titles + meta descriptions following the site design",
      },
      files: [],
    }
  }
}
