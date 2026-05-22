// Syra AI Planner — prompt engineering for manifest generation.
// Sends the user prompt to the selected AI model and returns a SiteManifest.
//
// The AI is strictly constrained:
//   - Only use components from the REGISTRY
//   - Only use allowed Tailwind classes (no arbitrary hex colors)
//   - Output valid JSON matching the SiteManifest schema
//   - Never output raw TSX or code
//   - Copy must be original, benefit-focused, no lorem ipsum

import { callModel, extractJson, type ChatMessage, type ModelSelection } from "@/lib/ai-provider"
import { registryByName } from "./registry"
import type { SiteManifest, PipelineState, ProgressCallback, ManifestSection } from "./types"

const FALLBACK_MODEL: ModelSelection = { id: "gemini-3.1-flash-preview", provider: "Google" }
const DEFAULT_MODEL: ModelSelection = { id: "gemini-3.1-pro-preview", provider: "Google" }

const allowedTypes = Array.from(registryByName.keys()).join(", ")

const ALLOWED_LAYOUTS = [
  "hero", "features", "pricing", "cta", "faq", "footer", "stats", "testimonials",
  "contact", "logos", "gallery", "team", "blog", "process", "generic",
]

const SYSTEM_PROMPT = `You are Syra, a production-grade generative UI builder. You convert natural language prompts into structured JSON manifests that a deterministic compiler turns into deployable Next.js pages.

CRITICAL RULES — you MUST follow these exactly:

1. ONLY use these component types: ${allowedTypes}
   - Never invent component names. Never output raw JSX, TSX, or code.
   - Use "button" for buttons, "card" for cards, "badge" for badges, "separator" for dividers.
   - For headings use the "label" type with a large className like "text-4xl font-bold".
   - For paragraphs use the "label" type with "text-lg text-muted-foreground".

2. ONLY use Tailwind CSS utility classes. Never output hex colors (#ff00ae).
   - Use design tokens: "bg-primary", "text-muted-foreground", "border-border", etc.
   - Valid spacing: "gap-4", "gap-6", "gap-8", "gap-12", "gap-16".
   - Valid text sizes: "text-sm", "text-base", "text-lg", "text-xl", "text-2xl", "text-3xl", "text-4xl", "text-5xl", "text-6xl".
   - Valid font weights: "font-light", "font-normal", "font-medium", "font-semibold", "font-bold".
   - Valid border radius: "rounded-sm", "rounded-md", "rounded-lg", "rounded-xl", "rounded-2xl", "rounded-full".

3. COPY QUALITY:
   - Headlines: 3-8 words, benefit-focused, specific.
   - Descriptions: 15-40 words, clear value proposition.
   - CTA labels: 2-4 words max.
   - NEVER use "lorem ipsum", "placeholder", "coming soon", "TBD", "production-ready".

4. STRUCTURE — output this JSON shape exactly:

{
  "projectName": string,
  "tagline": string,
  "theme": "saas" | "agency" | "ecommerce" | "portfolio" | "dark" | "minimal",
  "colorScheme": "neutral" | "vibrant" | "dark" | "soft" | "high-contrast",
  "density": "minimal" | "balanced" | "dense",
  "pages": [
    {
      "path": "/",
      "title": string,
      "metaTitle": string,
      "metaDescription": string,
      "sections": [
        {
          "id": string (kebab-case),
          "section": "hero" | "features" | "pricing" | "cta" | "faq" | "footer" | "stats" | "testimonials" | "contact" | "logos" | "gallery" | "team" | "blog" | "process" | "generic",
          "layout": "centered" | "split" | "grid-2col" | "grid-3col" | "asymmetric" | "bento" | "alternating",
          "bg": "default" | "muted" | "card" | "primary/5" | "accent/5",
          "padding": "sm" | "md" | "lg" | "xl",
          "elements": [
            {
              "id": string,
              "type": string (from allowed types),
              "variant": "default" | "secondary" | "destructive" | "outline" | "ghost" | "link",
              "size": "sm" | "default" | "lg" | "icon",
              "className": string (Tailwind utility classes only),
              "content": string,
              "props": {},
              "children": []
            }
          ]
        }
      ]
    }
  ]
}

5. LAYOUT VARIETY:
   - Vary section types: don't repeat the same section kind consecutively.
   - Vary layouts: mix centered, split, grid, asymmetric.
   - Vary density: minimal pages have fewer elements with more whitespace; dense pages pack more content.
   - Every page should feel like a different composition.

6. COMPOSE CREATIVELY:
   - Use cards inside grid layouts for feature sections.
   - Use badges above headings for context ("NEW", "BETA", "PRO").
   - Use separators between content blocks.
   - For hero sections: badge → heading → description → button group.
   - For feature sections: heading → description → card grid (3-6 cards).
   - For pricing sections: heading → description → 3 card columns with badges for popular tier.
   - For CTA sections: background-colored section with heading → description → button.
   - For FAQ sections: use a centered list of question-answer pairs.
   - For footer sections: small text with links.

7. ELEMENT COMPOSITION PATTERNS:
   - \`button\` elements: always have \`content\` (the button text) and \`variant\`.
   - \`badge\` elements: always have \`content\` and \`variant\`.
   - \`label\` elements used as headings: \`className\` with "text-4xl font-bold".
   - \`label\` elements used as body text: \`className\` with "text-lg text-muted-foreground".
   - \`card\` elements: contain children like badge+label+label+button.
   - \`separator\` elements: self-closing, just className.

Return ONLY the JSON object. No markdown fences, no prose, no comments.`

