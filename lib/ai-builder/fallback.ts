// Deterministic fallback page UI tree, used when AI page generation
// fails twice (initial + repair). The fallback is built from the
// page plan + the verified component subset, so it always passes
// validation and produces a usable page.

import type { ManifestPage, PageUITree, UINode } from "./types"

export function buildFallbackTree(page: ManifestPage): PageUITree {
  const sections: UINode[] = page.sections.map((s, idx) => buildSection(page, s, idx))

  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "mx-auto w-full max-w-6xl px-4 py-12 sm:py-16 lg:py-24" },
      children: [
        buildHero(page),
        ...sections,
        buildCta(page),
      ],
    },
  }
}

function buildHero(page: ManifestPage): UINode {
  return {
    name: "FadeIn",
    props: { className: "mb-12 sm:mb-16" },
    children: [
      {
        name: "section",
        props: { className: "flex flex-col gap-4 sm:gap-6" },
        children: [
          ...(has(page, "Badge")
            ? [
                {
                  name: "Badge",
                  props: { variant: "secondary", className: "w-fit" },
                  children: [page.title],
                } as UINode,
              ]
            : []),
          {
            name: "h1",
            props: { className: "text-3xl font-semibold tracking-tight sm:text-5xl" },
            children: [page.purpose],
          },
          {
            name: "p",
            props: { className: "max-w-2xl text-base text-muted-foreground sm:text-lg" },
            children: [page.purpose],
          },
          ...(has(page, "Button")
            ? [
                {
                  name: "div",
                  props: { className: "flex flex-col gap-3 sm:flex-row" },
                  children: [
                    {
                      name: "Button",
                      props: {
                        size: "lg",
                        onClick: page.handlers[0] ? `$handler.${page.handlers[0]}` : undefined,
                      },
                      children: [page.primaryAction || "Get started"],
                    },
                  ],
                } as UINode,
              ]
            : []),
        ],
      },
    ],
  }
}

function buildSection(page: ManifestPage, sectionTitle: string, idx: number): UINode {
  const featureRow = page.features.slice(idx * 2, idx * 2 + 2)
  const featuresToShow = featureRow.length > 0 ? featureRow : page.features.slice(0, 3)
  const cards: UINode[] = featuresToShow.map((feature, fidx) => buildFeatureCard(page, feature, idx + fidx))

  return {
    name: "Stagger",
    props: { className: "mb-12 grid gap-6 sm:mb-16 sm:gap-8" },
    children: [
      {
        name: "h2",
        props: { className: "text-2xl font-semibold tracking-tight sm:text-3xl" },
        children: [sectionTitle],
      },
      {
        name: "div",
        props: { className: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6" },
        children: cards,
      },
    ],
  }
}

function buildFeatureCard(page: ManifestPage, feature: string, idx: number): UINode {
  if (has(page, "Card")) {
    return {
      name: "StaggerItem",
      props: {},
      children: [
        {
          name: "Card",
          props: { className: "h-full" },
          children: [
            {
              name: "CardHeader",
              props: {},
              children: [
                {
                  name: "CardTitle",
                  props: { className: "text-base sm:text-lg" },
                  children: [feature],
                },
                {
                  name: "CardDescription",
                  props: {},
                  children: [`${feature} for ${page.title.toLowerCase()}.`],
                },
              ],
            },
            {
              name: "CardContent",
              props: { className: "text-sm text-muted-foreground" },
              children: [`Built into the ${page.title} flow with mobile-first layout.`],
            },
          ],
        },
      ],
    }
  }
  return {
    name: "StaggerItem",
    props: { className: "rounded-lg border border-border bg-card p-6" },
    children: [
      { name: "h3", props: { className: "text-lg font-semibold" }, children: [feature] },
      {
        name: "p",
        props: { className: "mt-2 text-sm text-muted-foreground" },
        children: [`${feature} on ${page.title}.`],
      },
    ],
  }
}

function buildCta(page: ManifestPage): UINode {
  return {
    name: "FadeIn",
    props: { className: "mt-12 rounded-xl border border-border bg-card p-8 sm:mt-16 sm:p-12" },
    children: [
      {
        name: "section",
        props: { className: "flex flex-col gap-4 text-center sm:gap-6" },
        children: [
          {
            name: "h2",
            props: { className: "text-2xl font-semibold tracking-tight sm:text-3xl" },
            children: [page.primaryAction || "Get started"],
          },
          {
            name: "p",
            props: { className: "mx-auto max-w-xl text-sm text-muted-foreground sm:text-base" },
            children: [`Take the next step on ${page.title.toLowerCase()}.`],
          },
          ...(has(page, "Button")
            ? [
                {
                  name: "div",
                  props: { className: "flex justify-center" },
                  children: [
                    {
                      name: "Button",
                      props: {
                        size: "lg",
                        onClick: page.handlers[0] ? `$handler.${page.handlers[0]}` : undefined,
                      },
                      children: [page.primaryAction || "Get started"],
                    },
                  ],
                } as UINode,
              ]
            : []),
        ],
      },
    ],
  }
}

function has(page: ManifestPage, name: string): boolean {
  return page.shadcnComponents.includes(name)
}
