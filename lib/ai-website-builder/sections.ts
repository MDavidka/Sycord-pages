// Deterministic section renderers. Each function takes a `SectionPlan` and
// returns polished TSX (string). The orchestrator stitches these together
// into the final `app/<route>/page.tsx`.
//
// Renderers must be:
//   - Pure (no I/O, no AI calls).
//   - Self-contained: emit valid JSX with imports declared at the top of the
//     page render call (the orchestrator collects imports from used sections).
//   - Variant-aware: each kind has 2+ layout variants so consecutive uses of
//     the same kind don't render identically.
//
// All copy comes from the SectionPlan itself; renderers never invent generic
// placeholder text. If a field is missing, a sensible default specific to the
// section is used (still better than "Lorem ipsum").

import type { ComponentNode, CtaPlan, SectionItem, SectionPlan } from "./types"
import { ALLOWED_COMPONENTS, COMPONENT_IMPORTS } from "@/lib/ai-ui-builder/catalog/components"

interface RenderContext {
  sectionIndex: number
  pagePath: string
}

export interface RenderedSection {
  tsx: string
  imports: { from: string; named: string[] }[]
  needsClient: boolean
  iconsUsed: string[]
}

// Escape a string for use inside a JSX text node OR a JSX string-prop.
// Tightens against rogue curly braces, backticks, and HTML reserved chars.
function esc(value: unknown): string {
  if (value === undefined || value === null) return ""
  return String(value)
    .replace(/[{}`]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .trim()
}

// Same as `esc` but preserves apostrophes/quotes so they read naturally.
function escMultiline(value: unknown): string {
  if (value === undefined || value === null) return ""
  return String(value).replace(/[{}`]/g, "").trim()
}

function jsxStr(value: unknown): string {
  return JSON.stringify(escMultiline(value))
}

function escapeJsonForJsx(value: unknown): string {
  try {
    const serialized = JSON.stringify(value, (_key, val) => (typeof val === "string" ? escMultiline(val) : val))
    if (!serialized) return "null"
    return serialized.replace(/</g, "\\u003c").replace(/>/g, "\\u003e")
  } catch {
    return "null"
  }
}

function ensureCta(c: CtaPlan | undefined, fallback: CtaPlan): CtaPlan {
  if (!c?.label) return fallback
  return { label: c.label, href: c.href || fallback.href }
}

function pickVariant(section: SectionPlan, allowed: string[], fallbackIdx: number): string {
  if (section.variant && allowed.includes(section.variant)) return section.variant
  return allowed[fallbackIdx % allowed.length]
}

function iconImport(name: string): string {
  // Best-effort lucide-react import name. Caller validates against a known
  // whitelist. If the requested icon is unknown, the orchestrator swaps to
  // `Sparkles` or skips icon rendering entirely.
  return name
}

// Whitelist of icons we allow in generated TSX. Keep this list ASCII-safe
// (it goes straight into an `import { ... } from "lucide-react"` statement).
const ICON_WHITELIST = new Set<string>([
  "Sparkles",
  "Rocket",
  "ShieldCheck",
  "Zap",
  "Star",
  "Heart",
  "Check",
  "ChevronRight",
  "ArrowRight",
  "ArrowUpRight",
  "Crown",
  "Compass",
  "Target",
  "Flame",
  "Layers",
  "LineChart",
  "BarChart3",
  "Wand2",
  "Brush",
  "Code2",
  "Palette",
  "Globe",
  "Map",
  "MapPin",
  "Mail",
  "Phone",
  "MessageCircle",
  "Users",
  "User",
  "Quote",
  "Calendar",
  "Clock",
  "Camera",
  "ShoppingBag",
  "ShoppingCart",
  "Package",
  "Truck",
  "Award",
  "BadgeCheck",
  "Smile",
  "Smartphone",
  "Tablet",
  "Laptop",
  "Cloud",
  "Lock",
  "Search",
  "Settings",
  "Sun",
  "Moon",
  "PenTool",
  "Hammer",
  "Building2",
  "Briefcase",
  "PieChart",
  "Lightbulb",
  "Music",
  "Video",
  "Mic",
  "Coffee",
  "Utensils",
  "ChefHat",
  "Wine",
  "Leaf",
  "Trees",
  "Waves",
  "Anchor",
  "Sprout",
])

function safeIcon(name: string | undefined, fallback = "Sparkles"): string {
  if (!name) return fallback
  // Normalize "shield-check" -> "ShieldCheck"
  const camel = name
    .replace(/(?:^|[-_\s])([a-z])/g, (_, c) => c.toUpperCase())
    .replace(/[^A-Za-z0-9]/g, "")
  return ICON_WHITELIST.has(camel) ? camel : fallback
}

function ctaButton(c: CtaPlan, variant: "default" | "outline" | "secondary" = "default"): string {
  const label = esc(c.label)
  const href = esc(c.href || "#")
  if (variant === "default") {
    return `<Button asChild size="lg"><Link href="${href}">${label}</Link></Button>`
  }
  return `<Button asChild size="lg" variant="${variant}"><Link href="${href}">${label}</Link></Button>`
}

function ctaButtons(section: SectionPlan, fallbackPrimary: CtaPlan): string {
  const primary = ensureCta(section.primaryCta, fallbackPrimary)
  const secondary = section.secondaryCta
  return `<div class_="flex flex-col gap-3 sm:flex-row sm:items-center">
        ${ctaButton(primary, "default")}
        ${secondary?.label ? ctaButton(secondary, "outline") : ""}
      </div>`.replace(/class_=/g, "className=")
}

function sectionWrapperOpen(anchor: string | undefined, extra = ""): string {
  const id = anchor ? ` id="${esc(anchor)}"` : ""
  return `<section${id} className="relative w-full ${extra}">`
}

function emptyImport(): RenderedSection["imports"] {
  return []
}


export function isAllowedComponentNode(component: string): component is ComponentNode["component"] {
  return ALLOWED_COMPONENTS.has(component as ComponentNode["component"])
}

