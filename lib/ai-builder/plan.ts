// AI planning step: turns a single user prompt into a strict
// JSON website plan. Uses the unified callModel helper from
// lib/ai-provider.ts which routes Google models to Vertex AI
// in express mode using GOOGLE_AIAGENT_API.

import { callModel } from "@/lib/ai-provider"

import type { PagePlan, SitePlan, SiteType } from "./types"

export const PLANNER_SYSTEM_PROMPT = `You are the planning brain of a v0-style AI website builder. Analyze the user request deeply and create a real multi-page website plan. Do not guess generic pages. Decide the pages, sections, components, layout direction, and interactions based on the user prompt.

Return strict JSON only. No markdown, no commentary, no code fences.

The JSON shape is:
{
  "projectName": "string",
  "siteType": "commerce | saas | portfolio | dashboard | blog | docs | agency | other",
  "targetAudience": "string",
  "brandStyle": "string",
  "pages": [
    {
      "path": "/",
      "title": "string",
      "purpose": "string",
      "sections": ["string", "string"],
      "features": ["string", "string"],
      "primaryAction": "string",
      "layoutHint": "string",
      "componentsNeeded": ["Button", "Card", "Badge"]
    }
  ]
}

Rules:
- Generate 4 to 7 pages unless the user explicitly asks for fewer.
- The first page MUST have path "/".
- Every page MUST have a unique purpose.
- Every page MUST include sections and features arrays with no fewer than 4 items each.
- componentsNeeded MUST be shadcn/ui exported component names only (e.g. "Button", "Card", "Badge").
- No generic filler. No lorem ipsum.
`

const VALID_SITE_TYPES: SiteType[] = [
  "commerce",
  "saas",
  "portfolio",
  "dashboard",
  "blog",
  "docs",
  "agency",
  "other",
]

interface CallOpts {
  modelId?: string
  modelProvider?: string
}

export async function generateSitePlan(userPrompt: string, opts: CallOpts = {}): Promise<SitePlan> {
  const modelProvider = opts.modelProvider ?? "Google"
  const modelId = opts.modelId ?? "gemini-2.5-pro"

  const result = await callModel({
    model: { id: modelId, provider: modelProvider },
    messages: [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.4,
  })

  if (!result.ok) {
    throw new Error(`AI planner failed: ${result.message} ${result.details ?? ""}`.trim())
  }

  return parsePlanJson(result.content, userPrompt)
}

export function parsePlanJson(raw: string, userPrompt: string): SitePlan {
  const cleaned = stripCodeFences(raw).trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const start = cleaned.indexOf("{")
    const end = cleaned.lastIndexOf("}")
    if (start === -1 || end === -1 || end <= start) {
      throw new Error("AI planner returned non-JSON content")
    }
    parsed = JSON.parse(cleaned.slice(start, end + 1))
  }
  return normalizePlan(parsed, userPrompt)
}

function stripCodeFences(s: string): string {
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1]
  return s
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback
}

function asStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
}

export function normalizePlan(value: unknown, userPrompt: string): SitePlan {
  const obj = (value && typeof value === "object" ? value : {}) as Record<string, unknown>
  const rawSiteType = asString(obj.siteType, "other")
  const siteType: SiteType = (VALID_SITE_TYPES as string[]).includes(rawSiteType)
    ? (rawSiteType as SiteType)
    : "other"

  const rawPages = Array.isArray(obj.pages) ? obj.pages : []
  const pages: PagePlan[] = rawPages
    .map((p) => normalizePage(p))
    .filter((p): p is PagePlan => p !== null)

  // Enforce: first page must be "/".
  if (pages.length === 0 || pages[0].path !== "/") {
    pages.unshift({
      path: "/",
      title: "Home",
      purpose: "Introduce the project and convert visitors.",
      sections: ["Hero", "Features", "Social proof", "Call to action"],
      features: ["Primary CTA", "Feature highlights", "Testimonials", "Footer CTA"],
      primaryAction: "Get started",
      layoutHint: "stacked-mobile-first",
      componentsNeeded: ["Button", "Card", "Badge"],
    })
  }

  // Enforce unique paths.
  const seen = new Set<string>()
  const dedupedPages: PagePlan[] = []
  for (const page of pages) {
    if (seen.has(page.path)) continue
    seen.add(page.path)
    dedupedPages.push(page)
  }

  return {
    projectName: asString(obj.projectName, deriveProjectName(userPrompt)),
    siteType,
    targetAudience: asString(obj.targetAudience, "General audience"),
    brandStyle: asString(obj.brandStyle, "Modern, clean, mobile-first"),
    pages: dedupedPages,
  }
}

function normalizePage(value: unknown): PagePlan | null {
  const obj = (value && typeof value === "object" ? value : null) as Record<string, unknown> | null
  if (!obj) return null
  const rawPath = asString(obj.path).trim()
  if (!rawPath) return null
  const path = rawPath.startsWith("/") ? rawPath : `/${rawPath}`
  const sections = asStringArray(obj.sections)
  const features = asStringArray(obj.features)
  if (sections.length < 1 || features.length < 1) return null
  return {
    path,
    title: asString(obj.title, titleFromPath(path)),
    purpose: asString(obj.purpose, "Inform visitors and drive engagement."),
    sections,
    features,
    primaryAction: asString(obj.primaryAction, "Get started"),
    layoutHint: asString(obj.layoutHint, "stacked-mobile-first"),
    componentsNeeded: asStringArray(obj.componentsNeeded),
  }
}

function titleFromPath(p: string): string {
  if (p === "/") return "Home"
  const seg = p.split("/").filter(Boolean).pop() ?? "Page"
  return seg
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

function deriveProjectName(userPrompt: string): string {
  const words = userPrompt.split(/\s+/).filter(Boolean).slice(0, 3)
  if (words.length === 0) return "AI Generated Site"
  return words
    .map((w) => w.replace(/[^a-zA-Z0-9]/g, ""))
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
}
