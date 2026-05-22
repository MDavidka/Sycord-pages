// Semantic UI block system for generated websites.
// Every piece of UI is composed from typed, verifiable shadcn blocks.
// This ensures every generated website uses real shadcn components
// (https://ui.shadcn.com/docs/components) while maintaining variety via
// composition, variants, sizes, and content — not by inventing new components.
//
// Block tree → deterministic TSX renderer. The AI plans blocks; the
// renderer never hallucinates component names or props.

export const SHADCN_BLOCK_KINDS = [
  // Layout primitives
  "Section", "Container", "Grid", "Stack", "Flex",
  // Typography
  "Heading", "Text", "Label",
  // Interactive
  "Button", "Badge",
  // Content cards (shadcn Card family)
  "Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter",
  // Disclosure
  "Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent",
  // Tabs
  "Tabs", "TabsList", "TabsTrigger", "TabsContent",
  // Forms
  "Input", "Textarea", "Select", "Checkbox", "Switch", "RadioGroup",
  // Media
  "Avatar", "AvatarImage", "AvatarFallback", "Image",
  // Decorative
  "Separator", "Divider",
  // Feedback
  "Skeleton", "Progress", "Alert", "AlertTitle", "AlertDescription",
  // Navigation
  "Breadcrumb", "Pagination",
  // Data display
  "Table", "Chart",
  // Overlays (used sparingly in marketing sites)
  "Dialog", "DialogTrigger", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription",
  "Sheet", "SheetTrigger", "SheetContent",
  // Misc
  "Tooltip", "HoverCard",
] as const

export type ShadcnBlockKind = (typeof SHADCN_BLOCK_KINDS)[number]

export type BlockVariant =
  | "default" | "secondary" | "destructive" | "outline" | "ghost" | "link"
  | "primary" | "muted" | "accent"

export type BlockSize =
  | "xs" | "sm" | "default" | "lg" | "xl" | "2xl" | "3xl" | "icon"

export type GridCols = 1 | 2 | 3 | 4 | 5 | 6

export interface BlockProps {
  variant?: BlockVariant
  size?: BlockSize
  cols?: GridCols
  gap?: "sm" | "default" | "lg"
  align?: "start" | "center" | "end" | "stretch" | "between"
  padding?: "none" | "sm" | "default" | "lg" | "xl"
  radius?: "none" | "sm" | "default" | "lg" | "full"
  shadow?: "none" | "sm" | "default" | "lg"
  border?: "none" | "default" | "accent"
  bg?: "transparent" | "card" | "muted" | "primary" | "accent" | "inverse"
  fullWidth?: boolean
  animate?: "none" | "fade-in" | "slide-up" | "scale-in"
}

export interface Block {
  id: string
  kind: ShadcnBlockKind
  props?: Partial<BlockProps>
  text?: string
  children?: Block[]
  heading?: string
  subheading?: string
  description?: string
  eyebrow?: string
  cta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  src?: string
  alt?: string
  href?: string
  icon?: string
  value?: string
  suffix?: string
  prefix?: string
  placeholder?: string
  items?: Block[]
  highlighted?: boolean
  inverted?: boolean
  label?: string
  initials?: string
  price?: string
  period?: string
  quote?: string
  author?: string
  role?: string
  avatar?: string
  tag?: string
  date?: string
  category?: string
  features?: string[]
  badge?: string
}

// High-level section compositions that use shadcn blocks.
// Each section kind has 2+ block-based layout variants.
export type SectionBlockLayout =
  | "hero-centered"
  | "hero-split"
  | "hero-cinematic"
  | "hero-dashboard"
  | "feature-cards"
  | "feature-bento"
  | "feature-icon-grid"
  | "feature-alternating"
  | "stats-row"
  | "stats-cards"
  | "testimonials-grid"
  | "testimonials-spotlight"
  | "pricing-tiers"
  | "pricing-toggle"
  | "faq-accordion"
  | "faq-grid"
  | "contact-form"
  | "contact-split"
  | "cta-banner"
  | "cta-boxed"
  | "logos-row"
  | "gallery-grid"
  | "gallery-masonry"
  | "process-steps"
  | "process-timeline"
  | "team-grid"
  | "blog-cards"
  | "comparison-table"
  | "product-grid"

export interface SectionBlockPlan {
  kind: SectionBlockLayout
  heading?: string
  subheading?: string
  description?: string
  eyebrow?: string
  cta?: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  items: Block[]
  anchor?: string
  bg?: "transparent" | "card" | "muted" | "primary" | "accent"
}

export interface PageBlockPlan {
  path: string
  title: string
  metaTitle: string
  metaDescription: string
  sections: SectionBlockPlan[]
}

export interface GeneratedBlockManifest {
  projectName: string
  tagline: string
  description: string
  audience: string
  voice: string
  themePreset: string
  pages: PageBlockPlan[]
  navLinks: Array<{ label: string; href: string }>
}