export async function planManifest(
  prompt: string,
  model: ModelSelection = DEFAULT_MODEL,
  onProgress?: (state: Partial<PipelineState>) => void,
): Promise<{ manifest: SiteManifest | null; raw: string; error?: string }> {
  onProgress?.({ detail: "Analyzing prompt for layout planning..." })

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Create a website for: ${prompt}\n\nDesign a polished, professional site with varied section layouts. Make it feel like a custom design, not a template. Use creative component compositions. Return the JSON manifest.`,
    },
  ]

  let raw = ""
  try {
    const result = await callModel({ model, messages, temperature: 0.75 })
    if (!result.ok) {
      return { manifest: null, raw: "", error: result.message }
    }
    raw = result.content
  } catch (err) {
    return { manifest: null, raw: "", error: err instanceof Error ? err.message : "AI call failed" }
  }

  onProgress?.({ detail: "Parsing generated manifest..." })

  const parsed = extractJson<SiteManifest>(raw)
  if (!parsed) {
    return { manifest: null, raw, error: "Failed to parse AI output as JSON" }
  }

  onProgress?.({ detail: "Normalizing manifest structure..." })
  const normalized = normalizeManifest(parsed, prompt)

  return { manifest: normalized, raw }
}

function normalizeManifest(raw: Partial<SiteManifest>, prompt: string): SiteManifest {
  const projectName = raw.projectName || prompt.split(/\s+/).slice(0, 3).join(" ") || "Syra Site"

  const pages = Array.isArray(raw.pages) && raw.pages.length > 0
    ? raw.pages
    : [createDefaultHomePage(prompt)]

  // Ensure home page exists
  if (!pages.some((p) => p.path === "/")) {
    pages.unshift(createDefaultHomePage(prompt))
  }

  // Normalize each page
  const normalizedPages = pages.map((page, pageIdx) => ({
    path: page.path || (pageIdx === 0 ? "/" : `/page-${pageIdx}`),
    title: page.title || "Page",
    metaTitle: page.metaTitle || `${page.title || "Page"} — ${projectName}`,
    metaDescription: page.metaDescription || "A beautifully designed page.",
    sections: normalizeSections(
      Array.isArray(page.sections) && page.sections.length > 0
        ? page.sections
        : [createDefaultSection("hero")]
    ),
  }))

  return {
    projectName,
    tagline: raw.tagline || "Beautiful, fast, on-brand.",
    theme: (["saas", "agency", "ecommerce", "portfolio", "dark", "minimal"].includes(raw.theme ?? "") ? raw.theme : "saas") as SiteManifest["theme"],
    colorScheme: (["neutral", "vibrant", "dark", "soft", "high-contrast"].includes(raw.colorScheme ?? "") ? raw.colorScheme : "neutral") as SiteManifest["colorScheme"],
    density: (["minimal", "balanced", "dense"].includes(raw.density ?? "") ? raw.density : "balanced") as SiteManifest["density"],
    pages: normalizedPages,
  }
}

function normalizeSections(sections: unknown[]): ManifestSection[] {
  return sections.map((s, i) => {
    const raw = s as Record<string, unknown>
    const elements = Array.isArray(raw.elements)
      ? raw.elements.filter(
          (el: unknown) => typeof el === "object" && el !== null && typeof (el as Record<string, unknown>).type === "string"
        ) as ManifestSection["elements"]
      : []

    return {
      id: typeof raw.id === "string" ? raw.id : `section-${i + 1}`,
      section: (typeof raw.section === "string" && ALLOWED_LAYOUTS.includes(raw.section) ? raw.section : "generic") as ManifestSection["section"],
      layout: typeof raw.layout === "string" ? raw.layout as ManifestSection["layout"] : undefined,
      bg: typeof raw.bg === "string" ? raw.bg as ManifestSection["bg"] : undefined,
      padding: typeof raw.padding === "string" ? raw.padding as ManifestSection["padding"] : undefined,
      elements: elements.length > 0 ? elements : [{ id: `el-${i}-1`, type: "label", content: "Content", className: "text-center text-muted-foreground" }],
    }
  })
}

function createDefaultHomePage(prompt: string) {
  return {
    path: "/",
    title: "Home",
    metaTitle: "Home",
    metaDescription: prompt.slice(0, 150),
    sections: [createDefaultSection("hero")],
  }
}

function createDefaultSection(section: string): ManifestSection {
  return {
    id: section,
    section: section as ManifestSection["section"],
    layout: "centered",
    padding: "md",
    elements: [
      { id: `el-${section}-1`, type: "badge", variant: "secondary", content: "Welcome", className: "mb-4" },
      { id: `el-${section}-2`, type: "label", content: "Build Something Great", className: "text-4xl font-bold tracking-tight" },
      { id: `el-${section}-3`, type: "label", content: "A beautiful, production-ready site generated by AI.", className: "text-lg text-muted-foreground mt-4 max-w-2xl" },
      { id: `el-${section}-4`, type: "button", variant: "default", size: "lg", content: "Get Started", className: "mt-8" },
    ],
  }
}
