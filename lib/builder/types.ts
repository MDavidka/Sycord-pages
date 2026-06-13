// Builder block-config types (ported from OpenPage). JSON is the single source
// of truth: a site is fully described by blocks (grouped into pages) + a theme.

export type BlockType =
  | "navbar"
  | "hero"
  | "features"
  | "pricing"
  | "cta"
  | "footer"
  | "testimonials"
  | "stats"
  | "faq"
  | "team"
  | "contact"
  | "newsletter"
  | "logocloud"
  | "divider"
  | "banner"
  | "content"
  | "image"
  | "video"
  | "gallery"
  // Mini elements (shadcn-based, droppable anywhere)
  | "button"
  | "heading"
  | "text"
  | "badge"
  | "card"
  // Any shadcn UI component is registered with a `ui-<slug>` type. The open
  // string keeps autocomplete for the known literals above while allowing the
  // full shadcn catalogue to be added dynamically.
  | (string & {})

export type BlockVariant = string

export interface BlockConfig {
  id: string
  type: BlockType
  variant: BlockVariant
  props: Record<string, unknown>
}

export interface ThemeConfig {
  // Backgrounds
  bg0: string
  bg1: string
  bg2: string
  bg3: string
  bg4: string
  bg5: string
  // Text
  text0: string
  text1: string
  text2: string
  text3: string
  // Accent
  accent: string
  accentDim: string
  // Borders
  borderDefault: string
  borderSubtle: string
  borderHover: string
  // Fonts
  fontSans: string
  fontDisplay: string
  fontMono: string
  // Radius
  radius: number
  radiusLg: number
}

export interface PageConfig {
  id: string
  name: string
  path: string
  blocks: BlockConfig[]
}

export interface SiteConfig {
  name: string
  pages?: PageConfig[]
  blocks: BlockConfig[]
  theme?: Partial<ThemeConfig>
  /** Reusable values referenced in text via the {{key}} syntax. */
  variables?: { key: string; value: string }[]
}
