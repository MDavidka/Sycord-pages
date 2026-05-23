// Syra Planner — AI prompt → ManifestAST v2 (siteMetadata + routingGraph + pages/sections/components)

import { callModel, extractJson, type ChatMessage, type ModelSelection } from "@/lib/ai-provider"
import { byPrimitive } from "./registry"
import type { ManifestAST, ManifestPage, ManifestSection, ManifestComponent } from "./types"

const DEFAULT_MODEL: ModelSelection = { id: "gemini-3.1-pro-preview", provider: "Google" }
const primitives = [...byPrimitive.keys()].sort().join(", ")

const SYSTEM_PROMPT = `You are Syra Engine, a production-grade UI manifest generator. You convert prompts into strict JSON manifests.

CRITICAL: Only use these shadcn primitives: ${primitives}
Tailwind tokens only — no hex colors: bg-primary, bg-secondary, bg-muted, bg-card, text-muted-foreground, border-border, rounded-xl, p-6, gap-6, etc.

Return ONLY this JSON shape:

{
  "$schema": "https://syra.dev/schemas/site-manifest.v1.json",
  "siteMetadata": {
    "projectId": string,
    "siteName": string,
    "globalTheme": {
      "variant": "dark" | "light",
      "primaryColor": string,
      "borderRadius": string
    }
  },
  "routingGraph": [],
  "pages": [
    {
      "pageId": string,
      "slug": string (kebab, "/" for home),
      "title": string,
      "metaDescription": string,
      "layout": {
        "rootType": "flex-col",
        "headerEnabled": true | false,
        "footerEnabled": true | false,
        "sections": [
          {
            "sectionId": string (kebab, unique),
            "semanticType": "hero" | "features" | "pricing" | "testimonials" | "cta" | "faq" | "footer" | "stats" | "contact" | "logos" | "gallery" | "team" | "blog" | "process" | "generic",
            "displayName": string,
            "layoutContainer": "container-grid" | "container-flex" | "full-width",
            "gridCols": number or null,
            "components": [
              {
                "id": string,
                "shadcnPrimitive": string (from the catalog),
                "purpose": string,
                "styles": { "customTailwindClasses": string },
                "props": { key: value },
                "children": null or [component]
              }
            ]
          }
        ]
      }
    }
  ]
}

Layout rules:
- hero: layoutContainer "container-flex", centered headings + buttons
- features: layoutContainer "container-grid", gridCols 3, cards with CardHeader+CardTitle+CardDescription
- pricing: layoutContainer "container-grid", gridCols 3, Card with pricing content
- cta: layoutContainer "container-flex", centered with button (variant="default", size="lg")
- faq: layoutContainer "container-flex", accordion components
- footer: layoutContainer "container-grid", gridCols 4, small text links

Component children example for a card:
{ "id": "c1", "shadcnPrimitive": "card", "styles": { "customTailwindClasses": "" }, "props": {}, "children": [
  { "id": "ch", "shadcnPrimitive": "card", "styles": {}, "props": { "children": "Card Header" }, "children": null }
]}

Button example: { "id": "b1", "shadcnPrimitive": "button", "styles": { "customTailwindClasses": "" }, "props": { "variant": "default", "size": "lg", "children": "Get Started" }, "children": null }

Copy quality: specific, benefit-focused. No "lorem ipsum", "placeholder", "coming soon".
Return ONLY the JSON object. No markdown, no prose.`

export async function planManifest(
  prompt: string,
  model: ModelSelection = DEFAULT_MODEL,
): Promise<{ manifest: ManifestAST | null; raw: string; error?: string }> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: prompt },
  ]

  let raw = ""
  try {
    const result = await callModel({ model, messages, temperature: 0.75 })
    if (!result.ok) return { manifest: null, raw: "", error: result.message }
    raw = result.content
  } catch (err) {
    return { manifest: null, raw: "", error: err instanceof Error ? err.message : "AI call failed" }
  }

  const parsed = extractJson<ManifestAST>(raw)
  if (!parsed) return { manifest: null, raw, error: "Failed to parse JSON" }

  const normalized = normalizeManifest(parsed, prompt)
  return { manifest: normalized, raw }
}

