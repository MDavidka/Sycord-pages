// Deterministic shadcn block → TSX renderer.
// Every block is a verified shadcn/ui component (https://ui.shadcn.com/docs/components).
// The AI plans blocks with content; this renderer never invents component names.
//
// Design principle: every generated website looks like it was built by
// composing shadcn components — because it was.

import type { Block, SectionBlockLayout, SectionBlockPlan } from "./block-types"

export type { SectionBlockLayout }

function esc(s: string): string {
  return s.replace(/[{}`]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").trim()
}

function jsx(s: string): string {
  return JSON.stringify(s.replace(/[{}`]/g, "").trim())
}

function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter((c): c is string => typeof c === "string" && c.length > 0).join(" ")
}

const paddingMap: Record<string, string> = {
  none: "p-0",
  sm: "px-4 py-6 sm:px-6 sm:py-10",
  default: "px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20",
  lg: "px-6 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-28",
  xl: "px-8 py-24 sm:px-12 sm:py-32 lg:px-16 lg:py-40",
}

const gridColsMap: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
}

const gapMap: Record<string, string> = {
  sm: "gap-3",
  default: "gap-6 sm:gap-8",
  lg: "gap-8 sm:gap-12",
}

const bgMap: Record<string, string> = {
  transparent: "bg-transparent",
  card: "bg-card",
  muted: "bg-muted/50",
  primary: "bg-primary/5",
  accent: "bg-accent/50",
  inverse: "bg-foreground text-background",
}

const alignMap: Record<string, string> = {
  start: "items-start text-left",
  center: "items-center text-center",
  end: "items-end text-right",
  stretch: "items-stretch",
  between: "justify-between",
}

const shadowMap: Record<string, string> = {
  none: "",
  sm: "shadow-sm",
  default: "shadow-md",
  lg: "shadow-xl",
}

const radiusMap: Record<string, string> = {
  none: "rounded-none",
  sm: "rounded-sm",
  default: "rounded-xl",
  lg: "rounded-2xl",
  full: "rounded-full",
}

const animateMap: Record<string, string> = {
  none: "",
  "fade-in": "animate-in fade-in duration-500",
  "slide-up": "animate-in slide-in-from-bottom-8 duration-500",
  "scale-in": "animate-in zoom-in-95 duration-500",
}

// Shadcn component variant/style maps
const badgeVariantClass: Record<string, string> = {
  default: "",
  secondary: "variant=\"secondary\"",
  outline: "variant=\"outline\"",
  destructive: "variant=\"destructive\"",
  muted: "className=\"bg-muted text-muted-foreground\"",
  accent: "className=\"bg-accent text-accent-foreground\"",
}

const buttonVariantClass: Record<string, string> = {
  default: "variant=\"default\"",
  secondary: "variant=\"secondary\"",
  outline: "variant=\"outline\"",
  ghost: "variant=\"ghost\"",
  link: "variant=\"link\"",
  destructive: "variant=\"destructive\"",
  primary: "variant=\"default\"",
  accent: "variant=\"secondary\"",
  muted: "variant=\"ghost\"",
}

const buttonSizeClass: Record<string, string> = {
  xs: "size=\"sm\"",
  sm: "size=\"sm\"",
  default: "size=\"default\"",
  lg: "size=\"lg\"",
  xl: "size=\"lg\" className=\"text-base px-8\"",
  "2xl": "size=\"lg\" className=\"text-lg px-10 py-7\"",
  "3xl": "size=\"lg\" className=\"text-xl px-12 py-8\"",
  icon: "size=\"icon\"",
}

const headingSizeClass: Record<string, string> = {
  xs: "text-lg",
  sm: "text-xl sm:text-2xl",
  default: "text-2xl sm:text-3xl lg:text-4xl",
  lg: "text-3xl sm:text-4xl lg:text-5xl",
  xl: "text-4xl sm:text-5xl lg:text-6xl",
  "2xl": "text-5xl sm:text-6xl lg:text-7xl",
  "3xl": "text-6xl sm:text-7xl lg:text-8xl",
}

const textSizeClass: Record<string, string> = {
  xs: "text-xs",
  sm: "text-sm",
  default: "text-base",
  lg: "text-lg",
  xl: "text-xl",
  "2xl": "text-2xl",
}