function cleanClass(value: unknown): string {
  if (typeof value !== "string") return ""
  return value.replace(/[{}<>`]/g, "").slice(0, 500).trim()
}

function propString(props: Record<string, unknown> | undefined, allow: ReadonlySet<string>): string {
  if (!props) return ""
  const out: string[] = []
  for (const [key, value] of Object.entries(props)) {
    if (!allow.has(key)) continue
    if (typeof value === "string") out.push(`${key}=${jsxStr(value)}`)
    else if (typeof value === "number" && Number.isFinite(value)) out.push(`${key}={${value}}`)
    else if (typeof value === "boolean" && value) out.push(key)
    else if (typeof value === "object") out.push(`${key}={${escapeJsonForJsx(value)}}`)
  }
  return out.length ? ` ${out.join(" ")}` : ""
}

function classProp(props: Record<string, unknown> | undefined, fallback = ""): string {
  const cls = cleanClass(props?.className || props?.class)
  const value = cls || fallback
  return value ? ` className=${jsxStr(value)}` : ""
}

function nodeChildren(node: ComponentNode, ctx: RenderContext): string {
  const parts = [...(node.text ? [esc(node.text)] : []), ...(node.children ?? []).map((child) => renderComponentNode(child, ctx))]
  return parts.filter(Boolean).join("\n")
}

function hrefProp(props: Record<string, unknown> | undefined): string {
  const href = typeof props?.href === "string" && /^(\/|#|https?:\/\/|mailto:|tel:)/.test(props.href) ? props.href : "#"
  return ` href=${jsxStr(href)}`
}

export function componentNodeImports(node: ComponentNode): RenderedSection["imports"] {
  const imports: RenderedSection["imports"] = []
  const add = (imp: RenderedSection["imports"][number] | undefined) => {
    if (imp) imports.push(imp)
  }
  const walk = (current: ComponentNode) => {
    if (!isAllowedComponentNode(current.component)) {
      for (const child of current.children ?? []) walk(child)
      return
    }
    add(COMPONENT_IMPORTS[current.component])
    for (const child of current.children ?? []) walk(child)
  }
  walk(node)
  return imports
}

export function renderComponentNode(node: ComponentNode, ctx: RenderContext): string {
  const component = isAllowedComponentNode(node.component) ? node.component : "Container"
  const children = nodeChildren(node, ctx)
  const valueProps = propString(node.props, new Set(["value", "type", "placeholder", "alt", "src", "width", "height", "defaultValue"]))
  switch (component) {
    case "Page":
      return `<div${classProp(node.props, "space-y-0")}>${children}</div>`
    case "Section":
      return `<section${node.id ? ` id=${jsxStr(node.id)}` : ""}${classProp(node.props, "relative w-full py-20 md:py-24")}>${children}</section>`
    case "Container":
      return `<div${classProp(node.props, "mx-auto max-w-7xl px-4 sm:px-6 lg:px-8")}>${children}</div>`
    case "Grid":
      return `<div${classProp(node.props, "grid gap-6 md:grid-cols-2 lg:grid-cols-3")}>${children}</div>`
    case "Stack":
      return `<div${classProp(node.props, "flex flex-col gap-4")}>${children}</div>`
    case "Heading": {
      const level = typeof node.props?.level === "number" && node.props.level >= 1 && node.props.level <= 4 ? node.props.level : 2
      return `<h${level}${classProp(node.props, "text-balance text-3xl font-semibold tracking-tight sm:text-4xl")}>${children}</h${level}>`
    }
    case "Text":
      return `<p${classProp(node.props, "text-pretty text-muted-foreground")}>${children}</p>`
    case "Link":
      return `<Link${hrefProp(node.props)}${classProp(node.props)}>${children}</Link>`
    case "Button":
      return `<Button${propString(node.props, new Set(["variant", "size"]))}${classProp(node.props)}>${children}</Button>`
    case "Accordion":
      return `<Accordion${propString(node.props, new Set(["type", "defaultValue", "collapsible"]))}${classProp(node.props)}>${children}</Accordion>`
    case "AccordionItem":
      return `<AccordionItem${propString(node.props, new Set(["value"]))}${classProp(node.props)}>${children}</AccordionItem>`
    case "Tabs":
      return `<Tabs${propString(node.props, new Set(["defaultValue", "value"]))}${classProp(node.props)}>${children}</Tabs>`
    case "TabsTrigger":
    case "TabsContent":
      return `<${component}${propString(node.props, new Set(["value"]))}${classProp(node.props)}>${children}</${component}>`
    case "Image":
      return `<Image${valueProps}${classProp(node.props, "rounded-2xl object-cover")} />`
    case "Stat":
      return `<div${classProp(node.props, "rounded-2xl border bg-card p-6")}><div className="text-3xl font-semibold">${esc(node.props?.value ?? node.text)}</div>${children ? `<div className="text-sm text-muted-foreground">${children}</div>` : ""}</div>`
    case "PricingCard":
      return `<Card${classProp(node.props, "border-border/60")}><CardHeader><CardTitle>${esc(node.props?.title ?? node.text)}</CardTitle></CardHeader><CardContent>${children}</CardContent><CardFooter>${node.props?.cta ? `<Button>${esc(node.props.cta)}</Button>` : ""}</CardFooter></Card>`
    case "FeatureCard":
      return `<Card${classProp(node.props, "border-border/60")}><CardHeader><CardTitle>${esc(node.props?.title ?? node.text)}</CardTitle>${node.props?.description ? `<CardDescription>${esc(node.props.description)}</CardDescription>` : ""}</CardHeader><CardContent>${children}</CardContent></Card>`
    case "Avatar":
      return `<Avatar${classProp(node.props)}>${node.props?.src ? `<AvatarImage src=${jsxStr(node.props.src)} alt=${jsxStr(node.props.alt ?? "")} />` : ""}<AvatarFallback>${esc(node.text || node.props?.fallback || "SY")}</AvatarFallback></Avatar>`
    case "Separator":
      return `<Separator${classProp(node.props)} />`
    default:
      return `<${component}${valueProps}${classProp(node.props)}>${children}</${component}>`
  }
}

// ---------- HERO ----------

function renderHero(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(
    section,
    ["split", "centered", "gradient-card", "saas-dashboard", "ecommerce", "editorial", "cinematic", "magazine-cover"],
    ctx.sectionIndex,
  )
  const eyebrow = esc(section.eyebrow || "")
  const heading = esc(section.heading || "Ship something people remember.")
  const description = esc(section.description || "")
  const fallbackPrimary: CtaPlan = { label: "Get started", href: "#" }
  const buttons = ctaButtons(section, fallbackPrimary)
  const highlights = (section.highlights ?? []).slice(0, 4).map((h) => esc(h))
  const items = section.items ?? []

  const imports: RenderedSection["imports"] = [
    { from: "next/link", named: ["default as Link"] },
    { from: "@/components/ui/button", named: ["Button"] },
    { from: "@/components/ui/badge", named: ["Badge"] },
  ]
  const icons: string[] = []

  switch (variant) {
    case "split": {
      const itemList = items.length
        ? items.slice(0, 3)
        : highlights.map((h) => ({ title: h, description: "" }))
      const visualBlock = `<div className="relative rounded-3xl border bg-card p-6 shadow-2xl shadow-primary/10">
            <div className="absolute inset-0 -z-10 rounded-3xl bg-gradient-to-br from-primary/30 via-accent/30 to-transparent blur-2xl" aria-hidden="true" />
            <div className="aspect-[4/3] w-full rounded-2xl bg-gradient-to-br from-primary/15 via-accent/10 to-card flex items-end p-6">
              <div className="space-y-2">
                <span className="inline-flex items-center rounded-full bg-background/80 backdrop-blur px-3 py-1 text-xs font-medium text-foreground border">${esc(items[0]?.eyebrow || items[0]?.label || section.eyebrow || "Live preview")}</span>
                <p className="text-sm text-muted-foreground">${esc(items[0]?.description || section.description || "")}</p>
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              ${(items.slice(0, 3).length ? items.slice(0, 3) : [{ title: "10x", description: "Faster" }, { title: "99.9%", description: "Uptime" }, { title: "4.9/5", description: "Rating" }])
                .map(
                  (it) => `<div className="rounded-xl border bg-background/60 p-3">
                <p className="text-xl font-semibold tracking-tight">${esc(it.title || it.label || "")}</p>
                <p className="text-xs text-muted-foreground">${esc(it.description || "")}</p>
              </div>`,
                )
                .join("\n              ")}
            </div>
          </div>`
      return {
        tsx: `${sectionWrapperOpen(section.anchor, "overflow-hidden")}
      <div className="absolute inset-x-0 top-0 -z-10 h-72 bg-gradient-to-b from-primary/10 to-transparent" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-2 lg:px-8">
        <div className="space-y-6">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">${heading}</h1>
          ${description ? `<p className="max-w-xl text-pretty text-lg text-muted-foreground">${description}</p>` : ""}
          ${buttons}
          ${highlights.length ? `<ul className="grid gap-2 pt-2 sm:grid-cols-2">${highlights.map((h) => `<li className="flex items-center gap-2 text-sm text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />${h}</li>`).join("")}</ul>` : ""}
          ${itemList.length ? "" : ""}
        </div>
        ${visualBlock}
      </div>
    </section>`,
        imports,
        needsClient: false,
        iconsUsed: icons,
      }
    }

    case "centered": {
      return {
        tsx: `${sectionWrapperOpen(section.anchor, "overflow-hidden")}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.18),_transparent_60%)]" aria-hidden="true" />
      <div className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 md:py-32 lg:px-8">
        ${eyebrow ? `<Badge variant="secondary" className="mx-auto mb-5 rounded-full">${eyebrow}</Badge>` : ""}
        <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">${heading}</h1>
        ${description ? `<p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">${description}</p>` : ""}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          ${ctaButton(ensureCta(section.primaryCta, fallbackPrimary), "default")}
          ${section.secondaryCta?.label ? ctaButton(section.secondaryCta, "outline") : ""}
        </div>
        ${highlights.length ? `<ul className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">${highlights.map((h) => `<li className="flex items-center gap-2"><span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />${h}</li>`).join("")}</ul>` : ""}
      </div>
    </section>`,
        imports,
        needsClient: false,
        iconsUsed: icons,
      }
    }

    case "gradient-card": {
      return {
        tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-primary/15 via-accent/10 to-background p-8 sm:p-14">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-primary/20 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-2xl space-y-5">
            ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
            <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">${heading}</h1>
            ${description ? `<p className="text-pretty text-lg text-muted-foreground">${description}</p>` : ""}
            ${buttons}
          </div>
        </div>
      </div>
    </section>`,
        imports,
        needsClient: false,
        iconsUsed: icons,
      }
    }


    case "cinematic": {
      const proof = items[0] || { title: "4.9/5", description: "guest-rated experience" }
      return {
        tsx: `${sectionWrapperOpen(section.anchor, "overflow-hidden bg-foreground text-background")}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_10%,_hsl(var(--primary)/0.45),_transparent_34%),linear-gradient(135deg,_hsl(var(--foreground)),_hsl(var(--foreground)/0.86))]" aria-hidden="true" />
      <div className="mx-auto grid min-h-[720px] max-w-7xl items-end gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
        <div className="space-y-8 pb-8">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full bg-background/10 text-background backdrop-blur">${eyebrow}</Badge>` : ""}
          <h1 className="max-w-5xl text-balance text-5xl font-semibold tracking-[-0.06em] sm:text-7xl lg:text-8xl">${heading}</h1>
          ${description ? `<p className="max-w-2xl text-pretty text-lg text-background/70 sm:text-xl">${description}</p>` : ""}
          <div className="flex flex-wrap gap-3">${ctaButton(ensureCta(section.primaryCta, fallbackPrimary), "secondary")}${section.secondaryCta?.label ? ctaButton(section.secondaryCta, "outline") : ""}</div>
        </div>
        <div className="relative mb-4 rounded-[2rem] border border-background/15 bg-background/10 p-5 backdrop-blur-xl">
          <div className="aspect-[4/5] rounded-[1.4rem] bg-[linear-gradient(140deg,_hsl(var(--background)/0.16),_transparent),radial-gradient(circle_at_70%_20%,_hsl(var(--primary)/0.55),_transparent_32%)]" />
          <div className="absolute -left-5 bottom-10 max-w-[15rem] rounded-2xl border border-background/15 bg-background/90 p-4 text-foreground shadow-2xl">
            <p className="text-2xl font-semibold tracking-tight">${esc(proof.title || proof.value || "Proof")}</p>
            <p className="mt-1 text-sm text-muted-foreground">${esc(proof.description || proof.label || "Trusted by people who notice the details.")}</p>
          </div>
        </div>
      </div>
    </section>`,
        imports,
        needsClient: false,
        iconsUsed: icons,
      }
    }

    case "magazine-cover": {
      const kicker = highlights[0] || esc(section.subheading || "A more memorable first impression")
      return {
        tsx: `${sectionWrapperOpen(section.anchor, "overflow-hidden")}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:py-28 lg:grid-cols-12 lg:px-8">
        <div className="lg:col-span-8">
          ${eyebrow ? `<p className="mb-5 text-xs font-semibold uppercase tracking-[0.35em] text-primary">${eyebrow}</p>` : ""}
          <h1 className="text-balance text-6xl font-semibold tracking-[-0.075em] sm:text-7xl lg:text-8xl">${heading}</h1>
        </div>
        <div className="flex flex-col justify-between gap-8 border-l pl-6 lg:col-span-4">
          <p className="text-sm font-medium uppercase tracking-[0.28em] text-muted-foreground">${kicker}</p>
          ${description ? `<p className="text-pretty text-lg text-muted-foreground">${description}</p>` : ""}
          ${buttons}
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl gap-4 px-4 pb-16 sm:px-6 lg:grid-cols-3 lg:px-8">
        ${(items.slice(0, 3).length ? items.slice(0, 3) : [{ title: "01", description: "Distinct point of view" }, { title: "02", description: "Clear proof" }, { title: "03", description: "Easy next step" }]).map((item) => `<div className="rounded-3xl border bg-card/60 p-5"><p className="text-sm font-semibold text-primary">${esc(item.title || item.value || "Feature")}</p><p className="mt-2 text-sm text-muted-foreground">${esc(item.description || item.label || "")}</p></div>`).join("\n        ")}
      </div>
    </section>`,
        imports,
        needsClient: false,
        iconsUsed: icons,
      }
    }

    case "saas-dashboard": {
      const stats = items.length
        ? items.slice(0, 3)
        : [
            { title: "+38%", description: "MRR growth" },
            { title: "12k", description: "Active teams" },
            { title: "<200ms", description: "Avg response" },
          ]
      return {
        tsx: `${sectionWrapperOpen(section.anchor, "overflow-hidden")}
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] bg-[linear-gradient(180deg,_hsl(var(--primary)/0.08),_transparent)]" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-4 pt-20 pb-12 sm:px-6 md:pt-28 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-5">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">${heading}</h1>
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-lg text-muted-foreground">${description}</p>` : ""}
          <div className="flex flex-wrap items-center justify-center gap-3">
            ${ctaButton(ensureCta(section.primaryCta, fallbackPrimary), "default")}
            ${section.secondaryCta?.label ? ctaButton(section.secondaryCta, "outline") : ""}
          </div>
        </div>
        <div className="relative mx-auto mt-14 max-w-5xl">
          <div className="relative rounded-[1.5rem] border bg-card shadow-2xl shadow-primary/10">
            <div className="flex items-center gap-1.5 border-b px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              <span className="h-3 w-3 rounded-full bg-muted-foreground/30" />
              <span className="ml-3 text-xs text-muted-foreground">${esc(section.eyebrow || "dashboard.preview")}</span>
            </div>
            <div className="grid gap-4 p-6 sm:grid-cols-3">
              ${stats
                .map(
                  (s) => `<div className="rounded-xl border bg-background p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">${esc(s.description || s.label || "")}</p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">${esc(s.title || s.value || "")}</p>
              </div>`,
                )
                .join("\n              ")}
            </div>
            <div className="border-t px-6 py-4 text-xs text-muted-foreground">${esc(section.subheading || "Live, customizable, and ready in minutes.")}</div>
          </div>
        </div>
      </div>
    </section>`,
        imports,
        needsClient: false,
        iconsUsed: icons,
      }
    }

    case "ecommerce": {
      const featured = items[0] ?? { title: "Best seller", description: "Customer favorite this season." }
      return {
        tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
        <div className="space-y-6">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">${heading}</h1>
          ${description ? `<p className="max-w-xl text-pretty text-lg text-muted-foreground">${description}</p>` : ""}
          ${buttons}
          ${highlights.length ? `<ul className="grid gap-2 pt-2 sm:grid-cols-2">${highlights.map((h) => `<li className="flex items-center gap-2 text-sm text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />${h}</li>`).join("")}</ul>` : ""}
        </div>
        <div className="relative aspect-square w-full overflow-hidden rounded-3xl border bg-gradient-to-br from-accent/40 via-primary/10 to-background p-6">
          <div className="flex h-full flex-col justify-end gap-2 rounded-2xl bg-background/40 p-6 backdrop-blur">
            <span className="text-sm font-medium uppercase tracking-wider text-primary">${esc(featured.eyebrow || featured.label || "Featured")}</span>
            <p className="text-2xl font-semibold tracking-tight">${esc(featured.title || "")}</p>
            <p className="text-sm text-muted-foreground">${esc(featured.description || "")}</p>
            <p className="mt-2 text-3xl font-semibold">${esc(featured.price || "")}</p>
          </div>
        </div>
      </div>
    </section>`,
        imports,
        needsClient: false,
        iconsUsed: icons,
      }
    }

    case "editorial":
    default: {
      return {
        tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7 space-y-5">
            ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
            <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl">${heading}</h1>
          </div>
          <div className="lg:col-span-5 space-y-5">
            ${description ? `<p className="text-pretty text-lg text-muted-foreground">${description}</p>` : ""}
            ${buttons}
          </div>
        </div>
      </div>
    </section>`,
        imports,
        needsClient: false,
        iconsUsed: icons,
      }
    }
  }
}

// ---------- FEATURE GRID ----------

function renderFeatureGrid(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["cards", "bento", "icon-grid", "alternating", "asymmetric-bento", "proof-led"], ctx.sectionIndex)
  const heading = esc(section.heading || "Built for teams who care about the details")
  const eyebrow = esc(section.eyebrow || "")
  const description = esc(section.description || "")
  const inputItems = (section.items ?? []).slice(0, 8)
  // Use defaults if the AI didn't provide items, so renderer + imports stay
  // in sync with what actually gets rendered.
  const items = inputItems.length ? inputItems : defaultFeatureItems()

  const imports: RenderedSection["imports"] = [
    { from: "@/components/ui/card", named: ["Card", "CardContent", "CardHeader", "CardTitle", "CardDescription"] },
    { from: "@/components/ui/badge", named: ["Badge"] },
  ]
  const icons = items.map((it) => safeIcon(it.icon))
  imports.push({ from: "lucide-react", named: Array.from(new Set(icons)) })


  if (variant === "asymmetric-bento") {
    const tiles = items.length ? items : defaultFeatureItems()
    return {
      tsx: `${sectionWrapperOpen(section.anchor, "overflow-hidden")}
      <div className="absolute inset-x-0 top-1/4 -z-10 h-80 bg-[radial-gradient(circle,_hsl(var(--primary)/0.12),_transparent_65%)]" aria-hidden="true" />
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
        <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          <h2 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">${heading}</h2>
          ${description ? `<p className="text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          ${tiles.slice(0, 5).map((it, i) => {
            const Icon = safeIcon(it.icon)
            return `<div className="${i === 0 ? "sm:col-span-2" : ""} rounded-[1.75rem] border bg-card/70 p-6 shadow-sm">
            <div className="mb-8 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><${Icon} className="h-5 w-5" /></div>
            <h3 className="text-xl font-semibold tracking-tight">${esc(it.title || "")}</h3>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">${esc(it.description || "")}</p>
          </div>`
          }).join("\n          ")}
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: icons,
    }
  }

  if (variant === "proof-led") {
    const tiles = items.length ? items : defaultFeatureItems()
    const proof = tiles[0]
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[2rem] border bg-primary p-8 text-primary-foreground lg:p-10">
            ${eyebrow ? `<p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary-foreground/70">${eyebrow}</p>` : ""}
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">${heading}</h2>
            ${description ? `<p className="mt-5 text-pretty text-primary-foreground/75">${description}</p>` : ""}
            <div className="mt-10 rounded-2xl bg-primary-foreground/10 p-5">
              <p className="text-3xl font-semibold">${esc(proof?.value || proof?.title || "Proof")}</p>
              <p className="mt-1 text-sm text-primary-foreground/70">${esc(proof?.description || proof?.label || "Proof that the offer works in the real world.")}</p>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            ${tiles.slice(1, 5).map((it) => {
              const Icon = safeIcon(it.icon)
              return `<div className="rounded-3xl border bg-card p-6">
              <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><${Icon} className="h-5 w-5" /></div>
              <h3 className="font-semibold">${esc(it.title || "")}</h3>
              <p className="mt-2 text-sm text-muted-foreground">${esc(it.description || "")}</p>
            </div>`
            }).join("\n            ")}
          </div>
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: icons,
    }
  }

  if (variant === "bento") {
    const tiles = items.length ? items : defaultFeatureItems()
    const layout = ["lg:col-span-2", "lg:col-span-1", "lg:col-span-1", "lg:col-span-2"]
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          ${tiles
            .slice(0, 4)
            .map((it, i) => {
              const Icon = safeIcon(it.icon)
              return `<Card className="${layout[i % layout.length]} relative overflow-hidden border-border/60">
            <CardHeader>
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><${Icon} className="h-5 w-5" /></div>
              <CardTitle className="text-xl">${esc(it.title || "")}</CardTitle>
              <CardDescription className="text-base">${esc(it.description || "")}</CardDescription>
            </CardHeader>
            ${it.features?.length ? `<CardContent><ul className="space-y-2 text-sm text-muted-foreground">${it.features.slice(0, 4).map((f) => `<li className="flex items-center gap-2"><span className="inline-block h-1 w-1 rounded-full bg-primary" />${esc(f)}</li>`).join("")}</ul></CardContent>` : ""}
          </Card>`
            })
            .join("\n          ")}
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: icons,
    }
  }

  if (variant === "alternating") {
    const tiles = items.length ? items : defaultFeatureItems()
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-16 space-y-16 sm:space-y-24">
          ${tiles
            .slice(0, 4)
            .map((it, i) => {
              const Icon = safeIcon(it.icon)
              const reverse = i % 2 === 1
              return `<div className="grid items-center gap-10 lg:grid-cols-2">
            <div className="${reverse ? "lg:order-2" : ""} space-y-4">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><${Icon} className="h-5 w-5" /></div>
              <h3 className="text-balance text-2xl font-semibold tracking-tight sm:text-3xl">${esc(it.title || "")}</h3>
              <p className="text-pretty text-muted-foreground">${esc(it.description || "")}</p>
              ${it.features?.length ? `<ul className="space-y-2 text-sm">${it.features.slice(0, 4).map((f) => `<li className="flex items-center gap-2 text-muted-foreground"><span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />${esc(f)}</li>`).join("")}</ul>` : ""}
            </div>
            <div className="${reverse ? "lg:order-1" : ""} aspect-[4/3] rounded-2xl border bg-gradient-to-br from-accent/30 via-primary/10 to-background" aria-hidden="true"></div>
          </div>`
            })
            .join("\n          ")}
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: icons,
    }
  }

  if (variant === "icon-grid") {
    const tiles = items.length ? items : defaultFeatureItems()
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          ${tiles
            .slice(0, 6)
            .map((it) => {
              const Icon = safeIcon(it.icon)
              return `<div className="space-y-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><${Icon} className="h-5 w-5" /></div>
            <h3 className="text-lg font-semibold">${esc(it.title || "")}</h3>
            <p className="text-sm text-muted-foreground">${esc(it.description || "")}</p>
          </div>`
            })
            .join("\n          ")}
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: icons,
    }
  }

  // default: cards
  const tiles = items.length ? items : defaultFeatureItems()
  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          ${tiles
            .slice(0, 6)
            .map((it) => {
              const Icon = safeIcon(it.icon)
              return `<Card className="border-border/60 transition hover:border-primary/40 hover:shadow-lg">
            <CardHeader>
              <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary"><${Icon} className="h-5 w-5" /></div>
              <CardTitle>${esc(it.title || "")}</CardTitle>
              <CardDescription>${esc(it.description || "")}</CardDescription>
            </CardHeader>
            ${it.features?.length ? `<CardContent><ul className="space-y-2 text-sm text-muted-foreground">${it.features.slice(0, 4).map((f) => `<li className="flex items-center gap-2"><span className="inline-block h-1 w-1 rounded-full bg-primary" />${esc(f)}</li>`).join("")}</ul></CardContent>` : ""}
          </Card>`
            })
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: icons,
  }
}

