// ── Step 9: JSON-to-Next.js Converter ───────────────────────────────
// Convert UiTreeEnvelope into full Next.js page files. No AI call.

import type {
  UiTreeEnvelope,
  ManifestPage,
  ProjectManifest,
  GeneratedFile,
  UiNode,
} from "./types"

const SHADCN_IMPORTS: Record<string, string> = {
  Button: `import { Button } from "@/components/ui/button"`,
  Card: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"`,
  CardHeader: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"`,
  CardTitle: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"`,
  CardDescription: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"`,
  CardContent: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"`,
  CardFooter: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"`,
  Badge: `import { Badge } from "@/components/ui/badge"`,
  Input: `import { Input } from "@/components/ui/input"`,
  Textarea: `import { Textarea } from "@/components/ui/textarea"`,
  Separator: `import { Separator } from "@/components/ui/separator"`,
  Accordion: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"`,
  AccordionItem: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"`,
  AccordionTrigger: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"`,
  AccordionContent: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"`,
  Tabs: `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"`,
  TabsList: `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"`,
  TabsTrigger: `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"`,
  TabsContent: `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"`,
}

const MOTION_IMPORTS: Record<string, string> = {
  FadeIn: `import { FadeIn } from "@/components/motion/fade-in"`,
  Stagger: `import { Stagger, StaggerItem } from "@/components/motion/stagger"`,
  StaggerItem: `import { Stagger, StaggerItem } from "@/components/motion/stagger"`,
  MotionCard: `import { MotionCard } from "@/components/motion/motion-card"`,
}

const ICON_MAP: Record<string, boolean> = {
  ArrowRight: true, Check: true, Star: true, Heart: true, ShoppingCart: true,
  Phone: true, Mail: true, MapPin: true, Clock: true, Search: true,
  ChevronRight: true, ChevronDown: true, Plus: true, Minus: true,
  X: true, Menu: true, User: true, Settings: true, Package: true,
  Truck: true, Shield: true, Zap: true, Award: true, Gift: true,
  Tag: true, Percent: true, RefreshCw: true, Smartphone: true,
  Monitor: true, Headphones: true, Camera: true, Wifi: true,
  Battery: true, Cpu: true, HardDrive: true,
}

const HTML_ELEMENTS = new Set([
  "main", "div", "section", "header", "footer", "nav", "aside", "article",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "ul", "ol", "li",
  "img", "figure", "figcaption", "blockquote", "pre", "code",
  "form", "label", "fieldset", "legend",
  "table", "thead", "tbody", "tfoot", "tr", "th", "td",
  "strong", "em", "br", "hr",
])

const SELF_CLOSING = new Set(["img", "br", "hr", "Input", "Separator"])

interface ConvertResult {
  file: GeneratedFile
  usedComponents: string[]
  usedMotion: string[]
  usedHandlers: string[]
  usedIcons: string[]
  needsClient: boolean
  warnings: string[]
}