function renderBlock(block: Block, depth: number = 0): string {
  const p = block.props ?? {}
  const classes: string[] = []

  if (p.animate && animateMap[p.animate]) classes.push(animateMap[p.animate])

  switch (block.kind) {
    case "Section": {
      const pad = paddingMap[p.padding ?? "default"]
      const bg = bgMap[p.bg ?? "transparent"]
      const al = alignMap[p.align ?? "start"]
      const idAttr = block.id ? ` id="${block.id}"` : ""
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<section${idAttr} className="${cn(pad, bg, ...classes)}"\n${depth > 0 ? "  " : ""}>\n  <div className="mx-auto max-w-7xl ${al}">\n${indent(children, 2)}\n  </div>\n</section>`
    }

    case "Container": {
      const pad = paddingMap[p.padding ?? "default"]
      const bg = bgMap[p.bg ?? "transparent"]
      const al = alignMap[p.align ?? "start"]
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<div className="${cn(pad, bg, al, ...classes)}">\n${indent(children, 1)}\n</div>`
    }

    case "Grid": {
      const cols = gridColsMap[p.cols ?? 3]
      const gap = gapMap[p.gap ?? "default"]
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<div className="${cn("grid", cols, gap, ...classes)}">\n${indent(children, 1)}\n</div>`
    }

    case "Stack": {
      const gap = gapMap[p.gap ?? "default"]
      const al = alignMap[p.align ?? "start"]
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<div className="${cn("flex flex-col", gap, al, ...classes)}">\n${indent(children, 1)}\n</div>`
    }

    case "Flex": {
      const gap = gapMap[p.gap ?? "default"]
      const al = alignMap[p.align ?? "center"]
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<div className="${cn("flex flex-wrap", gap, al, ...classes)}">\n${indent(children, 1)}\n</div>`
    }

    case "Heading": {
      const sizeCls = headingSizeClass[p.size ?? "default"]
      const weight = p.size === "xl" || p.size === "2xl" || p.size === "3xl" ? "font-bold" : "font-semibold"
      const tracking = p.size === "xl" || p.size === "2xl" || p.size === "3xl" ? "tracking-tight" : "tracking-tight"
      const text = block.heading || block.text || ""
      const variant = p.variant === "muted" ? "text-muted-foreground" : p.variant === "accent" ? "text-accent-foreground" : "text-foreground"
      return `<h2 className="${cn(sizeCls, weight, tracking, variant, ...classes)}">${esc(text)}</h2>`
    }

    case "Text": {
      const sizeCls = textSizeClass[p.size ?? "default"]
      const variant = p.variant === "muted" ? "text-muted-foreground" : p.variant === "secondary" ? "text-muted-foreground" : "text-foreground"
      const text = block.description || block.text || ""
      const leading = p.size === "lg" || p.size === "xl" ? "leading-relaxed" : "leading-relaxed"
      return `<p className="${cn(sizeCls, leading, variant, "max-w-prose", ...classes)}">${esc(text)}</p>`
    }

    case "Label": {
      const text = block.text || block.eyebrow || ""
      const variant = p.variant === "muted" ? "text-muted-foreground" : p.variant === "accent" ? "text-accent-foreground" : "text-muted-foreground"
      return `<Label className="${cn("text-xs sm:text-sm font-medium tracking-wide uppercase", variant, ...classes)}">${esc(text)}</Label>`
    }

    case "Button": {
      const btnVar = buttonVariantClass[p.variant ?? "default"]
      const btnSize = buttonSizeClass[p.size ?? "default"]
      const href = block.href || block.cta?.href || "#"
      const label = block.text || block.cta?.label || "Learn more"
      const isLink = href.startsWith("/") || href.startsWith("http")
      if (isLink) {
        return `<Button ${btnVar} ${btnSize} asChild className="${cn(...classes)}"><a href="${href}">${esc(label)}</a></Button>`
      }
      return `<Button ${btnVar} ${btnSize} className="${cn(...classes)}">${esc(label)}</Button>`
    }

    case "Badge": {
      const variant = badgeVariantClass[p.variant ?? "default"]
      const text = block.text || block.eyebrow || ""
      return `<Badge ${variant} className="${cn(...classes)}">${esc(text)}</Badge>`
    }

    case "Card": {
      const shadow = shadowMap[p.shadow ?? "default"]
      const radius = radiusMap[p.radius ?? "default"]
      const border = p.border === "none" ? "border-0" : ""
      const bg = bgMap[p.bg ?? "card"]
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<Card className="${cn(shadow, radius, border, bg, ...classes)}">\n${indent(children, 1)}\n</Card>`
    }

    case "CardHeader": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<CardHeader className="${cn(...classes)}">\n${indent(children, 1)}\n</CardHeader>`
    }

    case "CardTitle": {
      const text = block.heading || block.text || ""
      return `<CardTitle className="${cn(...classes)}">${esc(text)}</CardTitle>`
    }

    case "CardDescription": {
      const text = block.description || block.text || ""
      return `<CardDescription className="${cn(...classes)}">${esc(text)}</CardDescription>`
    }

    case "CardContent": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<CardContent className="${cn(...classes)}">\n${indent(children, 1)}\n</CardContent>`
    }

    case "CardFooter": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<CardFooter className="${cn(...classes)}">\n${indent(children, 1)}\n</CardFooter>`
    }

    case "Accordion": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<Accordion type="single" collapsible className="${cn("w-full", ...classes)}">\n${indent(children, 1)}\n</Accordion>`
    }

    case "AccordionItem": {
      const value = block.id || "item-1"
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<AccordionItem value="${value}" className="${cn(...classes)}">\n${indent(children, 1)}\n</AccordionItem>`
    }

    case "AccordionTrigger": {
      const text = block.heading || block.text || ""
      return `<AccordionTrigger className="${cn(...classes)}">${esc(text)}</AccordionTrigger>`
    }

    case "AccordionContent": {
      const text = block.description || block.text || ""
      return `<AccordionContent className="${cn(...classes)}">${esc(text)}</AccordionContent>`
    }

    case "Tabs": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<Tabs defaultValue="${(block.children?.[0]?.id || "tab-0")}" className="${cn("w-full", ...classes)}">\n${indent(children, 1)}\n</Tabs>`
    }

    case "TabsList": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<TabsList className="${cn(...classes)}">\n${indent(children, 1)}\n</TabsList>`
    }

    case "TabsTrigger": {
      const value = block.id || "tab-0"
      const text = block.text || ""
      return `<TabsTrigger value="${value}" className="${cn(...classes)}">${esc(text)}</TabsTrigger>`
    }

    case "TabsContent": {
      const value = block.id || "tab-0"
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<TabsContent value="${value}" className="${cn(...classes)}">\n${indent(children, 1)}\n</TabsContent>`
    }

    case "Input": {
      const placeholder = block.placeholder || ""
      const type = block.props?.variant === "muted" ? "email" : "text"
      return `<Input type="${type}" placeholder="${esc(placeholder)}" className="${cn(...classes)}" />`
    }

    case "Textarea": {
      const placeholder = block.placeholder || ""
      return `<Textarea placeholder="${esc(placeholder)}" className="${cn("min-h-[120px]", ...classes)}" />`
    }

    case "Select": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<Select>\n  <SelectTrigger className="${cn(...classes)}"><SelectValue placeholder="${esc(block.placeholder || "Select...")}" /></SelectTrigger>\n  <SelectContent>\n${indent(children, 2)}\n  </SelectContent>\n</Select>`
    }

    case "Checkbox": {
      const text = block.text || ""
      return `<div className="flex items-center gap-2"><Checkbox id="${block.id}" className="${cn(...classes)}" /><Label htmlFor="${block.id}">${esc(text)}</Label></div>`
    }

    case "Switch": {
      const text = block.text || ""
      return `<div className="flex items-center gap-2"><Switch id="${block.id}" className="${cn(...classes)}" /><Label htmlFor="${block.id}">${esc(text)}</Label></div>`
    }

    case "Avatar": {
      const src = block.src || ""
      const fallback = block.text || "U"
      const sizeCls = p.size === "lg" || p.size === "xl" ? "h-16 w-16" : p.size === "sm" ? "h-8 w-8" : "h-10 w-10"
      return `<Avatar className="${cn(sizeCls, ...classes)}">\n  <AvatarImage src="${src}" />\n  <AvatarFallback>${esc(fallback)}</AvatarFallback>\n</Avatar>`
    }

    case "Image": {
      const src = block.src || "https://via.placeholder.com/800x600"
      const alt = block.alt || ""
      return `<img src="${src}" alt="${esc(alt)}" className="${cn("rounded-xl object-cover w-full", ...classes)}" loading="lazy" />`
    }

    case "Separator": {
      const variant = p.variant === "muted" ? "bg-muted" : "bg-border"
      return `<Separator className="${cn(variant, ...classes)}" />`
    }

    case "Skeleton": {
      return `<Skeleton className="${cn("h-4 w-full rounded", ...classes)}" />`
    }

    case "Progress": {
      const value = block.value || "66"
      return `<Progress value={${value}} className="${cn("w-full", ...classes)}" />`
    }

    case "Alert": {
      const variantCls = p.variant === "destructive" ? "variant=\"destructive\"" : ""
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<Alert ${variantCls} className="${cn(...classes)}">\n${indent(children, 1)}\n</Alert>`
    }

    case "AlertTitle": {
      const text = block.heading || block.text || ""
      return `<AlertTitle>${esc(text)}</AlertTitle>`
    }

    case "AlertDescription": {
      const text = block.description || block.text || ""
      return `<AlertDescription>${esc(text)}</AlertDescription>`
    }

    case "Breadcrumb": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<Breadcrumb className="${cn(...classes)}">\n  <BreadcrumbList>\n${indent(children, 2)}\n  </BreadcrumbList>\n</Breadcrumb>`
    }

    case "Pagination": {
      return `<Pagination className="${cn(...classes)}">\n  <PaginationContent>\n    <PaginationPrevious href="#" />\n    <PaginationItem><PaginationLink href="#">1</PaginationLink></PaginationItem>\n    <PaginationItem><PaginationLink href="#">2</PaginationLink></PaginationItem>\n    <PaginationNext href="#" />\n  </PaginationContent>\n</Pagination>`
    }

    case "Table": {
      const children = block.children?.map((c) => renderBlock(c, depth + 1)).join("\n") ?? ""
      return `<div className="overflow-x-auto rounded-xl border"><Table className="${cn(...classes)}">\n${indent(children, 1)}\n</Table></div>`
    }

    case "Chart": {
      return `<div className="${cn("w-full h-64 bg-muted/30 rounded-xl flex items-center justify-center text-muted-foreground text-sm", ...classes)}"><BarChart3 className="h-8 w-8 mr-2" /> Chart placeholder</div>`
    }

    default:
      return `<div className="${cn(...classes)}">${esc(block.text || "")}</div>`
  }
}

// ---- Section-level block compositions ----
// These are the high-level layouts the AI planner selects from.
// Each produces a complete section by composing shadcn blocks.

export function renderSectionBlock(plan: SectionBlockPlan): { tsx: string; imports: string[] } {
  const imports = new Set<string>()

  switch (plan.kind) {
    case "hero-centered":
      imports.add("Badge").add("Button")
      return { tsx: buildHeroCentered(plan), imports: Array.from(imports) }
    case "hero-split":
      imports.add("Badge").add("Button").add("Image")
      return { tsx: buildHeroSplit(plan), imports: Array.from(imports) }
    case "hero-cinematic":
      imports.add("Badge").add("Button")
      return { tsx: buildHeroCinematic(plan), imports: Array.from(imports) }
    case "hero-dashboard":
      imports.add("Badge").add("Button").add("Image")
      return { tsx: buildHeroDashboard(plan), imports: Array.from(imports) }
    case "feature-cards":
      imports.add("Card").add("CardHeader").add("CardTitle").add("CardDescription").add("CardContent").add("Badge")
      return { tsx: buildFeatureCards(plan), imports: Array.from(imports) }
    case "feature-bento":
      imports.add("Card").add("CardHeader").add("CardTitle").add("CardDescription").add("CardContent").add("Badge")
      return { tsx: buildFeatureBento(plan), imports: Array.from(imports) }
    case "feature-icon-grid":
      imports.add("Card").add("CardHeader").add("CardTitle").add("CardDescription").add("CardContent")
      return { tsx: buildFeatureIconGrid(plan), imports: Array.from(imports) }
    case "feature-alternating":
      imports.add("Badge").add("Button").add("Image")
      return { tsx: buildFeatureAlternating(plan), imports: Array.from(imports) }
    case "stats-row":
      imports.add("Separator")
      return { tsx: buildStatsRow(plan), imports: Array.from(imports) }
    case "stats-cards":
      imports.add("Card").add("CardContent")
      return { tsx: buildStatsCards(plan), imports: Array.from(imports) }
    case "testimonials-grid":
      imports.add("Card").add("CardHeader").add("CardContent").add("CardFooter").add("Avatar")
      return { tsx: buildTestimonialsGrid(plan), imports: Array.from(imports) }
    case "testimonials-spotlight":
      imports.add("Card").add("CardContent").add("Avatar")
      return { tsx: buildTestimonialsSpotlight(plan), imports: Array.from(imports) }
    case "pricing-tiers":
      imports.add("Card").add("CardHeader").add("CardTitle").add("CardDescription").add("CardContent").add("CardFooter").add("Badge").add("Button").add("Separator")
      return { tsx: buildPricingTiers(plan), imports: Array.from(imports) }
    case "pricing-toggle":
      imports.add("Card").add("CardHeader").add("CardTitle").add("CardDescription").add("CardContent").add("CardFooter").add("Badge").add("Button").add("Switch")
      return { tsx: buildPricingToggle(plan), imports: Array.from(imports) }
    case "faq-accordion":
      imports.add("Accordion").add("AccordionItem").add("AccordionTrigger").add("AccordionContent")
      return { tsx: buildFaqAccordion(plan), imports: Array.from(imports) }
    case "faq-grid":
      imports.add("Card").add("CardHeader").add("CardTitle").add("CardDescription")
      return { tsx: buildFaqGrid(plan), imports: Array.from(imports) }
    case "contact-form":
      imports.add("Card").add("CardContent").add("Input").add("Textarea").add("Button").add("Label")
      return { tsx: buildContactForm(plan), imports: Array.from(imports) }
    case "contact-split":
      imports.add("Card").add("CardContent").add("Input").add("Textarea").add("Button").add("Label").add("Badge")
      return { tsx: buildContactSplit(plan), imports: Array.from(imports) }
    case "cta-banner":
      imports.add("Button").add("Badge")
      return { tsx: buildCtaBanner(plan), imports: Array.from(imports) }
    case "cta-boxed":
      imports.add("Card").add("CardContent").add("Button").add("Badge")
      return { tsx: buildCtaBoxed(plan), imports: Array.from(imports) }
    case "logos-row":
      return { tsx: buildLogosRow(plan), imports: Array.from(imports) }
    case "gallery-grid":
      imports.add("Image")
      return { tsx: buildGalleryGrid(plan), imports: Array.from(imports) }
    case "gallery-masonry":
      imports.add("Image")
      return { tsx: buildGalleryMasonry(plan), imports: Array.from(imports) }
    case "process-steps":
      imports.add("Badge").add("Separator")
      return { tsx: buildProcessSteps(plan), imports: Array.from(imports) }
    case "process-timeline":
      imports.add("Badge").add("Card").add("CardContent")
      return { tsx: buildProcessTimeline(plan), imports: Array.from(imports) }
    case "team-grid":
      imports.add("Card").add("CardContent").add("Avatar")
      return { tsx: buildTeamGrid(plan), imports: Array.from(imports) }
    case "blog-cards":
      imports.add("Card").add("CardHeader").add("CardTitle").add("CardDescription").add("CardContent").add("CardFooter").add("Badge").add("Avatar")
      return { tsx: buildBlogCards(plan), imports: Array.from(imports) }
    case "comparison-table":
      imports.add("Table").add("Badge").add("Button")
      return { tsx: buildComparisonTable(plan), imports: Array.from(imports) }
    case "product-grid":
      imports.add("Card").add("CardContent").add("Button").add("Badge").add("Image")
      return { tsx: buildProductGrid(plan), imports: Array.from(imports) }
    default:
      return { tsx: `<section className="px-4 py-12"><div className="mx-auto max-w-7xl"><p>Section: ${plan.kind}</p></div></section>`, imports: [] }
  }
}

// ---- Section builders ----

function sectionWrapper(plan: SectionBlockPlan, content: string): string {
  const id = plan.anchor ? ` id="${plan.anchor}"` : ""
  const bg = plan.bg === "muted" ? "bg-muted/50" : plan.bg === "accent" ? "bg-accent/50" : plan.bg === "primary" ? "bg-primary/5" : ""
  return `<section${id} className="px-4 py-16 sm:py-20 lg:py-28 ${bg}">\n  <div className="mx-auto max-w-7xl">\n${indent(content, 2)}\n  </div>\n</section>`
}

function sectionHeader(plan: SectionBlockPlan): string {
  const lines: string[] = []
  if (plan.eyebrow) lines.push(`<Badge variant="secondary" className="mb-4">${esc(plan.eyebrow)}</Badge>`)
  if (plan.heading) lines.push(`<h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4">${esc(plan.heading)}</h2>`)
  if (plan.subheading) lines.push(`<p className="text-lg sm:text-xl text-muted-foreground max-w-2xl">${esc(plan.subheading)}</p>`)
  if (plan.description) lines.push(`<p className="text-muted-foreground max-w-2xl">${esc(plan.description)}</p>`)
  return `<div className="max-w-3xl">${lines.join("\n")}</div>`
}