function defaultFeatureItems(): SectionItem[] {
  return [
    { title: "Lightning quick", description: "Built on a fast static stack so pages load instantly across devices." },
    { title: "Refined design", description: "Polished components and rhythm tuned for editorial feel." },
    { title: "Genuinely useful", description: "Every interaction was crafted for clarity over novelty." },
  ]
}

// ---------- STATS ----------

function renderStats(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["row", "card-row", "split-callout"], ctx.sectionIndex)
  const heading = esc(section.heading || "")
  const description = esc(section.description || "")
  const items = (section.items ?? []).slice(0, 4)
  const tiles = items.length ? items : [
    { value: "12k+", label: "Happy customers" },
    { value: "4.9/5", label: "Average rating" },
    { value: "99.95%", label: "Uptime" },
    { value: "48h", label: "Average ship time" },
  ]

  if (variant === "split-callout") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-2 lg:px-8">
        <div className="space-y-4">
          ${section.eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${esc(section.eyebrow)}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <dl className="grid gap-6 sm:grid-cols-2">
          ${tiles
            .map(
              (it) => `<div className="rounded-2xl border bg-card p-6">
            <dt className="text-sm text-muted-foreground">${esc(it.label || it.description || "")}</dt>
            <dd className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">${esc(it.value || it.title || "")}${esc(it.suffix || "")}</dd>
          </div>`,
            )
            .join("\n          ")}
        </dl>
      </div>
    </section>`,
      imports: emptyImport(),
      needsClient: false,
      iconsUsed: [],
    }
  }

  if (variant === "card-row") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        ${heading ? `<h2 className="mx-auto max-w-3xl text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
        <dl className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          ${tiles
            .map(
              (it) => `<div className="rounded-2xl border bg-card p-6 text-center">
            <dd className="text-3xl font-semibold tracking-tight sm:text-4xl">${esc(it.value || it.title || "")}${esc(it.suffix || "")}</dd>
            <dt className="mt-2 text-sm text-muted-foreground">${esc(it.label || it.description || "")}</dt>
          </div>`,
            )
            .join("\n          ")}
        </dl>
      </div>
    </section>`,
      imports: emptyImport(),
      needsClient: false,
      iconsUsed: [],
    }
  }

  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-20 lg:px-8">
        ${heading ? `<h2 className="mx-auto max-w-3xl text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
        <dl className="mt-10 grid gap-y-8 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border">
          ${tiles
            .map(
              (it) => `<div className="px-2 text-center sm:px-6">
            <dd className="text-4xl font-semibold tracking-tight sm:text-5xl">${esc(it.value || it.title || "")}${esc(it.suffix || "")}</dd>
            <dt className="mt-2 text-sm text-muted-foreground">${esc(it.label || it.description || "")}</dt>
          </div>`,
            )
            .join("\n          ")}
        </dl>
      </div>
    </section>`,
    imports: emptyImport(),
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- TESTIMONIALS ----------

function renderTestimonials(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["grid-cards", "spotlight", "marquee-static"], ctx.sectionIndex)
  const heading = esc(section.heading || "Loved by people who care about quality")
  const description = esc(section.description || "")
  const eyebrow = esc(section.eyebrow || "")
  const items = (section.items ?? []).slice(0, 6)
  const quotes = items.length
    ? items
    : [
        { quote: "It feels like the team read our minds.", author: "Mira Cole", role: "Operations Lead", initials: "MC" },
        { quote: "Replaced three tools and the team is faster.", author: "Tomás Reyes", role: "Founder, Loomly", initials: "TR" },
        { quote: "The polish here sets a new bar for our industry.", author: "Indira Patel", role: "Head of Design", initials: "IP" },
      ]

  const imports: RenderedSection["imports"] = [
    { from: "@/components/ui/card", named: ["Card", "CardContent"] },
    { from: "@/components/ui/avatar", named: ["Avatar", "AvatarFallback"] },
    { from: "lucide-react", named: ["Quote"] },
  ]

  if (variant === "spotlight") {
    const main = quotes[0]
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 md:py-28 lg:px-8">
        ${eyebrow ? `<p className="mx-auto max-w-3xl text-center text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
        ${heading ? `<h2 className="mx-auto max-w-3xl text-balance text-center text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
        <figure className="mt-12 rounded-3xl border bg-card p-8 sm:p-12">
          <Quote className="h-10 w-10 text-primary/40" />
          <blockquote className="mt-6 text-pretty text-2xl font-medium leading-relaxed sm:text-3xl">"${esc(main.quote || "")}"</blockquote>
          <figcaption className="mt-8 flex items-center gap-4">
            <Avatar><AvatarFallback>${esc(main.initials || (main.author?.[0] || "U"))}</AvatarFallback></Avatar>
            <div>
              <p className="font-semibold">${esc(main.author || "")}</p>
              <p className="text-sm text-muted-foreground">${esc(main.role || "")}</p>
            </div>
          </figcaption>
        </figure>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: ["Quote"],
    }
  }

  // grid-cards (default) and marquee-static both render as grid
  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          ${quotes
            .slice(0, 6)
            .map(
              (q) => `<Card className="border-border/60">
            <CardContent className="p-6">
              <Quote className="h-6 w-6 text-primary/40" />
              <p className="mt-4 text-pretty text-base leading-relaxed">"${esc(q.quote || "")}"</p>
              <div className="mt-6 flex items-center gap-3">
                <Avatar className="h-9 w-9"><AvatarFallback>${esc(q.initials || (q.author?.[0] || "U"))}</AvatarFallback></Avatar>
                <div>
                  <p className="text-sm font-semibold">${esc(q.author || "")}</p>
                  <p className="text-xs text-muted-foreground">${esc(q.role || "")}</p>
                </div>
              </div>
            </CardContent>
          </Card>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: ["Quote"],
  }
}

