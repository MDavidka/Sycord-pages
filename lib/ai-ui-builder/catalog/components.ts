export const COMPONENT_CATALOG_VERSION = "2026-05-20"

export const BUILDER_COMPONENTS = [
  "Page",
  "Section",
  "Container",
  "Grid",
  "Stack",
  "Card",
  "Button",
  "Input",
  "Accordion",
  "Tabs",
  "Avatar",
  "Badge",
  "Image",
  "Text",
  "Heading",
  "LineGraph",
] as const

export type BuilderComponentName = (typeof BUILDER_COMPONENTS)[number]