function ctaButtons(plan: SectionBlockPlan): string {
  const btns: string[] = []
  if (plan.cta) btns.push(`<Button size="lg" asChild><a href="${plan.cta.href}">${esc(plan.cta.label)}</a></Button>`)
  if (plan.secondaryCta) btns.push(`<Button variant="outline" size="lg" asChild><a href="${plan.secondaryCta.href}">${esc(plan.secondaryCta.label)}</a></Button>`)
  return btns.length ? `<div className="flex flex-wrap gap-4">${btns.join("\n")}</div>` : ""
}

// Hero variants
function buildHeroCentered(plan: SectionBlockPlan): string {
  const inner = `${sectionHeader(plan)}\n${ctaButtons(plan)}`
  return sectionWrapper(plan, `<div className="flex flex-col items-center text-center gap-8 py-12">\n${indent(inner, 2)}\n</div>`)
}

function buildHeroSplit(plan: SectionBlockPlan): string {
  const inner = `${sectionHeader(plan)}\n${ctaButtons(plan)}`
  return `<section className="px-4 py-16 sm:py-24 lg:py-32">
  <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
    <div className="flex flex-col gap-6">
${indent(inner, 3)}
    </div>
    <div className="relative aspect-[4/3] rounded-2xl bg-muted overflow-hidden">
      <img src="https://via.placeholder.com/800x600" alt="" className="object-cover w-full h-full" loading="lazy" />
    </div>
  </div>
</section>`
}