// ---------- PRICING ----------

function renderPricing(section: SectionPlan, _ctx: RenderContext): RenderedSection {
  const heading = esc(section.heading || "Pricing built for every stage")
  const eyebrow = esc(section.eyebrow || "")
  const description = esc(section.description || "")
  const tiers = (section.items ?? []).slice(0, 3)

  const imports: RenderedSection["imports"] = [
    { from: "next/link", named: ["default as Link"] },
    { from: "@/components/ui/button", named: ["Button"] },
    { from: "@/components/ui/card", named: ["Card", "CardContent", "CardHeader", "CardTitle", "CardDescription"] },
    { from: "@/components/ui/badge", named: ["Badge"] },
    { from: "@/components/ui/separator", named: ["Separator"] },
    { from: "lucide-react", named: ["Check"] },
  ]

  const pricingTiers = tiers.length
    ? tiers
    : [
        {
          title: "Starter",
          description: "Perfect for solo builders shipping side projects.",
          price: "$0",
          period: "/month",
          features: ["1 site included", "Static deploys", "Community support"],
          cta: { label: "Get started", href: "#" },
        },
        {
          title: "Pro",
          description: "Ship serious work with team collaboration.",
          price: "$24",
          period: "/month",
          features: ["10 sites", "Custom domains", "Priority email", "Visual editor"],
          cta: { label: "Start Pro", href: "#" },
          highlighted: true,
        },
        {
          title: "Studio",
          description: "For agencies and product teams that move fast.",
          price: "$79",
          period: "/month",
          features: ["Unlimited sites", "Team SSO", "Dedicated support", "Audit log"],
          cta: { label: "Talk to sales", href: "#" },
        },
      ]

  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl text-center space-y-4">
          ${eyebrow ? `<Badge variant="secondary" className="rounded-full">${eyebrow}</Badge>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-6 lg:grid-cols-3">
          ${pricingTiers
            .map((t) => {
              const ringCls = t.highlighted ? "ring-2 ring-primary shadow-xl shadow-primary/10 scale-[1.02]" : ""
              const ctaVariant = t.highlighted ? "default" : "outline"
              const ctaLabel = esc(t.cta?.label || "Choose plan")
              const ctaHref = esc(t.cta?.href || "#")
              return `<Card className="relative ${ringCls}">
            ${t.highlighted ? `<div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge>Most popular</Badge></div>` : ""}
            <CardHeader>
              <CardTitle className="text-xl">${esc(t.title || "")}</CardTitle>
              <CardDescription>${esc(t.description || "")}</CardDescription>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">${esc(t.price || "")}</span>
                <span className="text-sm text-muted-foreground">${esc(t.period || "")}</span>
              </div>
            </CardHeader>
            <CardContent>
              <Separator className="mb-6" />
              <ul className="space-y-3 text-sm">
                ${(t.features ?? [])
                  .slice(0, 6)
                  .map(
                    (f) => `<li className="flex items-start gap-2"><Check className="mt-0.5 h-4 w-4 text-primary" />${esc(f)}</li>`,
                  )
                  .join("\n                ")}
              </ul>
              <Button asChild variant="${ctaVariant}" className="mt-6 w-full"><Link href="${ctaHref}">${ctaLabel}</Link></Button>
            </CardContent>
          </Card>`
            })
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: ["Check"],
  }
}

// ---------- FAQ ----------

function renderFaq(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["accordion", "two-column"], ctx.sectionIndex)
  const heading = esc(section.heading || "Frequently asked")
  const eyebrow = esc(section.eyebrow || "")
  const description = esc(section.description || "")
  const items = (section.items ?? []).slice(0, 8)
  const faqs = items.length
    ? items
    : [
        { title: "How does setup work?", description: "Connect your domain, pick a template, and ship in minutes." },
        { title: "Can I export my data?", description: "Yes, every plan includes a complete one-click export." },
        { title: "Do you offer support?", description: "Community support on every plan; priority on Pro and above." },
      ]

  if (variant === "two-column") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-3 lg:px-8">
        <div className="space-y-4">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <dl className="lg:col-span-2 divide-y rounded-2xl border bg-card">
          ${faqs
            .map(
              (q) => `<div className="px-6 py-5">
            <dt className="font-semibold">${esc(q.title || "")}</dt>
            <dd className="mt-2 text-sm text-muted-foreground">${esc(q.description || "")}</dd>
          </div>`,
            )
            .join("\n          ")}
        </dl>
      </div>
    </section>`,
      imports: emptyImport(),
      needsClient: false,
      iconsUsed: [],
    }
  }

  // accordion
  const imports: RenderedSection["imports"] = [
    { from: "@/components/ui/accordion", named: ["Accordion", "AccordionContent", "AccordionItem", "AccordionTrigger"] },
  ]
  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="text-center space-y-4">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <Accordion type="single" collapsible className="mt-12 w-full">
          ${faqs
            .map(
              (q, i) => `<AccordionItem value="item-${i}">
            <AccordionTrigger className="text-left text-base">${esc(q.title || "")}</AccordionTrigger>
            <AccordionContent className="text-muted-foreground">${esc(q.description || "")}</AccordionContent>
          </AccordionItem>`,
            )
            .join("\n          ")}
        </Accordion>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- CONTACT ----------

