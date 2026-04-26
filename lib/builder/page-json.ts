// ── Step 7: Page JSON Generation ────────────────────────────────────
// Ask AI to generate a page body as a JSON UI tree.

import type {
  ProjectManifest,
  ManifestPage,
  UiTreeEnvelope,
  ModelSelection,
} from "./types"
import { callModel, extractJson } from "@/lib/ai-provider"
import { selectComponentContextForPage } from "./component-context"

function buildManifestSummary(manifest: ProjectManifest): string {
  const routes = manifest.pages.map(p => `${p.route} — ${p.title}`).join("\n")
  return `Project: ${manifest.projectName}
Style: ${manifest.design.visualStyle}
Motion: ${manifest.design.motionLevel}
Theme: ${manifest.theme.name}, hue ${manifest.theme.primaryHue}
Routes:
${routes}`
}

function buildPagePrompt(
  manifest: ProjectManifest,
  page: ManifestPage,
  componentContext: string,
): string {
  return `You are the Page JSON stage of a v0-style AI website builder.
You generate exactly one page body as a JSON UI tree.
The generated project is a Next.js App Router site.
The site already has:
- app/layout.tsx
- SiteHeader
- SiteFooter
- global theme
- route structure
Do NOT generate:
- global header
- global navbar
- global footer
- imports
- TSX
- markdown
- comments
Return only valid JSON.
The page must be mobile-first.
Base classes must target mobile first.
Use sm:, md:, lg: only as enhancements.
Use only these allowed shadcn components:
${componentContext}
Use Framer Motion only through approved motion wrappers:
- FadeIn (wraps content with fade-in + slide-up animation)
- Stagger (parent container that staggers children animations)
- StaggerItem (child inside Stagger)
- MotionCard (card with hover lift animation)
Use this manifest:
${buildManifestSummary(manifest)}
Generate this page:
route: ${page.route}
title: ${page.title}
description: ${page.description}
layoutHint: ${page.layoutHint}
sectionSignature: ${page.sectionSignature.join(", ")}
features:
${page.features.map(f => `- ${f}`).join("\n")}
Output shape:
{
  "type": "ui-tree",
  "version": "1.0",
  "component": {
    "name": "main",
    "props": { "className": "..." },
    "children": [
      {
        "name": "section",
        "props": { "className": "..." },
        "children": [...]
      }
    ]
  }
}
Rules:
- Use div, section, h1, h2, h3, p, span, a, ul, li, img for HTML elements
- Use Button, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, Badge, Input, Textarea, Separator, Accordion, AccordionItem, AccordionTrigger, AccordionContent, Tabs, TabsList, TabsTrigger, TabsContent for shadcn components
- Use FadeIn, Stagger, StaggerItem, MotionCard for motion wrappers
- Use className for Tailwind classes (mobile-first)
- Use text for text content inside elements
- Include at least 4 sections
- Include every page feature listed above
- Include the page title visibly in an h1
- Use real, prompt-specific copy (no lorem ipsum)
- For internal links, use the routes from the manifest
- For handlers, use $handler.name format (e.g. $handler.addToCart)
- For local state, use $state.name format (e.g. $state.searchQuery)
- Add aria-labels to icon-only buttons
`
}

function buildFallbackTree(page: ManifestPage): UiTreeEnvelope {
  const sections = page.features.map((feature, i) => ({
    name: "section",
    props: { className: `py-10 sm:py-14 lg:py-20 ${i % 2 === 0 ? "bg-background" : "bg-muted/50"}` },
    children: [
      {
        name: "div",
        props: { className: "container px-4 sm:px-6 lg:px-8" },
        children: [
          {
            name: "FadeIn",
            children: [
              {
                name: "h2",
                props: { className: "text-2xl sm:text-3xl font-bold tracking-tight" },
                text: feature,
              },
              {
                name: "p",
                props: { className: "mt-3 text-muted-foreground max-w-2xl" },
                text: `Explore our ${feature.toLowerCase()} designed to provide the best experience.`,
              },
            ],
          },
        ],
      },
    ],
  }))

  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: {},
      children: [
        {
          name: "section",
          props: { className: "py-16 sm:py-20 lg:py-28 bg-background" },
          children: [
            {
              name: "div",
              props: { className: "container px-4 sm:px-6 lg:px-8 text-center" },
              children: [
                {
                  name: "FadeIn",
                  children: [
                    {
                      name: "h1",
                      props: { className: "text-3xl sm:text-4xl lg:text-6xl font-bold tracking-tight" },
                      text: page.title,
                    },
                    {
                      name: "p",
                      props: { className: "mt-4 sm:mt-6 text-lg text-muted-foreground max-w-2xl mx-auto" },
                      text: page.description,
                    },
                  ],
                },
              ],
            },
          ],
        },
        ...sections,
      ],
    },
  }
}

export async function runPageJsonGenerationStep(
  manifest: ProjectManifest,
  page: ManifestPage,
  model: ModelSelection,
): Promise<UiTreeEnvelope> {
  const { contextString } = selectComponentContextForPage(page)
  const prompt = buildPagePrompt(manifest, page, contextString)

  const result = await callModel({
    model,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: `Generate the JSON UI tree for the "${page.title}" page at route "${page.route}".` },
    ],
    temperature: 0.3,
  })

  if (result.ok) {
    const parsed = extractJson<UiTreeEnvelope>(result.content)
    if (parsed && parsed.component && parsed.component.name) {
      if (!parsed.type) parsed.type = "ui-tree"
      if (!parsed.version) parsed.version = "1.0"
      return parsed
    }

    // Retry once with stricter prompt
    const retryResult = await callModel({
      model,
      messages: [
        { role: "system", content: "Return ONLY valid JSON. No markdown, no explanation. Fix the previous response." },
        { role: "user", content: result.content },
      ],
      temperature: 0.1,
    })

    if (retryResult.ok) {
      const retryParsed = extractJson<UiTreeEnvelope>(retryResult.content)
      if (retryParsed && retryParsed.component) {
        if (!retryParsed.type) retryParsed.type = "ui-tree"
        if (!retryParsed.version) retryParsed.version = "1.0"
        return retryParsed
      }
    }
  }

  return buildFallbackTree(page)
}