function buildHeroCinematic(plan: SectionBlockPlan): string {
  const inner = `${sectionHeader(plan)}\n${ctaButtons(plan)}`
  return `<section className="relative px-4 py-24 sm:py-32 lg:py-40 overflow-hidden">
  <div className="absolute inset-0 bg-grid opacity-30" />
  <div className="relative mx-auto max-w-4xl flex flex-col items-center text-center gap-8">
${indent(inner, 2)}
  </div>
</section>`
}

function buildHeroDashboard(plan: SectionBlockPlan): string {
  const inner = `${sectionHeader(plan)}\n${ctaButtons(plan)}`
  return `<section className="px-4 pt-16 pb-0 sm:pt-24 lg:pt-32">
  <div className="mx-auto max-w-7xl">
    <div className="flex flex-col items-center text-center gap-8 pb-12">
${indent(inner, 3)}
    </div>
    <div className="relative mx-auto max-w-5xl rounded-t-2xl border border-b-0 bg-card overflow-hidden shadow-2xl">
      <img src="https://via.placeholder.com/1200x675" alt="" className="w-full" loading="lazy" />
    </div>
  </div>
</section>`
}

// Feature grid variants
function buildFeatureCards(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    const icon = item.icon ? `<div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-4"><span className="text-lg">${esc(item.icon)}</span></div>` : ""
    return `<Card key={i} className="group hover:shadow-lg transition-shadow">
  <CardHeader>${icon}<CardTitle>${esc(item.heading || item.text || "")}</CardTitle><CardDescription>${esc(item.description || "")}</CardDescription></CardHeader>
</Card>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">\n${indent(items, 1)}\n</div>`)
}

