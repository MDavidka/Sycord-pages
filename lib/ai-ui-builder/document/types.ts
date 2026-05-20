import type { ThemeTokens, ThemePreset } from "@/lib/ai-website-builder/types"
import { buildTheme } from "@/lib/ai-website-builder/themes"
import { generateNineDigitId } from "@/lib/generate-id"
import { COMPONENT_CATALOG_VERSION, type ComponentNode } from "../catalog/components"
import type { BuilderPatch } from "./patches"

export interface BuilderRoute {
  path: string
  pageId: string
}

export interface BuilderPage {
  id: string
  path: string
  title: string
  metaTitle: string
  metaDescription: string
  tree: ComponentNode
}

export interface BuilderTheme {
  preset: ThemePreset
  tokens: ThemeTokens
}

export interface BuilderDocumentState {
  projectName?: string
  description?: string
  tagline?: string
}

export interface BuilderDocument {
  id: string
  version: number
  componentCatalogVersion: string
  pages: BuilderPage[]
  routes: BuilderRoute[]
  theme: BuilderTheme
  state: BuilderDocumentState
  history: BuilderPatch[]
}

export const BUILDER_DOCUMENT_VERSION = 1

export function createDefaultBuilderDocument(): BuilderDocument {
  const preset: ThemePreset = "saas"
  const themeTokens = buildTheme(preset)
  const pageId = `page-${generateNineDigitId()}`
  const rootTree: ComponentNode = {
    id: "page-root",
    component: "Page",
    children: [
      {
        id: "section-hero",
        component: "Section",
        props: { className: "py-20" },
        children: [
          {
            id: "container-hero",
            component: "Container",
            children: [
              {
                id: "stack-hero",
                component: "Stack",
                children: [
                  {
                    id: "heading-hero",
                    component: "Heading",
                    text: "Describe your site to start building.",
                    props: { level: 1 },
                  },
                  {
                    id: "text-hero",
                    component: "Text",
                    text: "The live canvas is driven by a structured document and JSON patches.",
                  },
                  {
                    id: "button-hero",
                    component: "Button",
                    text: "Generate layout",
                    props: { variant: "default", size: "lg" },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  }

  return {
    id: `doc-${generateNineDigitId()}`,
    version: BUILDER_DOCUMENT_VERSION,
    componentCatalogVersion: COMPONENT_CATALOG_VERSION,
    pages: [
      {
        id: pageId,
        path: "/",
        title: "Home",
        metaTitle: "Home",
        metaDescription: "Generated homepage",
        tree: rootTree,
      },
    ],
    routes: [{ path: "/", pageId }],
    theme: { preset, tokens: themeTokens },
    state: {
      projectName: "Sycord Builder",
      description: "Generated with the JSON builder",
      tagline: "Design and export faster",
    },
    history: [],
  }
}
