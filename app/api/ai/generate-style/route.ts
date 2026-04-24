import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { logAiDebug } from "@/lib/logger"
import { callModel, extractJson, type ModelSelection } from "@/lib/ai-provider"
import { IMPORT_MAP } from "@/sample-conveter"
import {
  renderManifestForPrompt,
  type ProjectManifest,
  type ManifestPage,
} from "@/lib/project-manifest"
import fs from "fs"
import path from "path"

// Stage 2 of the pipeline: "Raw JSON for style".
//
// For a single page from the plan, ask the selected model to produce a UI
// tree JSON that strictly follows:
//   - the shadcn/ui component catalogue in cheat_sheat.json
//   - the generator contract documented in generation.md
//
// The output is fed unchanged to the deterministic converter
// (sample-conveter.ts). Dynamic props reference $state.* and $handler.* — the
// logic stage fills in those handler bodies.

function readHelperFile(fileName: string): string {
  try {
    return fs.readFileSync(path.join(process.cwd(), fileName), "utf-8")
  } catch {
    return ""
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    page?: { path?: string; title?: string; description?: string; features?: string[] }
    prompt?: string
    model?: ModelSelection
    sitemap?: Array<{ path: string; title: string; description?: string }>
    manifest?: ProjectManifest
  }
  const { page, prompt, model, sitemap, manifest } = body

  if (!page?.title || !page?.path) {
    return NextResponse.json({ message: "page { path, title } is required" }, { status: 400 })
  }
  if (!model?.id || !model?.provider) {
    return NextResponse.json({ message: "Model selection is required" }, { status: 400 })
  }

  // Resolve this page's manifest entry (component name, logic module, title).
  // Fall back to an empty entry when the caller didn't send a manifest (older
  // clients) — the prompt still runs, just without the full cross-page view.
  const manifestPage: ManifestPage | undefined = manifest?.pages.find(
    (p) => p.route === page.path,
  )

  await logAiDebug("Style Request", {
    page,
    modelId: model.id,
    provider: model.provider,
  })

  const prompts = await getSystemPrompts()
  const generationGuide = readHelperFile("generation.md")
  const cheatSheet = readHelperFile("cheat_sheat.json")

  // Build the component catalogue from IMPORT_MAP so the prompt always
  // reflects what we actually ship. Group exports by file for readability.
  const byFile = new Map<string, string[]>()
  for (const [name, importPath] of Object.entries(IMPORT_MAP)) {
    const group = byFile.get(importPath) ?? []
    group.push(name)
    byFile.set(importPath, group)
  }
  const catalogueLines = Array.from(byFile.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, names]) => {
      const componentName = file.replace("@/components/ui/", "")
      return `- ${componentName}: ${names.sort().join(", ")}`
    })
    .join("\n")

  const messages = [
    {
      role: "system" as const,
      content: `You are the "Style JSON" stage of a deterministic Vite + React + TypeScript build pipeline.

Your only job is to emit a single JSON UI tree describing the visual layout of ONE page. A deterministic converter will turn this JSON into .tsx — so follow the contract exactly.

STRICT CONTRACT (from generation.md):
${generationGuide || "No generation.md available"}

COMPLETE SHADCN/UI COMPONENT SET (${Object.keys(IMPORT_MAP).length} components from ${byFile.size} files — the generated Vite project vendors ALL of them, so you may freely use any of these names. Do NOT invent component names outside this list; unknown names silently demote to <div>):
${catalogueLines}

THEME (locked):
- The generated site uses ONLY two backgrounds: pure white (#ffffff in light mode) or #101010 (in dark mode). The scaffold defaults to dark mode.
- Use ONLY shadcn tokens: bg-background, text-foreground, bg-card, bg-primary, text-primary-foreground, bg-muted, text-muted-foreground, border-border, bg-secondary, text-secondary-foreground, bg-accent, text-accent-foreground, bg-destructive, text-destructive-foreground.
- NEVER use bg-blue-*, bg-slate-*, text-gray-*, bg-gradient-*, or any other hard-coded Tailwind color utility. Layout/spacing/typography utilities (p-*, m-*, flex, grid, gap-*, w-*, h-*, max-w-*, rounded-*, shadow-*, text-xl, font-bold, leading-*, tracking-*) are fine.
- NEVER embed inline CSS (no style={{ color: "..."}}, no arbitrary-value classes like [color:#abc] or bg-[#abc]).

ICONS (HeroIcons ONLY):
- Every icon MUST be a HeroIcon component (PascalCase name ending in "Icon", e.g. HomeIcon, UserIcon, ChevronRightIcon, CheckCircleIcon, ArrowRightIcon, MagnifyingGlassIcon, XMarkIcon, Bars3Icon). The converter auto-imports them from '@heroicons/react/24/outline'.
- Icon nodes must have a className for sizing/color, e.g. {"name":"HomeIcon","props":{"className":"h-5 w-5"}}.
- STRICTLY FORBIDDEN: emoji characters (🚀, ✨, ✅, 📱, 💡, etc.), unicode pictographs, ASCII art, or image URLs as icons. Any emoji in a text node is a bug — use a HeroIcon sibling instead.
- See https://heroicons.com for the full list of available icon names; they all follow the \`<Name>Icon\` suffix convention.

COMPONENT-ONLY RULE:
- Every visible text string MUST live inside a shadcn component that renders typography (CardTitle, CardDescription, Label, Badge, Button, AlertTitle, AlertDescription, PaginationLink, etc.) OR inside semantic HTML headings/paragraphs (h1–h6, p). No bare strings inside <div>/<span> — wrap them.
- Raw HTML is limited to LAYOUT ONLY: div, section, main, header, footer, nav, aside, ul, ol, li, form, h1..h6, p, a, img, label. Anything interactive (buttons, toggles, inputs, selects, dialogs) MUST come from the shadcn set above.

RESPONSIVE LAYOUT (mobile-first, required):
- Every page must look correct on phone (<= 640px), tablet (641–1024px) AND desktop (>= 1025px). Use Tailwind responsive prefixes (sm:, md:, lg:, xl:) on grid/flex/width/padding utilities. Default state targets mobile.
- NEVER use fixed pixel widths (w-[1200px], w-96 everywhere). Prefer container mx-auto + max-w-* + px-4 sm:px-6 lg:px-8.
- Grids must collapse on mobile: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" is correct; "grid grid-cols-3" alone breaks on phones.
- Navigation that has many items must use Sheet or DropdownMenu on mobile (toggle icon <= md breakpoint) and inline NavigationMenu on desktop.

PAGE-SCOPE RULE (critical):
- This Style call produces ONE single route's content. The page body must stand alone — do NOT render a site-wide header/footer/nav inside it (the scaffold already adds <SiteNav /> above every route).
- Do NOT wrap the page in <Tabs> to switch between the OTHER planned routes. Tabs are only acceptable for in-page sub-sections of THIS specific route (e.g. "Mission / Team" on the About page). Switching between the site's top-level routes must happen via the shared SiteNav + full-page navigation.

NAVIGATION (in-page links to other routes):
- For CTAs / in-body links to another planned route, use <a href="/other-path">…</a>. The converter auto-rewrites these to <Link to="/other-path"> from react-router-dom, so they are intercepted and do NOT full-reload the page.

CROSS-FILE CONTRACT (read the manifest below BEFORE emitting JSON):
${manifest ? renderManifestForPrompt(manifest) : "(no manifest supplied — fall back to the single-page brief)"}

STRICT MULTI-PAGE RULES (enforced by the downstream converter):
1. Every page MUST have a heading element (h1 or CardTitle) whose text matches its pageTitle from the manifest. The runtime also sets document.title to this value automatically — your job is to surface it visually.
2. Every <Button> / <a> / interactive element that performs an ACTION (submit, toggle, call API, navigate, dismiss) MUST wire its handler via "$handler.<name>". Every such handler name MUST be implementable as a real function — never leave an empty arrow or a placeholder.
3. Links between sibling routes MUST use <a href="/other-route">…</a> (the converter rewrites them to <Link to="/other-route">). Never emit full URLs for in-app navigation. Use the routes from the manifest above verbatim.
4. Dynamic / user-facing data that would come from a data fetch MUST be bound to "$state.<name>" (the logic stage will provide the initial value and any loader). Do not hardcode user-specific data as JSX text — static marketing copy is fine, but things like "user profile", "order list", "post titles" belong in state.
5. Never re-render sibling pages inside this page. Do not put the sitemap/nav into the page body (the scaffold already renders <SiteNav />). Use <Tabs> only for in-page sub-sections of THIS route, never to switch between the site's top-level routes.

Full shadcn reference (prop shapes & examples):
${cheatSheet || prompts.builderCheatSheet}

OUTPUT FORMAT:
Return ONLY a raw JSON object (no markdown, no prose, no code fence). The root shape is:
{
  "type": "ui-tree",
  "version": "1.0",
  "component": { "name": "...", "props": { ... }, "children": [ ... ] }
}

RULES:
- Dynamic values use "$state.<name>" / "$handler.<name>" strings. Never invent JSX or raw code inside the JSON.
- Do NOT use "$handler.set<X>" for state setters named after a "$state.<x>" — the converter wires those up automatically via useState. Use $handler.* only for real actions (onSubmit, onClickToggle, loadData, logout, etc.).
- Keep the tree rich enough to look complete: multiple sections, use Cards / Tabs / Accordion / Badges to structure content.
- No comments inside the JSON.`,
    },
    {
      role: "user" as const,
      content: `Overall website brief: ${prompt ?? "(no extra context)"}

${manifest
        ? `Refer to the PROJECT MANIFEST above for the full app structure. You are generating ONLY the page marked below.`
        : sitemap && sitemap.length > 0
          ? `Full sitemap (other pages the user can reach via the shared SiteNav — use their paths for CTAs with <a href="/...">, but do NOT re-render their content here):\n${sitemap.map((s) => `  - ${s.path} — ${s.title}${s.description ? `: ${s.description}` : ""}`).join("\n")}\n`
          : ""
      }

Generate the UI tree JSON for ONLY this page:
- path: ${page.path}
- title: ${page.title}
${manifestPage ? `- componentName (must match the manifest): ${manifestPage.componentName}\n- pageTitle (show as heading AND used for document.title): ${manifestPage.pageTitle}\n- logicModule (handlers you reference will live here): ${manifestPage.logicModule}` : ""}
- description: ${page.description ?? "(no description)"}
${page.features && page.features.length > 0 ? `- features:\n${page.features.map((f) => `    • ${f}`).join("\n")}` : ""}

Make sure every feature above is represented in the tree (the UI must actually expose the relevant form / button / list / handler). Use HeroIcons for all iconography. Use responsive Tailwind (sm:/md:/lg:) on every grid/flex/width utility. Return only the JSON object described in the contract.`,
    },
  ]

  const result = await callModel({
    model,
    messages,
    temperature: 0.1,
  })

  if (!result.ok) {
    await logAiDebug("Style API Error", {
      status: result.status,
      message: result.message,
      details: result.details,
    })
    return NextResponse.json(
      { message: result.message, details: result.details },
      { status: result.status },
    )
  }

  const parsed = extractJson<unknown>(result.content)
  if (!parsed || typeof parsed !== "object") {
    await logAiDebug("Style Parse Error", { content: result.content })
    return NextResponse.json(
      { message: "AI failed to produce a valid style JSON tree." },
      { status: 422 },
    )
  }

  // The converter requires either the {type,component} envelope or at least a
  // bare node. Normalize both shapes to the envelope here.
  const envelope = parsed as Record<string, unknown>
  const tree =
    typeof envelope.component === "object" && envelope.component
      ? envelope
      : { type: "ui-tree", version: "1.0", component: parsed }

  await logAiDebug("Style Parse Success", { path: page.path })
  return NextResponse.json({ tree })
}