function buildFeatureBento(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    const highlighted = item.highlighted ? " lg:row-span-2" : ""
    const icon = item.icon ? `<div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4"><span className="text-lg">${esc(item.icon)}</span></div>` : ""
    const cardClass = "group hover:shadow-lg transition-shadow" + highlighted
    return `<Card key={i} className="${cardClass}">
  <CardContent className="p-6 lg:p-8">
    ${icon}
    ${item.eyebrow ? `<Badge variant="secondary" className="mb-3">${esc(item.eyebrow)}</Badge>` : ""}
    <h3 className="text-lg font-semibold mb-2">${esc(item.heading || item.text || "")}</h3>
    <p className="text-sm text-muted-foreground">${esc(item.description || "")}</p>
  </CardContent>
</Card>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">\n${indent(items, 1)}\n</div>`)
}

function buildFeatureIconGrid(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    const icon = item.icon ? `<div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-4"><span className="text-xl">${esc(item.icon)}</span></div>` : ""
    return `<Card key={i} className="border-0 shadow-none bg-transparent">
  <CardHeader className="p-0">${icon}<CardTitle className="text-base">${esc(item.heading || item.text || "")}</CardTitle></CardHeader>
  <CardContent className="p-0 mt-1"><CardDescription>${esc(item.description || "")}</CardDescription></CardContent>
</Card>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">\n${indent(items, 1)}\n</div>`)
}

function buildFeatureAlternating(plan: SectionBlockPlan): string {
  const rows = plan.items.map((item, i) => {
    const isReversed = i % 2 === 1
    const inner = `<div className="flex flex-col gap-4">${item.eyebrow ? `<Badge variant="secondary" className="w-fit">${esc(item.eyebrow)}</Badge>` : ""}<h3 className="text-2xl sm:text-3xl font-bold">${esc(item.heading || item.text || "")}</h3><p className="text-muted-foreground text-lg">${esc(item.description || "")}</p>${item.cta ? `<Button variant="outline" asChild className="mt-2 w-fit"><a href="${item.cta.href}">${esc(item.cta.label)}</a></Button>` : ""}</div>`
    const img = `<div className="aspect-[4/3] rounded-2xl bg-muted overflow-hidden"><img src="https://via.placeholder.com/800x600" alt="" className="object-cover w-full h-full" loading="lazy" /></div>`
    return `<div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center py-12">\n${isReversed ? `${indent(img, 1)}\n${indent(inner, 1)}` : `${indent(inner, 1)}\n${indent(img, 1)}`}\n</div>`
  }).join("\n\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n${rows}`)
}

// Stats variants
function buildStatsRow(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    return `<div key={i} className="text-center">
  <div className="text-3xl sm:text-4xl font-bold tracking-tight">${esc(item.value || "")}${item.suffix ? esc(item.suffix) : ""}</div>
  <div className="text-sm text-muted-foreground mt-1">${esc(item.text || item.label || "")}</div>
</div>`
  }).join("\n")
  const sep = `<Separator className="my-8" />`
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-8">\n${indent(items, 1)}\n</div>`)
}