function renderContact(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["form", "split-form", "info-card"], ctx.sectionIndex)
  const heading = esc(section.heading || "Tell us about your project")
  const description = esc(section.description || "")
  const eyebrow = esc(section.eyebrow || "")
  const ctaLabel = esc(section.primaryCta?.label || "Send message")
  const items = section.items ?? []

  const imports: RenderedSection["imports"] = [
    { from: "@/components/ui/button", named: ["Button"] },
    { from: "@/components/ui/input", named: ["Input"] },
    { from: "@/components/ui/textarea", named: ["Textarea"] },
    { from: "@/components/ui/label", named: ["Label"] },
  ]

  const formMarkup = `<form className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" name="name" placeholder="Your full name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="subject">Subject</Label>
          <Input id="subject" name="subject" placeholder="What can we help with?" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="message">Message</Label>
          <Textarea id="message" name="message" placeholder="Tell us more..." rows={6} required />
        </div>
        <Button type="submit" size="lg" className="w-full sm:w-auto">${ctaLabel}</Button>
      </form>`

  if (variant === "split-form") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
        <div className="space-y-5">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="text-pretty text-muted-foreground">${description}</p>` : ""}
          ${items.length ? `<ul className="space-y-3 pt-4">${items.slice(0, 4).map((it) => `<li className="flex items-start gap-3"><span className="mt-0.5 inline-flex h-2 w-2 rounded-full bg-primary" /><div><p className="font-medium">${esc(it.title || it.label || "")}</p><p className="text-sm text-muted-foreground">${esc(it.description || it.value || "")}</p></div></li>`).join("")}</ul>` : ""}
        </div>
        <div className="rounded-2xl border bg-card p-6 sm:p-8">
          ${formMarkup}
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: [],
    }
  }

  if (variant === "info-card") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="rounded-3xl border bg-card p-8 sm:p-12">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div className="space-y-5">
              ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
              ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
              ${description ? `<p className="text-pretty text-muted-foreground">${description}</p>` : ""}
              <ul className="space-y-3 pt-2 text-sm">
                ${(items.length ? items : [{ title: "Email", description: "hello@example.com" }, { title: "Phone", description: "+1 (555) 010-1234" }]).map((it) => `<li><p className="font-medium">${esc(it.title || it.label || "")}</p><p className="text-muted-foreground">${esc(it.description || it.value || "")}</p></li>`).join("")}
              </ul>
            </div>
            <div>${formMarkup}</div>
          </div>
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: [],
    }
  }

  // form (default, centered)
  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="text-center space-y-4">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-10">${formMarkup}</div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- CTA ----------

function renderCta(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["banner", "split", "boxed-card"], ctx.sectionIndex)
  const heading = esc(section.heading || "Ready when you are")
  const description = esc(section.description || "Start now and feel the difference within minutes.")
  const fallback: CtaPlan = { label: "Get started", href: "#" }
  const primary = ensureCta(section.primaryCta, fallback)
  const secondary = section.secondaryCta

  const imports: RenderedSection["imports"] = [
    { from: "next/link", named: ["default as Link"] },
    { from: "@/components/ui/button", named: ["Button"] },
  ]

  if (variant === "boxed-card") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <div className="relative overflow-hidden rounded-[2rem] border bg-gradient-to-br from-primary to-primary/70 p-10 text-primary-foreground sm:p-16">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
          <div className="relative max-w-2xl space-y-5">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>
            <p className="text-pretty text-base text-primary-foreground/90">${description}</p>
            <div className="flex flex-wrap gap-3">
              <Button asChild size="lg" variant="secondary"><Link href="${esc(primary.href)}">${esc(primary.label)}</Link></Button>
              ${secondary?.label ? `<Button asChild size="lg" variant="outline" className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"><Link href="${esc(secondary.href)}">${esc(secondary.label)}</Link></Button>` : ""}
            </div>
          </div>
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: [],
    }
  }

  if (variant === "split") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-16 sm:px-6 md:py-20 lg:grid-cols-2 lg:px-8">
        <div className="space-y-3">
          <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>
          <p className="text-pretty text-muted-foreground">${description}</p>
        </div>
        <div className="flex flex-wrap gap-3 lg:justify-end">
          <Button asChild size="lg"><Link href="${esc(primary.href)}">${esc(primary.label)}</Link></Button>
          ${secondary?.label ? `<Button asChild size="lg" variant="outline"><Link href="${esc(secondary.href)}">${esc(secondary.label)}</Link></Button>` : ""}
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: [],
    }
  }

  // banner (default)
  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-5xl px-4 py-20 text-center sm:px-6 md:py-24 lg:px-8">
        <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground">${description}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg"><Link href="${esc(primary.href)}">${esc(primary.label)}</Link></Button>
          ${secondary?.label ? `<Button asChild size="lg" variant="outline"><Link href="${esc(secondary.href)}">${esc(secondary.label)}</Link></Button>` : ""}
        </div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- LOGOS ----------

