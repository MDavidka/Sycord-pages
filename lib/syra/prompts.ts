// System + planning prompts for the Syra agent.

import type { ProjectFramework, SyraPlan, SyraPlanDesign, SyraPlanPage } from "./types"
import { SHADCN_COMPONENTS } from "./shadcn"

const UI_LIST = SHADCN_COMPONENTS.join(", ")

export const SYRA_SYSTEM = `You are Syra, an elite AI website engineer. You design and build complete, real,
multi-page Next.js applications with genuine backend functionality. You have full
creative freedom over visual style and features — be ambitious and produce polished,
modern, production-grade results.

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

DESIGN SYSTEM — shadcn/ui (https://ui.shadcn.com)
- Every UI is built with shadcn/ui. These primitives are pre-installed at
  "@/components/ui/<name>": ${UI_LIST}.
- Import them, e.g. import { Button } from "@/components/ui/button"; import { Card,
  CardHeader, CardTitle, CardContent } from "@/components/ui/card".
- Use the cn helper from "@/lib/utils" to compose classes.
- Style with Tailwind CSS using the theme tokens (bg-background, text-foreground,
  text-muted-foreground, bg-primary, border, bg-card, etc.) so light/dark themes work.
- Icons come from lucide-react. Compose rich sections (hero, features, pricing,
  testimonials, FAQ via Accordion, CTA, footer) from these primitives.
- Do NOT recreate the shadcn primitives — they already exist. Build new higher-level
  components on top of them under components/.

MULTI-PAGE SITES
- Build several real routes, not just a home page. Typical App Router layout:
  app/page.tsx (home), app/about/page.tsx, app/<feature>/page.tsx, app/pricing/page.tsx,
  app/contact/page.tsx, app/blog/page.tsx + app/blog/[slug]/page.tsx, etc. — choose what
  fits the request.
- Add a shared site header/nav and footer component and use them across pages
  (e.g. via the root layout or a shared layout component).

CONTENT QUALITY (critical)
- Every page must be CONTENT-RICH and specific to the user's request: real headlines,
  multiple paragraphs of copy, feature lists, FAQs, testimonials, stats, CTAs, etc.
- Compose several distinct sections per page (hero, features, how-it-works, pricing,
  testimonials, FAQ, CTA, footer) — not a single line of text.
- NEVER ship placeholder text such as "Built with Syra", "Hello World", lorem ipsum,
  empty pages, or "coming soon". Write the actual website the user asked for.

REAL BACKEND FUNCTIONALITY
- Implement working server logic, not mockups. Use App Router Route Handlers
  (app/api/<name>/route.ts exporting GET/POST) and/or Server Actions ("use server").
- Wire forms (e.g. contact, newsletter, waitlist) to real endpoints, validate input
  (zod + react-hook-form are fine), and return real JSON responses.
- For data, you may use an in-memory/module-level store or static seed data so the
  app runs without external services. Keep it functional end-to-end.
- Add "use client" to any component using state, effects, event handlers or hooks.

CONSTRAINTS
- Do not write secrets or .env files.
- Config files (package.json, next.config, tsconfig, tailwind.config, postcss.config,
  globals.css, the shadcn primitives, public assets and a favicon) are added and kept in
  sync automatically by Syra — focus on application code and just import what you need
  (dependencies are added to package.json for you).

When you are completely finished, stop calling tools and reply with a short plain-text
summary of what you built and the key files/routes you created.`

export function buildPlanPrompt(prompt: string, fw: ProjectFramework): string {
  return `You are the lead designer + architect. Produce a DETAILED design plan for a complete,
multi-page website for this request. Think hard about how each page should LOOK, what
SECTIONS it contains, and what real CONTENT goes in them.

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

Return ONLY this JSON object (no markdown fences):
{
  "summary": "one sentence describing the site",
  "design": {
    "style": "overall visual style + mood (e.g. 'sleek dark SaaS, glassy cards, bold')",
    "colors": "palette direction using theme tokens / accents (e.g. 'indigo primary on slate, subtle gradients')",
    "typography": "heading + body type vibe and scale",
    "layout": "navigation + spacing + grid approach used across pages"
  },
  "steps": ["short actionable build step", "..."],
  "pages": [
    {
      "path": "${fw.entryFile}",
      "title": "Home",
      "purpose": "what this page is for",
      "sections": ["<Specific highly-tailored section based on prompt>", "<Another unique layout section>"]
    }
  ],
  "components": ["components/site-header.tsx", "components/site-footer.tsx", "..."],
  "backend": ["app/api/contact/route.ts — handle contact form POST", "..."]
}

Rules:
- Home page MUST be "${fw.entryFile}". Use correct router paths for the other routes.
- Plan 3-6 PAGES (home + e.g. about, features/services, pricing, contact, blog, etc. as fits).
- Each page MUST list highly specific SECTIONS describing layout + the actual content to include.
- Always include a shared header/nav + footer in "components", and at least one real backend piece.
- Act as a free-form playground. Think as much as you need to to accomplish the user's goal.
- Be specific to the user's request (real domain content, not generic filler).`
}

export function buildGeneratePrompt(prompt: string, plan: SyraPlan, fw: ProjectFramework): string {
  return `Now BUILD the site exactly per this design plan. Use write_files to emit complete files.
You are in a free-form playground. Think as much as you need to to solve problems, generate files, and build features. IMPORTANT: Strictly use the provided file map to verify your imports. Do not hallucinate components.

USER REQUEST:
"""${prompt}"""

DESIGN DIRECTION:
- Style: ${plan.design.style}
- Colors: ${plan.design.colors}
- Typography: ${plan.design.typography}
- Layout: ${plan.design.layout}

PAGES TO BUILD (implement EVERY section listed for each page):
${plan.pages
  .map((p) => `• ${p.path} — ${p.title}: ${p.purpose}\n   sections:\n${p.sections.map((s) => `     - ${s}`).join("\n")}`)
  .join("\n")}

SHARED COMPONENTS: ${plan.components.join(", ") || "site header + footer"}
BACKEND: ${plan.backend.join(", ") || "a contact/newsletter route handler"}

Implementation requirements:
- Home page path MUST be "${fw.entryFile}". Build every page and EVERY section above with
  real, specific copy — multiple paragraphs, lists, stats, testimonials, FAQs, CTAs.
- Apply the design direction consistently: cohesive color accents, strong typographic
  hierarchy, generous spacing, rounded cards, hover states, responsive grids, and tasteful
  gradients/borders. Make it look designed, not default.
- Build the UI from shadcn/ui primitives (@/components/ui/*): ${UI_LIST}. Icons: lucide-react.
- Reuse the shared header/nav + footer on every page. Implement the backend pieces and wire forms.
- Add "use client" to interactive components. Write COMPLETE files (no placeholders/TODO).
- Generate files step-by-step. Keep going until every page + component exists.
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

Use write_files. Build the UI from @/components/ui/* (shadcn).`
}

function asStringArray(v: any): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean)
  return []
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
          .map((p: any) => ({
            path: String(p?.path || "").trim(),
            title: String(p?.title || "").trim() || "Page",
            purpose: String(p?.purpose || "").trim(),
            sections: asStringArray(p?.sections),
          }))
          .filter((p: SyraPlanPage) => p.path)
      : []

    const components = asStringArray(obj.components)
    const backend = asStringArray(obj.backend)

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