function buildStatsCards(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    return `<Card key={i}>
  <CardContent className="p-6 text-center">
    <div className="text-4xl font-bold tracking-tight text-primary">${esc(item.value || "")}${item.suffix ? esc(item.suffix) : ""}</div>
    <div className="text-sm text-muted-foreground mt-2">${esc(item.text || item.label || "")}</div>
    ${item.description ? `<p className="text-xs text-muted-foreground mt-2">${esc(item.description)}</p>` : ""}
  </CardContent>
</Card>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">\n${indent(items, 1)}\n</div>`)
}

// Testimonials variants
function buildTestimonialsGrid(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    return `<Card key={i} className="group hover:shadow-lg transition-shadow">
  <CardContent className="p-6">
    <p className="text-sm leading-relaxed">${esc(item.description || item.text || "")}</p>
  </CardContent>
  <CardFooter className="px-6 pb-6 pt-0 flex items-center gap-3">
    <Avatar><AvatarFallback>${esc(item.icon || item.initials || "U")}</AvatarFallback></Avatar>
    <div>
      <div className="text-sm font-medium">${esc(item.heading || item.text || "")}</div>
      ${item.eyebrow ? `<div className="text-xs text-muted-foreground">${esc(item.eyebrow)}</div>` : ""}
    </div>
  </CardFooter>
</Card>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">\n${indent(items, 1)}\n</div>`)
}

function buildTestimonialsSpotlight(plan: SectionBlockPlan): string {
  const featured = plan.items[0]
  const others = plan.items.slice(1, 4)
  const featuredBlock = featured ? `<Card className="lg:col-span-2">
  <CardContent className="p-8 lg:p-10">
    <p className="text-lg sm:text-xl leading-relaxed">${esc(featured.description || featured.text || "")}</p>
    <div className="flex items-center gap-3 mt-6">
      <Avatar className="h-12 w-12"><AvatarFallback>${esc(featured.icon || featured.initials || "U")}</AvatarFallback></Avatar>
      <div>
        <div className="font-semibold">${esc(featured.heading || featured.text || "")}</div>
        ${featured.eyebrow ? `<div className="text-sm text-muted-foreground">${esc(featured.eyebrow)}</div>` : ""}
      </div>
    </div>
  </CardContent>
</Card>` : ""
  const otherCards = others.map((item, i) => `<Card key={i}><CardContent className="p-6"><p className="text-sm leading-relaxed">${esc(item.description || item.text || "")}</p><div className="flex items-center gap-2 mt-4"><Avatar className="h-8 w-8"><AvatarFallback>${esc(item.icon || item.initials || "U")}</AvatarFallback></Avatar><div className="text-sm font-medium">${esc(item.heading || item.text || "")}</div></div></CardContent></Card>`).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid lg:grid-cols-3 gap-6">\n${indent(featuredBlock + (others.length ? `\n<div className="flex flex-col gap-6">${otherCards}</div>` : ""), 1)}\n</div>`)
}

// Pricing variants
function buildPricingTiers(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    const featured = item.highlighted
    const features = item.children?.map((f) => `<li className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-primary" /><span className="text-sm">${esc(f.text || "")}</span></li>`).join("\n") ?? ""
    return `<Card key={i} className={${featured ? "{'relative border-primary shadow-lg scale-[1.02]'}" : "''"}}>
  ${featured ? `<Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Popular</Badge>` : ""}
  <CardHeader className="text-center">
    <CardTitle>${esc(item.heading || item.text || "")}</CardTitle>
    <CardDescription>${esc(item.description || "")}</CardDescription>
    <div className="mt-4">
      <span className="text-4xl font-bold">${esc(item.value || item.price || "")}</span>
      ${item.suffix ? `<span className="text-muted-foreground">/${esc(item.suffix)}</span>` : ""}
    </div>
  </CardHeader>
  <CardContent>
    <ul className="space-y-3">${features}</ul>
  </CardContent>
  <CardFooter className="flex-col">
    <Button className="w-full" variant={${featured ? '"default"' : '"outline"'}} asChild>
      <a href="${item.cta?.href || plan.cta?.href || "#"}">${esc(item.cta?.label || "Get started")}</a>
    </Button>
  </CardFooter>
</Card>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-start max-w-5xl mx-auto">\n${indent(items, 1)}\n</div>`)
}

function buildPricingToggle(plan: SectionBlockPlan): string {
  return buildPricingTiers({ ...plan, kind: "pricing-tiers" })
}

// FAQ variants
function buildFaqAccordion(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    return `<AccordionItem value="item-${i}">
  <AccordionTrigger>${esc(item.heading || item.text || "")}</AccordionTrigger>
  <AccordionContent>${esc(item.description || "")}</AccordionContent>
</AccordionItem>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 max-w-3xl mx-auto">\n  <Accordion type="single" collapsible className="w-full">\n${indent(items, 2)}\n  </Accordion>\n</div>`)
}