function normalizeManifest(raw: Partial<ManifestAST>, prompt: string): ManifestAST {
  const projectId = raw.siteMetadata?.projectId || `proj_${Date.now().toString(36)}`
  const siteName = raw.siteMetadata?.siteName || prompt.split(/\s+/).slice(0, 3).join(" ") || "Syra Site"

  const pages = Array.isArray(raw.pages) ? raw.pages.map((p) => normalizePage(p, projectId)) : [defaultPage(projectId, siteName)]
  if (!pages.some((p) => p.slug === "/")) pages.unshift(defaultPage(projectId, siteName))

  return {
    $schema: raw.$schema || "https://syra.dev/schemas/site-manifest.v1.json",
    siteMetadata: {
      ...raw.siteMetadata!,
      projectId,
      siteName,
      globalTheme: raw.siteMetadata?.globalTheme ?? { variant: "dark", primaryColor: "zinc", borderRadius: "0.5rem" },
    },
    routingGraph: raw.routingGraph || [],
    pages,
  }
}

function normalizePage(raw: Partial<ManifestPage>, projectId: string): ManifestPage {
  const sections = Array.isArray(raw.layout?.sections) ? raw.layout.sections.map(normalizeSection) : [defaultSection("hero")]
  return {
    pageId: raw.pageId || `page-${Date.now().toString(36)}`,
    slug: raw.slug || "/",
    title: raw.title || "Page",
    metaDescription: raw.metaDescription || "",
    layout: {
      rootType: "flex-col",
      headerEnabled: raw.layout?.headerEnabled ?? true,
      footerEnabled: raw.layout?.footerEnabled ?? true,
      sections,
    },
  }
}

function normalizeSection(raw: Partial<ManifestSection>): ManifestSection {
  return {
    sectionId: raw.sectionId || `section-${Date.now().toString(36)}`,
    semanticType: raw.semanticType || "generic",
    displayName: raw.displayName || raw.sectionId || "Section",
    layoutContainer: raw.layoutContainer || "container-flex",
    gridCols: typeof raw.gridCols === "number" ? raw.gridCols : null,
    components: Array.isArray(raw.components) ? raw.components : [{ id: "el-0", shadcnPrimitive: "badge", purpose: "", styles: { customTailwindClasses: "" }, props: { children: "Content" }, children: null }],
  }
}

function defaultPage(projectId: string, siteName: string): ManifestPage {
  return {
    pageId: "home",
    slug: "/",
    title: siteName,
    metaDescription: `Welcome to ${siteName} — built with Syra AI.`,
    layout: {
      rootType: "flex-col",
      headerEnabled: true,
      footerEnabled: true,
      sections: [defaultSection("hero")],
    },
  }
}

function defaultSection(type: string): ManifestSection {
  return {
    sectionId: type,
    semanticType: type as ManifestSection["semanticType"],
    displayName: type.charAt(0).toUpperCase() + type.slice(1),
    layoutContainer: "container-flex",
    gridCols: null,
    components: [
      { id: "badge", shadcnPrimitive: "badge", purpose: "", styles: { customTailwindClasses: "mb-4" }, props: { variant: "secondary", children: "Welcome" }, children: null },
      { id: "heading", shadcnPrimitive: "label", purpose: "", styles: { customTailwindClasses: "text-4xl font-bold tracking-tight" }, props: { children: "Build Something Great" }, children: null },
      { id: "desc", shadcnPrimitive: "label", purpose: "", styles: { customTailwindClasses: "text-lg text-muted-foreground mt-4 max-w-2xl" }, props: { children: "A beautiful site generated by AI." }, children: null },
      { id: "cta", shadcnPrimitive: "button", purpose: "", styles: { customTailwindClasses: "mt-8" }, props: { variant: "default", size: "lg", children: "Get Started" }, children: null },
    ],
  }
}
