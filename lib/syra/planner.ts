// Syra AI Planner — converts user prompts + conversation history into ManifestAST JSON.
// Constrained to only use components from the registry and Tailwind token classes.

import { callModel, extractJson, type ChatMessage, type ModelSelection } from "@/lib/ai-provider"
import { getAllowedTypes, registryByName } from "./registry"
import { validateManifest } from "./schema"
import type { ManifestAST, ManifestSection, ManifestPage } from "./types"

const DEFAULT_MODEL: ModelSelection = { id: "gemini-3.1-pro-preview", provider: "Google" }
const allowedTypes = getAllowedTypes().join(", ")

const SYSTEM_PROMPT = `You are Syra, a production-grade generative UI builder. You convert prompts into precise JSON manifests that compile into deployable Next.js + shadcn/ui pages.

COMPONENT CATALOG — use ONLY these types:
${[...registryByName.keys()].sort().join(", ")}

Sub-components: CardHeader, CardTitle, CardDescription, CardContent, CardFooter, AccordionItem, AccordionTrigger, AccordionContent, TabsList, TabsTrigger, TabsContent, SelectTrigger, SelectValue, SelectContent, SelectItem, AvatarImage, AvatarFallback, TableHeader, TableBody, TableRow, TableHead, TableCell, AlertTitle, AlertDescription, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription, TooltipTrigger, TooltipContent, PopoverTrigger, PopoverContent, HoverCardTrigger, HoverCardContent, CarouselContent, CarouselItem, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator, PaginationContent, PaginationItem, PaginationLink, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink, RadioGroupItem, ScrollBar, ResizablePanel, ResizableHandle, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent

TAILWIND ONLY — never use hex colors. Use these tokens:
- Colors: bg-primary, bg-secondary, bg-muted, bg-accent, bg-card, bg-background, bg-foreground, text-primary, text-secondary, text-muted-foreground, text-accent-foreground, border-border, border-input
- Text sizes: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl, text-3xl, text-4xl, text-5xl, text-6xl
- Weights: font-light, font-normal, font-medium, font-semibold, font-bold
- Spacing: gap-2, gap-4, gap-6, gap-8, gap-12, gap-16, p-4, p-6, p-8, px-4, px-6, px-8, py-4, py-6, py-8, py-12, py-20
- Radius: rounded-sm, rounded-md, rounded-lg, rounded-xl, rounded-2xl, rounded-full
- Layout: max-w-2xl, max-w-4xl, max-w-6xl, w-full, h-full, min-h-screen
- Motion: transition-all, duration-200, duration-300, hover:scale-105, animate-in, fade-in, slide-in-from-bottom-4

OUTPUT FORMAT — return ONLY a JSON object:
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
          "id": string (kebab, unique),
          "type": "hero" | "features" | "pricing" | "cta" | "faq" | "footer" | "stats" | "testimonials" | "contact" | "logos" | "gallery" | "team" | "blog" | "process" | "generic",
          "layout": "centered" | "split" | "grid-2" | "grid-3" | "grid-4" | "asymmetric" | "bento" | "alternating",
          "bg": "default" | "muted" | "card" | "primary/5" | "accent/5",
          "padding": "sm" | "md" | "lg" | "xl",
          "elements": [
            {
              "id": string,
              "type": string (from component catalog),
              "variant": "default" | "secondary" | "destructive" | "outline" | "ghost" | "link",
              "size": "sm" | "default" | "lg" | "icon",
              "className": string (Tailwind tokens only),
              "content": string,
              "children": [ { ... element ... } ]
            }
          ]
        }
      ]
    }
  ]
}

COMPOSITION RULES:
1. Hero: badge → heading (text-5xl font-bold) → description (text-lg text-muted-foreground) → button group
2. Features: heading → description → grid of cards (3-6), each card has CardHeader(CardTitle) + CardContent(label)
3. Pricing: heading → 3 card columns, middle one with variant="secondary" as highlighted tier
4. CTA: bg="primary/5" with centered heading + description + button
5. FAQ: centered list of questions (label with text-lg font-semibold) and answers (label with text-muted-foreground)
6. Footer: small grid with text-sm links
7. Vary layouts consecutively — never repeat the same type+layout combo
8. Copy must be original, benefit-focused, no lorem ipsum

Return ONLY the JSON. No prose, no markdown fences.`

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
  if (!parsed) return { manifest: null, raw, error: "Failed to parse AI output as JSON" }

  const normalized = normalizeAst(parsed, prompt)
  return { manifest: normalized, raw }
}

