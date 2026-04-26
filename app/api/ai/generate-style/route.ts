import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { logAiDebug } from "@/lib/logger"
import { callModel, extractJson, type ModelSelection } from "@/lib/ai-provider"
import { IMPORT_MAP } from "@/sample-conveter"
import {
  renderManifestForPrompt,
  countTreeNodes,
  buildFallbackTree,
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
  // reflects what we actually ship. Group exports by file so the AI sees
  // each shadcn component file as one bullet (e.g. card.tsx → Card,
  // CardHeader, CardTitle, …).
  const byFile = new Map<string, string[]>()
  for (const [name, importPath] of Object.entries(IMPORT_MAP)) {
    const group = byFile.get(importPath) ?? []
    group.push(name)
    byFile.set(importPath, group)
  }
  const shadcnCatalogue = Array.from(byFile.entries())
    .filter(([file]) => file.startsWith("@/components/ui/"))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([file, names]) => `- ${file.replace("@/components/ui/", "")}: ${names.sort().join(", ")}`)
    .join("\n")
  const shadcnFileCount = Array.from(byFile.keys()).filter((f) =>
    f.startsWith("@/components/ui/"),
  ).length

  const messages = [
    {
      role: "system" as const,
      content: `You are the "Style JSON" stage of a deterministic Vite + React + TypeScript build pipeline.

Your only job is to emit a single JSON UI tree describing the visual layout of ONE page. A deterministic converter will turn this JSON into .tsx — so follow the contract exactly.

STRICT CONTRACT (from generation.md):
${generationGuide || "No generation.md available"}

SHADCN PROJECT INFO (mirrors \`shadcn info --json\` for the generated project — use it to ground every decision; this is the same context the official shadcn/ui Skill provides at https://ui.shadcn.com/docs/skills):
  framework:       vite
  tailwindVersion: v3
  baseLibrary:     radix
  iconLibrary:     heroicons-outline-24
  aliases:         { components: "@/components", ui: "@/components/ui", lib: "@/lib", hooks: "@/hooks", utils: "@/lib/utils" }
  installedComponents: ${shadcnFileCount} files vendored under @/components/ui/

COMPONENT CATALOGUE — shadcn/ui (${Object.keys(IMPORT_MAP).length} exports from ${shadcnFileCount} component files; the generated Vite project vendors ALL of them). You MAY freely use any of these names. Do NOT invent component names outside this list; unknown names silently demote to <div>.
${shadcnCatalogue}

SHADCN COMPOSITION RULES (these are the patterns the official shadcn/ui Skill enforces — follow them exactly, NOT just "stack Card after Card"):
- FORMS — never raw <input>. Wrap every field in Field + FieldLabel + FieldDescription + FieldError, and group related fields with FieldGroup or FieldSet. For prefixed/suffixed inputs (e.g. URL with https://, search with magnifying glass) use InputGroup + InputGroupAddon + InputGroupInput, never a manual flex container around a bare Input. Use Form + FormField for any form that submits.
- OPTION SETS — for "pick one of N" use ToggleGroup with type="single", or RadioGroup. Multiple-select uses ToggleGroup type="multiple" or Checkbox stack. Never simulate a toggle group with multiple Buttons.
- BUTTONS — group adjacent action buttons with ButtonGroup (e.g. "Save / Cancel", "Edit / Delete / Share"). Never wrap them in a bare <div className="flex gap-2">.
- LISTS — for any list of records (users, files, history, settings rows) use Item + ItemMedia + ItemContent + ItemActions inside an ItemGroup. Never stack Card after Card to fake a list.
- EMPTY STATES — when a section has nothing to show, render an Empty (with EmptyHeader / EmptyTitle / EmptyDescription / EmptyContent + EmptyMedia). Never just a paragraph saying "No data".
- KEYBOARD HINTS — keyboard shortcuts MUST use Kbd / KbdGroup, never <code> or styled spans.
- LOADING — busy/in-flight states use Spinner (inline) or Skeleton (block placeholders). Never the literal string "Loading..." in a Button.
- DATA TABLES — for tabular data use Table + TableHeader + TableBody + TableRow + TableHead + TableCell. Never an HTML <table> directly.
- CHARTS — for any data visualization use ChartContainer + ChartTooltip + ChartLegend + recharts primitives. Never a placeholder image.
- DISCLOSURE — FAQ → Accordion + AccordionItem (8+ items if it is the page's main content). Pricing comparisons → Tabs (monthly/yearly) + Table. Settings panes → Tabs.
- NAVIGATION — sibling-route CTAs use <a href="/route"> (the converter rewrites to <Link>). In-page section nav uses NavigationMenu or Tabs, never a custom anchor list.
- SEMANTIC TOKENS ONLY — bg-primary / text-primary-foreground / bg-secondary / bg-accent / bg-muted / bg-card / bg-destructive. Never bg-blue-500, never bg-[#xxx], never bg-gradient-to-*. The generated site has a per-site primary hue (see manifest theme below) that lives in CSS vars; using semantic tokens is what makes the site visually distinct.

A page MUST USE AT LEAST 5 DIFFERENT shadcn components from this catalogue — and at least 1 component from each of FORMS, LISTS-OR-DATA-DISPLAY, and DISCLOSURE-OR-FEEDBACK families when the page's purpose includes those. A 5-Card-grid is a bug.

LAYOUT VARIETY (CRITICAL — this fixes "every page looks the same"):
The manifest below assigns each page a layoutHint. You MUST honour it. The hint maps to a concrete page structure:
  - split-hero        → Two-column hero (text+CTA on left, illustration/feature card on right) → then a 3-card features row → then a CTA strip.
  - full-bleed-hero   → Full-width hero with large heading + subhead + 2 CTAs → then a 3- or 4-column features grid → then social proof (Avatar row) → then a CTA Card.
  - masonry-grid      → Compact hero → asymmetric grid of media tiles using AspectRatio + Card (mix of col-span-1 and col-span-2 on lg).
  - sidebar-content   → Compact hero → two-column body with a sticky left Sidebar (or aside w/ sticky) listing sections → main column with multiple sections.
  - table-dashboard   → Compact heading row with stats Cards (4 of them) → Tabs to switch views → Table inside the active tab → a side Card with summary.
  - two-column-article→ Hero → long-form article body in a max-w-3xl prose column on the left + sticky aside Card on the right (TOC / CTA).
  - faq-stack         → Hero → Accordion with at least 8 questions → supporting Cards (Contact, Docs).
  - pricing-table     → Hero → 3-column pricing Cards (with Badge "Most popular" on the middle) → a feature comparison Table below.
  - contact-split     → Hero heading → two-column body: Form on the left (Form/FormField/Input/Textarea/Button), contact channels Card + map placeholder + hours Table on the right.
  - testimonial-wall  → Hero → 3x3 grid of testimonial Cards (with Avatar) → social proof bar with logos.
  - feature-spotlight → Hero → three alternating left/right feature blocks (image/illustration card on one side, text+bullets on the other), alternating per row.
  - media-gallery     → Hero → Carousel (3 slides) → Bento-style grid of AspectRatio media tiles below.
NEVER reuse the same skeleton across pages. If you generated a 3-card features row on Home, the About / Pricing / Contact / FAQ pages MUST NOT also be a 3-card features row.

CONTENT DENSITY (every page must be substantive):
- A page MUST emit AT LEAST 4 distinct content sections (hero counts as 1).
- Every feature listed in the manifest for THIS page MUST appear as a real, named element in the tree (Card, Accordion item, Table row, FormField, etc.) — not just mentioned in a paragraph.
- A page MUST NOT consist of only a hero + one CTA. Empty / under-filled pages are a bug.
- Use real, brief-specific copy in headings and descriptions. Generic filler ("Lorem ipsum", "Add your content here") is forbidden.

THEME (per-site, NOT locked):
- The background stays neutral (white in light, #101010 in dark) but the PRIMARY ACCENT, RING, and BORDER-RADIUS are UNIQUE PER SITE — see manifest.theme below. The scaffold writes those into CSS vars on \`:root\`.
- Use ONLY shadcn semantic tokens: bg-background, text-foreground, bg-card, bg-primary, text-primary-foreground, bg-muted, text-muted-foreground, border-border, bg-secondary, text-secondary-foreground, bg-accent, text-accent-foreground, bg-destructive, text-destructive-foreground, ring-ring.
- Reach for the accent colour via bg-primary / text-primary / ring-ring / border-primary — these resolve to the per-site primary colour automatically.
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
${manifestPage ? `- componentName (must match the manifest): ${manifestPage.componentName}\n- pageTitle (show as heading AND used for document.title): ${manifestPage.pageTitle}\n- logicModule (handlers you reference will live here): ${manifestPage.logicModule}\n- layoutHint (you MUST follow this layout structure; see LAYOUT VARIETY in the system prompt): ${manifestPage.layoutHint ?? "full-bleed-hero"}` : ""}
- description: ${page.description ?? "(no description)"}
${page.features && page.features.length > 0 ? `- features:\n${page.features.map((f) => `    • ${f}`).join("\n")}` : ""}

Every feature above MUST be represented in the tree as a real, named element (Card, Accordion item, Table row, FormField, list item) — not just mentioned in a paragraph. Use HeroIcons for all iconography. Use responsive Tailwind (sm:/md:/lg:) on every grid/flex/width utility. Follow the page's layoutHint exactly — do NOT default to a generic hero+grid skeleton. Return only the JSON object described in the contract.`,
    },
  ]

  // Style temperature is intentionally higher than the architect / logic
  // calls so different briefs (and even retries on the same brief) produce
  // structurally varied trees instead of collapsing to one canonical layout.
  //
  // We attempt up to 2 calls. The AI sometimes returns an effectively empty
  // tree (e.g. `{}` or `{component:{}}`) which previously rendered as a
  // blank page in the deployed site. We detect that, retry once with a
  // sterner instruction, and fall back to a deterministic page built from
  // the manifest if the retry is also empty — so a page is NEVER blank.
  const MIN_TREE_NODES = 8
  const buildTree = async (
    attempt: number,
  ): Promise<{ ok: true; tree: Record<string, unknown>; nodeCount: number } | { ok: false; status: number; message: string; details?: unknown; raw?: string }> => {
    const callMessages = attempt === 1
      ? messages
      : [
          ...messages,
          {
            role: "system" as const,
            content: `Your previous response produced an EMPTY tree (the rendered page was blank). This is a critical bug. You MUST emit at least ${MIN_TREE_NODES} named elements covering hero + multiple sections + CTA. Do NOT return {} or a tree whose root has no children. Honour the layoutHint and surface every feature from the manifest as a real element.`,
          },
        ]
    const r = await callModel({ model, messages: callMessages, temperature: 0.7 })
    if (!r.ok) {
      return { ok: false, status: r.status, message: r.message, details: r.details }
    }
    const parsed = extractJson<unknown>(r.content)
    if (!parsed || typeof parsed !== "object") {
      return { ok: false, status: 422, message: "Parse failed", raw: r.content }
    }
    const envelope = parsed as Record<string, unknown>
    const tree =
      typeof envelope.component === "object" && envelope.component
        ? envelope
        : { type: "ui-tree", version: "1.0", component: parsed }
    const nodeCount = countTreeNodes((tree as { component?: unknown }).component)
    if (nodeCount < MIN_TREE_NODES) {
      return { ok: false, status: 422, message: `Tree too small (${nodeCount} nodes, need ${MIN_TREE_NODES})`, raw: r.content }
    }
    return { ok: true, tree, nodeCount }
  }

  const attempt1 = await buildTree(1)
  if (attempt1.ok) {
    await logAiDebug("Style Parse Success", { path: page.path, nodeCount: attempt1.nodeCount, attempt: 1 })
    return NextResponse.json({ tree: attempt1.tree })
  }

  // attempt1 failed — log and retry
  await logAiDebug("Style Attempt 1 Empty/Invalid", {
    path: page.path,
    status: attempt1.status,
    message: attempt1.message,
    rawPreview: typeof attempt1.raw === "string" ? attempt1.raw.slice(0, 500) : undefined,
  })

  // Only retry on the "empty / invalid" cases (422). Network errors (5xx, 4xx
  // auth) bubble up immediately because retrying won't help.
  if (attempt1.status !== 422) {
    return NextResponse.json(
      { message: attempt1.message, details: attempt1.details },
      { status: attempt1.status },
    )
  }

  const attempt2 = await buildTree(2)
  if (attempt2.ok) {
    await logAiDebug("Style Parse Success", { path: page.path, nodeCount: attempt2.nodeCount, attempt: 2 })
    return NextResponse.json({ tree: attempt2.tree })
  }

  // Both attempts failed — emit the deterministic fallback so the page is
  // never blank in the deployed site. Logged loudly so we can investigate
  // why the AI keeps returning empty trees on this prompt.
  await logAiDebug("Style Fallback Triggered", {
    path: page.path,
    attempt1Message: attempt1.message,
    attempt2Message: attempt2.message,
    rawPreview: typeof attempt2.raw === "string" ? attempt2.raw.slice(0, 500) : undefined,
  })
  if (manifestPage) {
    const fallback = buildFallbackTree(manifestPage)
    return NextResponse.json({ tree: fallback, fallback: true })
  }
  // No manifest entry — shouldn't happen, but if it does, build one on the
  // fly so we still return a non-blank page.
  const adhocPage: ManifestPage = {
    componentName: page.title.replace(/[^A-Za-z0-9]/g, "") || "Page",
    route: page.path,
    slug: page.path === "/" ? "index" : page.path.replace(/^\//, "").replace(/[^a-z0-9-]/gi, "-").toLowerCase(),
    pageFile: "",
    logicFile: "",
    logicModule: "",
    pageTitle: page.title,
    description: page.description,
    features: page.features,
  }
  return NextResponse.json({ tree: buildFallbackTree(adhocPage), fallback: true })
}