function renderLogos(section: SectionPlan, _ctx: RenderContext): RenderedSection {
  const heading = esc(section.heading || "Trusted by teams everywhere")
  const items = (section.items ?? []).slice(0, 8)
  const labels = items.length ? items : [
    { label: "Acme Co" }, { label: "Globex" }, { label: "Initech" },
    { label: "Hooli" }, { label: "Stark" }, { label: "Wayne" },
  ]
  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <p className="text-center text-sm font-medium uppercase tracking-wider text-muted-foreground">${heading}</p>
        <div className="mt-8 grid grid-cols-2 items-center justify-items-center gap-x-8 gap-y-6 sm:grid-cols-3 lg:grid-cols-6">
          ${labels
            .map(
              (l) => `<div className="text-base font-semibold tracking-tight text-muted-foreground/70 transition hover:text-foreground">${esc(l.label || l.title || "")}</div>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports: emptyImport(),
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- GALLERY ----------

function renderGallery(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["grid", "masonry", "spotlight"], ctx.sectionIndex)
  const heading = esc(section.heading || "Selected work")
  const description = esc(section.description || "")
  const eyebrow = esc(section.eyebrow || "")
  const items = (section.items ?? []).slice(0, 9)
  const tiles = items.length ? items : [
    { title: "Case study 01", description: "Brand refresh and a website that converts." },
    { title: "Case study 02", description: "App launch with a growth-led narrative." },
    { title: "Case study 03", description: "Identity system for a global retailer." },
  ]

  if (variant === "spotlight") {
    const main = tiles[0]
    const rest = tiles.slice(1, 5)
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          <div className="group relative aspect-square overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/20 via-accent/20 to-background p-6 lg:col-span-2 lg:aspect-[16/10]">
            <div className="flex h-full flex-col justify-end gap-1">
              <span className="text-xs font-medium uppercase tracking-wider text-primary">${esc(main.category || main.tag || "Featured")}</span>
              <p className="text-2xl font-semibold tracking-tight">${esc(main.title || "")}</p>
              <p className="max-w-md text-sm text-muted-foreground">${esc(main.description || "")}</p>
            </div>
          </div>
          <div className="grid gap-4">
            ${rest
              .map(
                (it) => `<div className="aspect-[4/3] rounded-2xl border bg-gradient-to-br from-muted to-background p-4 text-sm">
              <span className="text-xs font-medium uppercase tracking-wider text-primary">${esc(it.category || it.tag || "")}</span>
              <p className="mt-2 font-semibold">${esc(it.title || "")}</p>
            </div>`,
              )
              .join("\n            ")}
          </div>
        </div>
      </div>
    </section>`,
      imports: emptyImport(),
      needsClient: false,
      iconsUsed: [],
    }
  }

  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          ${tiles
            .map(
              (it, i) => `<figure className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br ${
                ["from-primary/20 via-accent/20", "from-accent/20 via-muted", "from-muted via-primary/10", "from-background via-accent/30", "from-primary/10 to-muted"][i % 5]
              } to-background ${variant === "masonry" && i % 3 === 1 ? "row-span-2 aspect-[4/5]" : "aspect-[4/3]"}">
            <div className="flex h-full flex-col justify-end p-5">
              <figcaption>
                <span className="text-xs font-medium uppercase tracking-wider text-primary">${esc(it.category || it.tag || "")}</span>
                <p className="mt-2 font-semibold leading-tight">${esc(it.title || "")}</p>
                <p className="mt-1 text-sm text-muted-foreground">${esc(it.description || "")}</p>
              </figcaption>
            </div>
          </figure>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports: emptyImport(),
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- PRODUCT GRID ----------

function renderProductGrid(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["card-grid", "compact"], ctx.sectionIndex)
  const heading = esc(section.heading || "Shop the collection")
  const description = esc(section.description || "")
  const items = (section.items ?? []).slice(0, 8)
  const tiles = items.length ? items : [
    { title: "Maple velvet candle", description: "Warm vanilla, smoked maple, soft cedar.", price: "$32" },
    { title: "Ocean fig", description: "Bright fig, salt-spray, sea grass.", price: "$32" },
    { title: "Slow morning", description: "Espresso, cardamom, brown sugar.", price: "$32" },
    { title: "Library light", description: "Old paper, leather, cinnamon.", price: "$32" },
  ]

  const imports: RenderedSection["imports"] = [
    { from: "next/link", named: ["default as Link"] },
    { from: "@/components/ui/button", named: ["Button"] },
    { from: "@/components/ui/card", named: ["Card", "CardContent"] },
  ]

  if (variant === "compact") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
        ${description ? `<p className="mt-3 max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        <div className="mt-10 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          ${tiles
            .map(
              (it) => `<div className="space-y-3">
            <div className="aspect-square w-full overflow-hidden rounded-2xl border bg-gradient-to-br from-accent/30 via-primary/10 to-background"></div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">${esc(it.title || "")}</p>
                <p className="text-xs text-muted-foreground">${esc(it.category || it.tag || "")}</p>
              </div>
              <p className="font-semibold">${esc(it.price || "")}</p>
            </div>
          </div>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: [],
    }
  }

  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
            ${description ? `<p className="mt-2 max-w-xl text-pretty text-muted-foreground">${description}</p>` : ""}
          </div>
          ${section.primaryCta?.label ? `<Button asChild variant="ghost" className="hidden sm:inline-flex"><Link href="${esc(section.primaryCta.href)}">${esc(section.primaryCta.label)}</Link></Button>` : ""}
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          ${tiles
            .map(
              (it) => `<Card className="overflow-hidden">
            <div className="aspect-square w-full bg-gradient-to-br from-accent/30 via-primary/10 to-background"></div>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">${esc(it.title || "")}</p>
                <p className="font-semibold">${esc(it.price || "")}</p>
              </div>
              <p className="text-sm text-muted-foreground">${esc(it.description || "")}</p>
            </CardContent>
          </Card>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- COMPARISON ----------

function renderComparison(section: SectionPlan, _ctx: RenderContext): RenderedSection {
  const heading = esc(section.heading || "How we compare")
  const description = esc(section.description || "")
  const items = (section.items ?? []).slice(0, 6)
  const rows = items.length
    ? items
    : [
        { title: "Setup time", description: "5 minutes", value: "Hours of config", suffix: "Days" },
        { title: "Templates", description: "50+ ready", value: "Stock 5", suffix: "12" },
        { title: "Customization", description: "Pixel-precise", value: "Limited tokens", suffix: "Theme only" },
      ]

  const imports: RenderedSection["imports"] = [
    { from: "@/components/ui/badge", named: ["Badge"] },
    { from: "lucide-react", named: ["Check", "X"] },
  ]

  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-10 overflow-hidden rounded-2xl border bg-card">
          <div className="grid grid-cols-3 items-center gap-4 border-b bg-muted/40 px-4 py-3 text-sm font-medium sm:px-6">
            <span>Capability</span>
            <span className="text-center">Us <Badge variant="secondary" className="ml-2 align-middle">recommended</Badge></span>
            <span className="text-center text-muted-foreground">Others</span>
          </div>
          <ul className="divide-y text-sm">
            ${rows
              .map(
                (r) => `<li className="grid grid-cols-3 items-center gap-4 px-4 py-4 sm:px-6">
              <span className="font-medium">${esc(r.title || "")}</span>
              <span className="flex items-center justify-center gap-2 text-foreground"><Check className="h-4 w-4 text-primary" />${esc(r.description || r.value || "")}</span>
              <span className="flex items-center justify-center gap-2 text-muted-foreground"><X className="h-4 w-4" />${esc(r.suffix || "Limited")}</span>
            </li>`,
              )
              .join("\n            ")}
          </ul>
        </div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: ["Check", "X"],
  }
}

// ---------- PROCESS ----------

function renderProcess(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["steps", "timeline", "numbered-cards"], ctx.sectionIndex)
  const heading = esc(section.heading || "How it works")
  const description = esc(section.description || "")
  const eyebrow = esc(section.eyebrow || "")
  const items = (section.items ?? []).slice(0, 6)
  const steps = items.length
    ? items
    : [
        { title: "Tell us about your goal", description: "Share the what and why. We'll handle the how." },
        { title: "We design a plan", description: "A clear, opinionated direction with deliverables and timing." },
        { title: "Ship & refine", description: "We launch fast, then keep improving with real customer signal." },
      ]

  if (variant === "timeline") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <ol className="relative mt-12 space-y-10 border-l border-border pl-8">
          ${steps
            .map(
              (s, i) => `<li>
            <span className="absolute -left-[11px] mt-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">${i + 1}</span>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">${esc(s.eyebrow || `Step ${String(i + 1).padStart(2, "0")}`)}</p>
            <h3 className="mt-1 text-lg font-semibold">${esc(s.title || "")}</h3>
            <p className="mt-1 text-sm text-muted-foreground">${esc(s.description || "")}</p>
          </li>`,
            )
            .join("\n          ")}
        </ol>
      </div>
    </section>`,
      imports: emptyImport(),
      needsClient: false,
      iconsUsed: [],
    }
  }

  if (variant === "numbered-cards") {
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          ${steps
            .map(
              (s, i) => `<div className="rounded-2xl border bg-card p-6">
            <p className="text-5xl font-semibold tracking-tight text-primary/60">${String(i + 1).padStart(2, "0")}</p>
            <h3 className="mt-4 text-lg font-semibold">${esc(s.title || "")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">${esc(s.description || "")}</p>
          </div>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
      imports: emptyImport(),
      needsClient: false,
      iconsUsed: [],
    }
  }

  // steps (default)
  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
          ${steps
            .map(
              (s, i) => `<div className="space-y-3">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">${i + 1}</div>
            <h3 className="text-lg font-semibold">${esc(s.title || "")}</h3>
            <p className="text-sm text-muted-foreground">${esc(s.description || "")}</p>
          </div>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports: emptyImport(),
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- TEAM ----------

function renderTeam(section: SectionPlan, _ctx: RenderContext): RenderedSection {
  const heading = esc(section.heading || "Meet the team")
  const description = esc(section.description || "")
  const eyebrow = esc(section.eyebrow || "")
  const items = (section.items ?? []).slice(0, 8)
  const team = items.length ? items : [
    { title: "Avery Lin", role: "Founder & CEO", description: "10+ years building tools designers love." },
    { title: "Jordan Sato", role: "Head of Design", description: "Previously at Linear and Vercel." },
    { title: "Priya Anand", role: "Engineering", description: "Loves performance budgets and CSS." },
    { title: "Theo Mensah", role: "Customer Success", description: "Helps studios go from launch to scale." },
  ]

  const imports: RenderedSection["imports"] = [
    { from: "@/components/ui/avatar", named: ["Avatar", "AvatarFallback"] },
  ]

  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-3xl space-y-4 text-center">
          ${eyebrow ? `<p className="text-sm font-semibold uppercase tracking-wider text-primary">${eyebrow}</p>` : ""}
          ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
          ${description ? `<p className="mx-auto max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        </div>
        <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          ${team
            .map(
              (m) => `<div className="text-center">
            <Avatar className="mx-auto h-20 w-20"><AvatarFallback className="text-base">${esc(m.initials || (m.title?.split(" ").map((p) => p[0]).slice(0, 2).join("") || "U"))}</AvatarFallback></Avatar>
            <p className="mt-4 font-semibold">${esc(m.title || "")}</p>
            <p className="text-sm text-primary">${esc(m.role || m.subtitle || "")}</p>
            <p className="mt-1 text-sm text-muted-foreground">${esc(m.description || "")}</p>
          </div>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- BLOG PREVIEW ----------

function renderBlogPreview(section: SectionPlan, ctx: RenderContext): RenderedSection {
  const variant = pickVariant(section, ["card-grid", "feature-and-list"], ctx.sectionIndex)
  const heading = esc(section.heading || "From the blog")
  const description = esc(section.description || "")
  const items = (section.items ?? []).slice(0, 6)
  const posts = items.length ? items : [
    { title: "How we cut deploy time by 70%", description: "A practical look at the bottlenecks we removed.", date: "May 2025", category: "Engineering" },
    { title: "The case for opinionated design", description: "Why constraints lead to better software.", date: "Apr 2025", category: "Design" },
    { title: "What we learned from 1,000 launches", description: "Patterns that separate the great from the good.", date: "Mar 2025", category: "Stories" },
  ]

  const imports: RenderedSection["imports"] = [
    { from: "next/link", named: ["default as Link"] },
    { from: "@/components/ui/card", named: ["Card", "CardContent"] },
    { from: "lucide-react", named: ["ArrowUpRight"] },
  ]

  if (variant === "feature-and-list") {
    const feature = posts[0]
    const rest = posts.slice(1, 4)
    return {
      tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
        ${description ? `<p className="mt-3 max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        <div className="mt-10 grid gap-8 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="aspect-[16/10] w-full bg-gradient-to-br from-primary/20 via-accent/20 to-background"></div>
            <CardContent className="space-y-2 p-6">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">${esc(feature.category || feature.tag || "")} · ${esc(feature.date || "")}</p>
              <p className="text-xl font-semibold">${esc(feature.title || "")}</p>
              <p className="text-sm text-muted-foreground">${esc(feature.description || "")}</p>
            </CardContent>
          </Card>
          <ul className="divide-y rounded-2xl border bg-card">
            ${rest
              .map(
                (p) => `<li className="flex items-start justify-between gap-4 p-6">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-primary">${esc(p.category || p.tag || "")} · ${esc(p.date || "")}</p>
                <p className="font-semibold">${esc(p.title || "")}</p>
                <p className="text-sm text-muted-foreground">${esc(p.description || "")}</p>
              </div>
              <ArrowUpRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground" />
            </li>`,
              )
              .join("\n            ")}
          </ul>
        </div>
      </div>
    </section>`,
      imports,
      needsClient: false,
      iconsUsed: ["ArrowUpRight"],
    }
  }

  return {
    tsx: `${sectionWrapperOpen(section.anchor)}
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-24 lg:px-8">
        ${heading ? `<h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">${heading}</h2>` : ""}
        ${description ? `<p className="mt-3 max-w-2xl text-pretty text-muted-foreground">${description}</p>` : ""}
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          ${posts
            .map(
              (p) => `<Card className="overflow-hidden border-border/60">
            <div className="aspect-[16/10] w-full bg-gradient-to-br from-accent/30 via-primary/10 to-background"></div>
            <CardContent className="space-y-2 p-5">
              <p className="text-xs font-medium uppercase tracking-wider text-primary">${esc(p.category || p.tag || "")} · ${esc(p.date || "")}</p>
              <p className="text-lg font-semibold leading-snug">${esc(p.title || "")}</p>
              <p className="text-sm text-muted-foreground">${esc(p.description || "")}</p>
            </CardContent>
          </Card>`,
            )
            .join("\n          ")}
        </div>
      </div>
    </section>`,
    imports,
    needsClient: false,
    iconsUsed: [],
  }
}

// ---------- DISPATCHER ----------

export function renderSection(section: SectionPlan, ctx: RenderContext): RenderedSection {
  if (section.componentTree) {
    return {
      tsx: renderComponentNode(section.componentTree, ctx),
      imports: componentNodeImports(section.componentTree),
      needsClient: false,
      iconsUsed: [],
    }
  }
  switch (section.kind) {
    case "hero":
      return renderHero(section, ctx)
    case "feature-grid":
      return renderFeatureGrid(section, ctx)
    case "stats":
      return renderStats(section, ctx)
    case "testimonials":
      return renderTestimonials(section, ctx)
    case "pricing":
      return renderPricing(section, ctx)
    case "faq":
      return renderFaq(section, ctx)
    case "contact":
      return renderContact(section, ctx)
    case "cta":
      return renderCta(section, ctx)
    case "logos":
      return renderLogos(section, ctx)
    case "gallery":
      return renderGallery(section, ctx)
    case "product-grid":
      return renderProductGrid(section, ctx)
    case "comparison":
      return renderComparison(section, ctx)
    case "process":
      return renderProcess(section, ctx)
    case "team":
      return renderTeam(section, ctx)
    case "blog-preview":
      return renderBlogPreview(section, ctx)
    default:
      return renderCta({ ...section, kind: "cta" }, ctx)
  }
}

// Build the imports preamble for a page given the imports requested by each
// rendered section. Merges duplicates and prints them in a deterministic order.
export function buildImportsPreamble(allImports: RenderedSection["imports"][]): string {
  const merged = new Map<string, Set<string>>()
  for (const block of allImports) {
    for (const { from, named } of block) {
      if (!merged.has(from)) merged.set(from, new Set())
      const set = merged.get(from)!
      for (const n of named) set.add(n)
    }
  }
  const order = [
    "next/link",
    "next/image",
    "lucide-react",
    "@/components/ui/button",
    "@/components/ui/badge",
    "@/components/ui/card",
    "@/components/ui/separator",
    "@/components/ui/accordion",
    "@/components/ui/tabs",
    "@/components/ui/avatar",
    "@/components/ui/input",
    "@/components/ui/textarea",
    "@/components/ui/label",
    "@/components/ui/line-graph",
  ]
  const allKeys = Array.from(merged.keys())
  allKeys.sort((a, b) => {
    const ai = order.indexOf(a)
    const bi = order.indexOf(b)
    if (ai === -1 && bi === -1) return a.localeCompare(b)
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  const lines: string[] = []
  for (const from of allKeys) {
    const named = Array.from(merged.get(from)!).sort()
    const defaultMatch = named.find((n) => n.startsWith("default as "))
    const others = named.filter((n) => !n.startsWith("default as "))
    if (defaultMatch && others.length === 0) {
      lines.push(`import ${defaultMatch.replace("default as ", "")} from ${jsxStr(from)}`)
    } else if (defaultMatch) {
      lines.push(`import ${defaultMatch.replace("default as ", "")}, { ${others.join(", ")} } from ${jsxStr(from)}`)
    } else {
      lines.push(`import { ${named.join(", ")} } from ${jsxStr(from)}`)
    }
  }
  return lines.join("\n")
}
