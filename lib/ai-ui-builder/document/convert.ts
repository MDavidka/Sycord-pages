import type {
  DesignBrief,
  DesignDirection,
  GeneratedProjectManifest,
  PagePlan,
  SectionPlan,
  ThemePreset,
  ThemeTokens,
  ProjectContext,
  RunBuilderResult,
  BuilderOptions,
} from "@/lib/ai-website-builder/types"
import { runAIWebsiteBuilderFromManifest } from "@/lib/ai-website-builder"
import { buildTheme } from "@/lib/ai-website-builder/themes"
import { fallbackDesignDirection } from "@/lib/ai-website-builder/design-directions"
import { createDefaultBuilderDocument, type BuilderDocument, type BuilderPage } from "./types"
import type { ComponentNode } from "../catalog/components"

export interface BuilderExportOptions {
  prompt?: string
  project?: ProjectContext
  brief?: Partial<DesignBrief>
  designDirection?: DesignDirection
  themePreset?: ThemePreset
  themeTokens?: ThemeTokens
  builderOptions?: BuilderOptions
}

function buildSectionPlansFromTree(root: ComponentNode): SectionPlan[] {
  if (root.component === "Page" && root.children && root.children.length) {
    return root.children.map((child, index) => ({
      kind: "custom",
      variant: "custom",
      componentTree: child,
      anchor: child.props?.id ? String(child.props.id) : `section-${index + 1}`,
    }))
  }
  return [
    {
      kind: "custom",
      variant: "custom",
      componentTree: root,
      anchor: root.id,
    },
  ]
}

function buildPagePlan(page: BuilderPage): PagePlan {
  return {
    path: page.path,
    title: page.title,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
    sections: buildSectionPlansFromTree(page.tree),
  }
}

function defaultBrief(doc: BuilderDocument, opts: BuilderExportOptions): DesignBrief {
  const preset = opts.themePreset ?? doc.theme.preset
  return {
    projectName: opts.brief?.projectName ?? doc.state.projectName ?? "Sycord Builder",
    tagline: opts.brief?.tagline ?? doc.state.tagline ?? "Generated with the JSON builder",
    description: opts.brief?.description ?? doc.state.description ?? "A new generated site.",
    audience: opts.brief?.audience ?? "customers",
    voice: opts.brief?.voice ?? "confident",
    themePreset: preset,
    navLinks: doc.routes.map((route) => ({
      label: route.path === "/" ? "Home" : route.path.replace("/", "").replace(/-/g, " "),
      href: route.path,
    })),
    primaryCta: opts.brief?.primaryCta ?? { label: "Get started", href: "#" },
    secondaryCta: opts.brief?.secondaryCta,
    footerCta: opts.brief?.footerCta,
    socialLinks: opts.brief?.socialLinks,
    contact: opts.brief?.contact,
    logoUrl: opts.brief?.logoUrl,
    logoInitials: opts.brief?.logoInitials ?? "SY",
    category: opts.brief?.category ?? opts.project?.category,
  }
}

export function builderDocumentToManifest(
  document: BuilderDocument,
  opts: BuilderExportOptions = {},
): GeneratedProjectManifest {
  const prompt = opts.prompt ?? document.state.description ?? "Generated site"
  const themeTokens = opts.themeTokens ?? document.theme.tokens ?? buildTheme(document.theme.preset)
  const designDirection = opts.designDirection ?? fallbackDesignDirection(prompt, opts.project)

  return {
    brief: defaultBrief(document, opts),
    theme: themeTokens,
    designDirection,
    pages: document.pages.map(buildPagePlan),
    deploymentMode: "next-server",
    needsDatabase: false,
    databaseProvider: "none",
    integrations: [],
    requiredEnvVars: [],
    unconnectedIntegrations: [],
  }
}

export async function exportBuilderDocument(
  document: BuilderDocument,
  opts: BuilderExportOptions = {},
): Promise<RunBuilderResult> {
  const manifest = builderDocumentToManifest(document, opts)
  return runAIWebsiteBuilderFromManifest(manifest, opts.builderOptions ?? {})
}

export function manifestToBuilderDocument(
  manifest: GeneratedProjectManifest,
): BuilderDocument {
  const base = createDefaultBuilderDocument()
  const pages = manifest.pages.map((page) => {
    const root: ComponentNode = {
      id: `page-${page.path.replace(/[^a-z0-9]/gi, "-") || "home"}`,
      component: "Page",
      children: page.sections.map((section, index) => {
        if (section.componentTree) return section.componentTree
        return {
          id: `section-${index + 1}`,
          component: "Section",
          children: [
            {
              id: `container-${index + 1}`,
              component: "Container",
              children: [
                {
                  id: `stack-${index + 1}`,
                  component: "Stack",
                  children: [
                    { id: `heading-${index + 1}`, component: "Heading", text: section.heading ?? section.kind },
                    { id: `text-${index + 1}`, component: "Text", text: section.description ?? section.subheading ?? "" },
                  ],
                },
              ],
            },
          ],
        }
      }),
    }
    return {
      id: `page-${page.path}`,
      path: page.path,
      title: page.title,
      metaTitle: page.metaTitle,
      metaDescription: page.metaDescription,
      tree: root,
    }
  })

  return {
    ...base,
    pages,
    routes: pages.map((page) => ({ path: page.path, pageId: page.id })),
    theme: {
      preset: manifest.theme.preset,
      tokens: manifest.theme,
    },
    state: {
      projectName: manifest.brief.projectName,
      description: manifest.brief.description,
      tagline: manifest.brief.tagline,
    },
  }
}