function nodeToJsx(node: UiNode, indent: number, manifest: ProjectManifest): string {
  const pad = "  ".repeat(indent)
  const { name, props, children, text } = node
  const tag = name

  // Build props string
  let propsStr = ""
  if (props) {
    for (const [key, val] of Object.entries(props)) {
      if (val === undefined || val === null) continue
      if (typeof val === "string") {
        // Convert internal links
        if (key === "href" && typeof val === "string" && val.startsWith("/")) {
          propsStr += ` ${key}="${val}"`
        } else if (typeof val === "string" && val.startsWith("$handler.")) {
          const handlerName = val.replace("$handler.", "")
          propsStr += ` ${key}={${handlerName}}`
        } else if (typeof val === "string" && val.startsWith("$state.")) {
          const stateName = val.replace("$state.", "")
          propsStr += ` ${key}={${stateName}}`
        } else {
          propsStr += ` ${key}="${val.replace(/"/g, "&quot;")}"`
        }
      } else if (typeof val === "boolean") {
        propsStr += val ? ` ${key}` : ""
      } else if (typeof val === "number") {
        propsStr += ` ${key}={${val}}`
      } else {
        propsStr += ` ${key}={${JSON.stringify(val)}}`
      }
    }
  }

  // Handle Link wrapping for <a> tags with internal hrefs
  const isInternalLink = name === "a" && props?.href && typeof props.href === "string" && (props.href as string).startsWith("/")

  if (isInternalLink) {
    const href = props!.href as string
    const otherProps = { ...props }
    delete otherProps.href
    let linkProps = ""
    for (const [key, val] of Object.entries(otherProps)) {
      if (typeof val === "string") linkProps += ` ${key}="${val}"`
    }

    if (!children?.length && !text) {
      return `${pad}<Link href="${href}"${linkProps} />`
    }

    const inner = []
    if (text) inner.push(`${pad}  ${text}`)
    if (children) {
      for (const child of children) {
        inner.push(nodeToJsx(child, indent + 1, manifest))
      }
    }
    return `${pad}<Link href="${href}"${linkProps}>\n${inner.join("\n")}\n${pad}</Link>`
  }

  // Self-closing elements
  if (SELF_CLOSING.has(name) && !children?.length && !text) {
    return `${pad}<${tag}${propsStr} />`
  }

  // No children or text
  if (!children?.length && !text) {
    return `${pad}<${tag}${propsStr} />`
  }

  // Text-only
  if (text && !children?.length) {
    return `${pad}<${tag}${propsStr}>${text}</${tag}>`
  }

  // With children
  const inner: string[] = []
  if (text) inner.push(`${pad}  ${text}`)
  if (children) {
    for (const child of children) {
      inner.push(nodeToJsx(child, indent + 1, manifest))
    }
  }
  return `${pad}<${tag}${propsStr}>\n${inner.join("\n")}\n${pad}</${tag}>`
}

function collectUsed(node: UiNode, components: Set<string>, motions: Set<string>, icons: Set<string>, handlers: Set<string>) {
  if (SHADCN_IMPORTS[node.name]) components.add(node.name)
  if (MOTION_IMPORTS[node.name]) motions.add(node.name)
  if (ICON_MAP[node.name]) icons.add(node.name)

  if (node.props) {
    for (const val of Object.values(node.props)) {
      if (typeof val === "string" && val.startsWith("$handler.")) {
        handlers.add(val.replace("$handler.", ""))
      }
    }
  }

  if (node.children) {
    for (const child of node.children) {
      collectUsed(child, components, motions, icons, handlers)
    }
  }
}

export function convertJsonToNextPage(
  envelope: UiTreeEnvelope,
  page: ManifestPage,
  manifest: ProjectManifest,
): ConvertResult {
  const warnings: string[] = []
  const components = new Set<string>()
  const motions = new Set<string>()
  const icons = new Set<string>()
  const handlers = new Set<string>()

  collectUsed(envelope.component, components, motions, icons, handlers)

  const needsClient = motions.size > 0 || handlers.size > 0
  const hasLinks = JSON.stringify(envelope).includes('href":"/')

  // Build imports
  const imports: string[] = []
  if (needsClient) imports.push(`"use client"\n`)

  // Deduplicate shadcn imports
  const shadcnImportLines = new Set<string>()
  for (const c of components) {
    if (SHADCN_IMPORTS[c]) shadcnImportLines.add(SHADCN_IMPORTS[c])
  }

  // Motion imports
  const motionImportLines = new Set<string>()
  for (const m of motions) {
    if (MOTION_IMPORTS[m]) motionImportLines.add(MOTION_IMPORTS[m])
  }

  if (hasLinks) imports.push(`import Link from "next/link"`)
  for (const line of shadcnImportLines) imports.push(line)
  for (const line of motionImportLines) imports.push(line)

  if (icons.size > 0) {
    const iconList = [...icons].join(", ")
    imports.push(`import { ${iconList} } from "lucide-react"`)
  }

  // Generate JSX body
  const jsx = nodeToJsx(envelope.component, 2, manifest)

  // Build metadata export (only for server components)
  let metadataExport = ""
  if (!needsClient) {
    metadataExport = `
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: ${JSON.stringify(page.metadata.title)},
  description: ${JSON.stringify(page.metadata.description)},
}
`
  }

  // Assemble file
  const content = `${imports.join("\n")}
${metadataExport}
export default function ${page.componentName}() {
  return (
${jsx}
  )
}
`

  return {
    file: {
      path: page.filePath,
      content,
      kind: "page",
      status: "ok",
    },
    usedComponents: [...components],
    usedMotion: [...motions],
    usedHandlers: [...handlers],
    usedIcons: [...icons],
    needsClient,
    warnings,
  }
}
