// AI page-body JSON generator. For each page in the manifest, the
// builder asks the model to return a JSON UI tree that obeys the
// allowed shadcn component subset. The model never emits TSX —
// only JSON — and the converter step turns that JSON into Next.js
// page files.

import { callModel } from "@/lib/ai-provider"

import type {
  ComponentsCheatsheet,
} from "./components-context"
import { summarizeComponentsForPrompt } from "./components-context"
import type { ManifestPage, PageUITree, SiteManifest, SitePlan } from "./types"

export const PAGE_JSON_SYSTEM_PROMPT = `You are the page JSON generator of a v0-style AI website builder.

Generate ONLY a JSON UI tree for the current page body.

Strict rules:
- Output JSON only. No TSX. No markdown. No imports. No comments.
- Do NOT render a global header, nav, or footer — the scaffold already does that.
- Mobile-first Tailwind classes only (base classes for mobile, then sm:/md:/lg:).
- Use ONLY components from the "Allowed components" list below. Do not invent components.
- Wrap meaningful sections with motion wrappers like FadeIn or Stagger when useful.
- Include every planned section AND every planned feature. At least 4 meaningful sections.
- Use $handler.<name> as the value for event-handler props (e.g. onClick: "$handler.addToCart").
- Use $state.<name> as the value for dynamic state values (e.g. value: "$state.email").
- Real, specific copy. No lorem ipsum, no placeholder filler.
- Use semantic Tailwind tokens (bg-background, text-foreground, bg-card, text-muted-foreground, border-border, bg-primary, text-primary-foreground).

Output schema:
{
  "type": "ui-tree",
  "version": "1.0",
  "component": {
    "name": "main",
    "props": { "className": "..." },
    "children": [ ... ]
  }
}

Each node is either a string literal (text content) or an object with this shape:
{ "name": "ComponentName", "props": { ... }, "children": [...] }
`

interface CallOpts {
  modelId?: string
  modelProvider?: string
}

export async function generatePageUITree(
  args: {
    userPrompt: string
    plan: SitePlan
    manifest: SiteManifest
    page: ManifestPage
    cheatsheet: ComponentsCheatsheet
  },
  opts: CallOpts = {},
): Promise<{ tree: PageUITree; raw: string }> {
  const { userPrompt, plan, manifest, page, cheatsheet } = args

  const allowedExports = unionExports(page, manifest)
  const componentSubset = summarizeComponentsForPrompt(cheatsheet, allowedExports)

  const userMessage = `User prompt: ${userPrompt}

Page plan: ${JSON.stringify({
    path: page.path,
    title: page.title,
    purpose: page.purpose,
    sections: page.sections,
    features: page.features,
    primaryAction: page.primaryAction,
    layoutHint: page.layoutHint,
  })}

Manifest summary: ${JSON.stringify({
    projectName: manifest.projectName,
    siteType: manifest.siteType,
    brandStyle: manifest.brandStyle,
    motionStyle: manifest.motionStyle,
    pages: manifest.pages.map((p) => ({ path: p.path, title: p.title })),
  })}

Allowed components: ${JSON.stringify(componentSubset)}

Allowed motion wrappers: ["FadeIn", "Stagger", "StaggerItem", "MotionCard"]
Allowed handlers: ${JSON.stringify(page.handlers)}

Project context: ${plan.targetAudience}

Task: Generate the UI JSON tree for this page body.
`

  const result = await callModel({
    model: { id: opts.modelId ?? "gemini-2.5-pro", provider: opts.modelProvider ?? "Google" },
    messages: [
      { role: "system", content: PAGE_JSON_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
    temperature: 0.3,
  })

  if (!result.ok) {
    throw new Error(`AI page generator failed: ${result.message} ${result.details ?? ""}`.trim())
  }

  const parsed = parseUITreeJson(result.content)
  return { tree: parsed, raw: result.content }
}

export function parseUITreeJson(raw: string): PageUITree {
  const cleaned = stripCodeFences(raw).trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("Page JSON generator returned non-JSON content")
    }
    parsed = JSON.parse(cleaned.slice(start, end + 1))
  }
  return normalizeUITree(parsed)
}

export function normalizeUITree(value: unknown): PageUITree {
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const compRaw = obj.component
  const component = compRaw && typeof compRaw === "object"
    ? (compRaw as Record<string, unknown>)
    : (obj as Record<string, unknown>)
  const name = typeof component.name === "string" && component.name.trim().length > 0
    ? component.name
    : "main"
  const props = (component.props && typeof component.props === "object"
    ? (component.props as Record<string, unknown>)
    : {}) as Record<string, unknown>
  const childrenRaw = Array.isArray(component.children) ? component.children : []
  const children = childrenRaw.map((c) => normalizeChild(c)).filter(Boolean) as Array<
    string | { name: string; props?: Record<string, unknown>; children?: Array<unknown> }
  >
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name,
      props,
      children: children as PageUITree["component"]["children"],
    },
  }
}

function normalizeChild(value: unknown): unknown {
  if (typeof value === "string") return value
  if (typeof value === "number" || typeof value === "boolean") return String(value)
  if (!value || typeof value !== "object") return null
  const obj = value as Record<string, unknown>
  const name = typeof obj.name === "string" ? obj.name : ""
  if (!name) return null
  const props = (obj.props && typeof obj.props === "object" ? (obj.props as Record<string, unknown>) : {}) as Record<string, unknown>
  const childrenRaw = Array.isArray(obj.children) ? obj.children : []
  const children = childrenRaw.map(normalizeChild).filter((c) => c !== null && c !== undefined)
  return { name, props, children }
}

function stripCodeFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]
  return s
}

// Returns the union of allowed export names a page node may use:
// the per-page shadcn subset plus the motion wrappers and basic html.
function unionExports(page: ManifestPage, _manifest: SiteManifest): string[] {
  const set = new Set<string>(page.shadcnComponents)
  return Array.from(set).sort()
}