function buildFaqGrid(plan: SectionBlockPlan): string {
  const items = plan.items.map((item, i) => {
    return `<Card key={i}>
  <CardHeader><CardTitle className="text-base">${esc(item.heading || item.text || "")}</CardTitle></CardHeader>
  <CardContent><CardDescription>${esc(item.description || "")}</CardDescription></CardContent>
</Card>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-4">\n${indent(items, 1)}\n</div>`)
}

// Contact variants
function buildContactForm(plan: SectionBlockPlan): string {
  return sectionWrapper(plan, `<div className="max-w-xl mx-auto">
  ${sectionHeader(plan)}
  <Card className="mt-8">
    <CardContent className="p-6 sm:p-8 space-y-4">
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2"><Label>First name</Label><Input placeholder="John" /></div>
        <div className="space-y-2"><Label>Last name</Label><Input placeholder="Doe" /></div>
      </div>
      <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="you@example.com" /></div>
      <div className="space-y-2"><Label>Message</Label><Textarea placeholder="Tell us about your project..." className="min-h-[120px]" /></div>
      ${ctaButtons(plan)}
    </CardContent>
  </Card>
</div>`)
}

function buildContactSplit(plan: SectionBlockPlan): string {
  return `<section className="px-4 py-16 sm:py-24">
  <div className="mx-auto max-w-7xl grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
    <div>
      ${sectionHeader(plan)}
      <div className="mt-8 space-y-4">
        ${plan.items.map((item, i) => `<div key={i} className="flex items-start gap-3"><div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><span>${esc(item.icon || "•")}</span></div><div><div className="font-medium">${esc(item.heading || item.text || "")}</div><div className="text-sm text-muted-foreground">${esc(item.description || "")}</div></div></div>`).join("\n")}
      </div>
    </div>
    <Card>
      <CardContent className="p-6 sm:p-8 space-y-4">
        <div className="space-y-2"><Label>Name</Label><Input placeholder="Your name" /></div>
        <div className="space-y-2"><Label>Email</Label><Input type="email" placeholder="you@example.com" /></div>
        <div className="space-y-2"><Label>Message</Label><Textarea placeholder="How can we help?" className="min-h-[120px]" /></div>
        <Button className="w-full" asChild><a href="${plan.cta?.href || "#"}">${esc(plan.cta?.label || "Send message")}</a></Button>
      </CardContent>
    </Card>
  </div>
</section>`
}

// CTA variants
function buildCtaBanner(plan: SectionBlockPlan): string {
  return sectionWrapper({ ...plan, bg: plan.bg || "primary" }, `<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
  <div className="max-w-2xl">
    ${plan.eyebrow ? `<Badge variant="outline" className="mb-3">${esc(plan.eyebrow)}</Badge>` : ""}
    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">${esc(plan.heading || "")}</h2>
    ${plan.description ? `<p className="text-muted-foreground mt-2">${esc(plan.description)}</p>` : ""}
  </div>
  ${ctaButtons(plan)}
</div>`)
}

function buildCtaBoxed(plan: SectionBlockPlan): string {
  return sectionWrapper(plan, `<Card className="bg-primary/5 border-primary/20 max-w-4xl mx-auto">
  <CardContent className="p-8 sm:p-12 lg:p-16 flex flex-col items-center text-center gap-6">
    ${plan.eyebrow ? `<Badge variant="secondary">${esc(plan.eyebrow)}</Badge>` : ""}
    <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">${esc(plan.heading || "")}</h2>
    ${plan.description ? `<p className="text-lg text-muted-foreground max-w-xl">${esc(plan.description)}</p>` : ""}
    ${ctaButtons(plan)}
  </CardContent>
</Card>`)
}

// Logos row
function buildLogosRow(plan: SectionBlockPlan): string {
  const logos = plan.items.map((item, i) => `<div key={i} className="text-muted-foreground/60 font-semibold text-sm sm:text-base">${esc(item.text || item.label || "")}</div>`).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-8 grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-8 items-center justify-items-center">\n${indent(logos, 1)}\n</div>`)
}

// Gallery variants
function buildGalleryGrid(plan: SectionBlockPlan): string {
  const imgs = plan.items.map((item, i) => `<div key={i} className="aspect-square rounded-xl bg-muted overflow-hidden"><img src="${item.src || "https://via.placeholder.com/600x600"}" alt="${esc(item.alt || item.text || "")}" className="object-cover w-full h-full hover:scale-105 transition-transform" loading="lazy" /></div>`).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">\n${indent(imgs, 1)}\n</div>`)
}

function buildGalleryMasonry(plan: SectionBlockPlan): string {
  const imgs = plan.items.map((item, i) => {
    const tall = i % 3 === 0
    return `<div key={i} className="${tall ? "row-span-2" : ""} rounded-xl bg-muted overflow-hidden"><img src="${item.src || "https://via.placeholder.com/600x600"}" alt="${esc(item.alt || item.text || "")}" className="object-cover w-full h-full hover:scale-105 transition-transform" loading="lazy" /></div>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 columns-2 sm:columns-3 lg:columns-4 gap-4 space-y-4">\n${indent(imgs, 1)}\n</div>`)
}

// Process variants
function buildProcessSteps(plan: SectionBlockPlan): string {
  const steps = plan.items.map((item, i) => `<div key={i} className="flex items-start gap-4">
  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 font-bold text-sm text-primary">${i + 1}</div>
  <div>
    ${item.eyebrow ? `<Badge variant="secondary" className="mb-2">${esc(item.eyebrow)}</Badge>` : ""}
    <h3 className="font-semibold text-lg">${esc(item.heading || item.text || "")}</h3>
    <p className="text-sm text-muted-foreground mt-1">${esc(item.description || "")}</p>
  </div>
</div>`).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-8">\n${indent(steps, 1)}\n</div>`)
}

function buildProcessTimeline(plan: SectionBlockPlan): string {
  const steps = plan.items.map((item, i) => `<div key={i} className="relative pl-8 pb-12 last:pb-0">
  <div className="absolute left-0 top-1 h-4 w-4 rounded-full bg-primary" />
  ${i < plan.items.length - 1 ? `<div className="absolute left-[7px] top-4 bottom-0 w-0.5 bg-border" />` : ""}
  ${item.eyebrow ? `<Badge variant="secondary" className="mb-2">${esc(item.eyebrow)}</Badge>` : ""}
  <h3 className="font-semibold text-lg">${esc(item.heading || item.text || "")}</h3>
  <p className="text-sm text-muted-foreground mt-1">${esc(item.description || "")}</p>
</div>`).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 max-w-2xl mx-auto">\n${indent(steps, 1)}\n</div>`)
}

// Team grid
function buildTeamGrid(plan: SectionBlockPlan): string {
  const members = plan.items.map((item, i) => `<Card key={i}>
  <CardContent className="p-6 text-center">
    <Avatar className="h-20 w-20 mx-auto mb-4"><AvatarFallback className="text-xl">${esc(item.icon || item.initials || "U")}</AvatarFallback></Avatar>
    <h3 className="font-semibold">${esc(item.heading || item.text || "")}</h3>
    ${item.eyebrow ? `<p className="text-sm text-muted-foreground">${esc(item.eyebrow)}</p>` : ""}
    ${item.description ? `<p className="text-sm text-muted-foreground mt-2">${esc(item.description)}</p>` : ""}
  </CardContent>
</Card>`).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">\n${indent(members, 1)}\n</div>`)
}

// Blog cards
function buildBlogCards(plan: SectionBlockPlan): string {
  const cards = plan.items.map((item, i) => `<Card key={i} className="group hover:shadow-lg transition-shadow overflow-hidden">
  <div className="aspect-[16/9] bg-muted overflow-hidden">
    <img src="${item.src || "https://via.placeholder.com/800x450"}" alt="" className="object-cover w-full h-full group-hover:scale-105 transition-transform" loading="lazy" />
  </div>
  <CardHeader>
    ${item.eyebrow ? `<Badge variant="secondary" className="w-fit mb-2">${esc(item.eyebrow)}</Badge>` : ""}
    <CardTitle className="group-hover:text-primary transition-colors">${esc(item.heading || item.text || "")}</CardTitle>
    <CardDescription>${esc(item.description || "")}</CardDescription>
  </CardHeader>
  <CardFooter className="flex items-center gap-3">
    <Avatar className="h-8 w-8"><AvatarFallback>${esc(item.icon || item.initials || "U")}</AvatarFallback></Avatar>
    <div className="text-sm text-muted-foreground">${esc(item.eyebrow || item.label || "")}</div>
  </CardFooter>
</Card>`).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">\n${indent(cards, 1)}\n</div>`)
}

// Comparison table
function buildComparisonTable(plan: SectionBlockPlan): string {
  const headers = plan.items.slice(0, 1).flatMap((item) => item.children || []).map((col) => `<th className="p-4 text-left font-semibold">${esc(col.text || col.heading || "")}</th>`).join("\n")
  const rows = plan.items.map((item, i) => {
    const cells = item.children?.map((cell) => `<td className="p-4 text-center">${cell.highlighted ? `<span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/10 text-primary"><Check className="h-3 w-3" /></span>` : esc(cell.text || "")}</td>`).join("\n") ?? ""
    return `<tr key={i} className="border-t">\n  <td className="p-4 font-medium">${esc(item.heading || item.text || "")}</td>\n${indent(cells, 1)}\n</tr>`
  }).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 overflow-x-auto rounded-xl border">\n  <table className="w-full">\n    <thead><tr className="bg-muted/50">\n<th className="p-4 text-left font-semibold">Feature</th>\n${indent(headers, 3)}\n    </tr></thead>\n    <tbody>\n${indent(rows, 3)}\n    </tbody>\n  </table>\n</div>`)
}

// Product grid
function buildProductGrid(plan: SectionBlockPlan): string {
  const products = plan.items.map((item, i) => `<Card key={i} className="group overflow-hidden">
  <div className="aspect-square bg-muted overflow-hidden">
    <img src="${item.src || "https://via.placeholder.com/600x600"}" alt="${esc(item.alt || item.heading || "")}" className="object-cover w-full h-full group-hover:scale-105 transition-transform" loading="lazy" />
  </div>
  <CardContent className="p-4">
    ${item.eyebrow ? `<Badge variant="secondary" className="mb-2">${esc(item.eyebrow)}</Badge>` : ""}
    <h3 className="font-medium truncate">${esc(item.heading || item.text || "")}</h3>
    <p className="text-sm text-muted-foreground mt-1">${esc(item.value || item.price || "")}</p>
  </CardContent>
  <CardFooter className="px-4 pb-4 pt-0">
    <Button variant="outline" size="sm" className="w-full">${esc(item.cta?.label || "View")}</Button>
  </CardFooter>
</Card>`).join("\n")
  return sectionWrapper(plan, `${sectionHeader(plan)}\n\n<div className="mt-12 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">\n${indent(products, 1)}\n</div>`)
}

function indent(text: string, level: number): string {
  if (!text) return ""
  const pad = "  ".repeat(level)
  return text.split("\n").map((line) => line ? pad + line : line).join("\n")
}

// Re-export for use by the orchestrator
export { renderBlock, sectionWrapper, sectionHeader, ctaButtons }