function normalizeAst(raw: Partial<ManifestAST>, prompt: string): ManifestAST {
  const projectName = raw.projectName || prompt.split(/\s+/).slice(0, 3).join(" ") || "Syra Site"
  const pages = Array.isArray(raw.pages) && raw.pages.length > 0
    ? raw.pages.map((p) => normalizePage(p, projectName))
    : [defaultPage(projectName, prompt)]

  if (!pages.some((p) => p.path === "/")) {
    pages.unshift(defaultPage(projectName, prompt))
  }

  return {
    projectName,
    tagline: raw.tagline || "Built with Syra AI",
    theme: raw.theme && ["saas", "agency", "ecommerce", "portfolio", "dark", "minimal"].includes(raw.theme) ? raw.theme : "saas",
    colorScheme: raw.colorScheme && ["neutral", "vibrant", "dark", "soft", "high-contrast"].includes(raw.colorScheme) ? raw.colorScheme : "neutral",
    density: raw.density && ["minimal", "balanced", "dense"].includes(raw.density) ? raw.density : "balanced",
    pages,
  }
}

function normalizePage(raw: Partial<ManifestPage>, projectName: string): ManifestPage {
  return {
    path: raw.path || "/",
    title: raw.title || "Page",
    metaTitle: raw.metaTitle || `${raw.title || "Page"} — ${projectName}`,
    metaDescription: raw.metaDescription || "A beautifully designed page.",
    sections: Array.isArray(raw.sections) ? raw.sections.map(normalizeSection) : [defaultSection("hero")],
  }
}

function normalizeSection(raw: Partial<ManifestSection>): ManifestSection {
  const validTypes = new Set(["hero", "features", "pricing", "cta", "faq", "footer", "stats", "testimonials", "contact", "logos", "gallery", "team", "blog", "process", "generic"])
  const elements = Array.isArray(raw.elements) ? raw.elements.filter((e) => typeof e?.type === "string") : []

  return {
    id: raw.id || `section-${Date.now().toString(36)}`,
    type: raw.type && validTypes.has(raw.type) ? raw.type as ManifestSection["type"] : "generic",
    layout: raw.layout as ManifestSection["layout"],
    bg: raw.bg as ManifestSection["bg"],
    padding: raw.padding as ManifestSection["padding"],
    elements: elements.length > 0 ? elements : [defaultElement("badge", "Content")],
  }
}

function defaultElement(type: string, content: string): ManifestSection["elements"][0] {
  return { id: `el-${Date.now().toString(36)}`, type, content }
}

function defaultPage(name: string, prompt: string): ManifestPage {
  return {
    path: "/",
    title: "Home",
    metaTitle: `Home — ${name}`,
    metaDescription: prompt.slice(0, 150),
    sections: [defaultSection("hero")],
  }
}

function defaultSection(type: string): ManifestSection {
  return {
    id: type,
    type: type as ManifestSection["type"],
    layout: "centered",
    padding: "md",
    elements: [
      { id: "el-badge", type: "badge", variant: "secondary", content: "Welcome", className: "mb-4" },
      { id: "el-heading", type: "label", content: "Build Something Great", className: "text-4xl font-bold tracking-tight" },
      { id: "el-desc", type: "label", content: "A beautiful site generated by AI.", className: "text-lg text-muted-foreground mt-4 max-w-2xl" },
      { id: "el-cta", type: "button", variant: "default", size: "lg", content: "Get Started", className: "mt-8" },
    ],
  }
}
