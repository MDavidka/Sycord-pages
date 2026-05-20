export const COMPONENT_CATALOG_VERSION = "1"

export const COMPONENT_NAMES = [
  "Page",
  "Section",
  "Container",
  "Grid",
  "Stack",
  "Button",
  "Card",
  "CardHeader",
  "CardTitle",
  "CardDescription",
  "CardContent",
  "CardFooter",
  "Badge",
  "Accordion",
  "AccordionItem",
  "AccordionTrigger",
  "AccordionContent",
  "Tabs",
  "TabsList",
  "TabsTrigger",
  "TabsContent",
  "Input",
  "Textarea",
  "Label",
  "Avatar",
  "Separator",
  "Image",
  "Link",
  "Heading",
  "Text",
  "Stat",
  "PricingCard",
  "FeatureCard",
  "LineGraph",
] as const

export type ComponentName = (typeof COMPONENT_NAMES)[number]

export interface ComponentNode {
  id: string
  component: ComponentName
  props?: Record<string, unknown>
  text?: string
  children?: ComponentNode[]
}

export const ALLOWED_COMPONENTS = new Set<ComponentName>(COMPONENT_NAMES)

export interface ComponentImport {
  from: string
  named: string[]
}

export const COMPONENT_IMPORTS: Partial<Record<ComponentName, ComponentImport>> = {
  Button: { from: "@/components/ui/button", named: ["Button"] },
  Card: { from: "@/components/ui/card", named: ["Card"] },
  CardHeader: { from: "@/components/ui/card", named: ["CardHeader"] },
  CardTitle: { from: "@/components/ui/card", named: ["CardTitle"] },
  CardDescription: { from: "@/components/ui/card", named: ["CardDescription"] },
  CardContent: { from: "@/components/ui/card", named: ["CardContent"] },
  CardFooter: { from: "@/components/ui/card", named: ["CardFooter"] },
  Badge: { from: "@/components/ui/badge", named: ["Badge"] },
  Accordion: { from: "@/components/ui/accordion", named: ["Accordion"] },
  AccordionItem: { from: "@/components/ui/accordion", named: ["AccordionItem"] },
  AccordionTrigger: { from: "@/components/ui/accordion", named: ["AccordionTrigger"] },
  AccordionContent: { from: "@/components/ui/accordion", named: ["AccordionContent"] },
  Tabs: { from: "@/components/ui/tabs", named: ["Tabs"] },
  TabsList: { from: "@/components/ui/tabs", named: ["TabsList"] },
  TabsTrigger: { from: "@/components/ui/tabs", named: ["TabsTrigger"] },
  TabsContent: { from: "@/components/ui/tabs", named: ["TabsContent"] },
  Input: { from: "@/components/ui/input", named: ["Input"] },
  Textarea: { from: "@/components/ui/textarea", named: ["Textarea"] },
  Label: { from: "@/components/ui/label", named: ["Label"] },
  Avatar: { from: "@/components/ui/avatar", named: ["Avatar", "AvatarFallback", "AvatarImage"] },
  Separator: { from: "@/components/ui/separator", named: ["Separator"] },
  Image: { from: "next/image", named: ["default as Image"] },
  Link: { from: "next/link", named: ["default as Link"] },
  PricingCard: { from: "@/components/ui/card", named: ["Card", "CardContent", "CardFooter", "CardHeader", "CardTitle"] },
  FeatureCard: { from: "@/components/ui/card", named: ["Card", "CardContent", "CardHeader", "CardTitle", "CardDescription"] },
  LineGraph: { from: "@/components/ui/line-graph", named: ["LineGraph"] },
}

export interface ComponentCatalogEntry {
  name: ComponentName
  allowedProps: string[]
}

export const COMPONENT_CATALOG: Record<ComponentName, ComponentCatalogEntry> = {
  Page: { name: "Page", allowedProps: ["className", "class"] },
  Section: { name: "Section", allowedProps: ["className", "class", "id", "anchor"] },
  Container: { name: "Container", allowedProps: ["className", "class"] },
  Grid: { name: "Grid", allowedProps: ["className", "class", "columns"] },
  Stack: { name: "Stack", allowedProps: ["className", "class", "gap"] },
  Button: { name: "Button", allowedProps: ["className", "class", "variant", "size", "disabled", "label", "action"] },
  Card: { name: "Card", allowedProps: ["className", "class"] },
  CardHeader: { name: "CardHeader", allowedProps: ["className", "class"] },
  CardTitle: { name: "CardTitle", allowedProps: ["className", "class"] },
  CardDescription: { name: "CardDescription", allowedProps: ["className", "class"] },
  CardContent: { name: "CardContent", allowedProps: ["className", "class"] },
  CardFooter: { name: "CardFooter", allowedProps: ["className", "class"] },
  Badge: { name: "Badge", allowedProps: ["className", "class", "variant"] },
  Accordion: { name: "Accordion", allowedProps: ["className", "class", "type", "defaultValue", "collapsible"] },
  AccordionItem: { name: "AccordionItem", allowedProps: ["className", "class", "value"] },
  AccordionTrigger: { name: "AccordionTrigger", allowedProps: ["className", "class"] },
  AccordionContent: { name: "AccordionContent", allowedProps: ["className", "class"] },
  Tabs: { name: "Tabs", allowedProps: ["className", "class", "defaultValue", "value"] },
  TabsList: { name: "TabsList", allowedProps: ["className", "class"] },
  TabsTrigger: { name: "TabsTrigger", allowedProps: ["className", "class", "value"] },
  TabsContent: { name: "TabsContent", allowedProps: ["className", "class", "value"] },
  Input: { name: "Input", allowedProps: ["className", "class", "type", "placeholder", "value", "defaultValue", "disabled", "required"] },
  Textarea: { name: "Textarea", allowedProps: ["className", "class", "placeholder", "value", "defaultValue", "rows"] },
  Label: { name: "Label", allowedProps: ["className", "class", "htmlFor"] },
  Avatar: { name: "Avatar", allowedProps: ["className", "class", "src", "alt", "fallback"] },
  Separator: { name: "Separator", allowedProps: ["className", "class", "orientation"] },
  Image: { name: "Image", allowedProps: ["className", "class", "src", "alt", "width", "height"] },
  Link: { name: "Link", allowedProps: ["className", "class", "href", "target", "rel"] },
  Heading: { name: "Heading", allowedProps: ["className", "class", "level"] },
  Text: { name: "Text", allowedProps: ["className", "class"] },
  Stat: { name: "Stat", allowedProps: ["className", "class", "value", "suffix", "prefix"] },
  PricingCard: { name: "PricingCard", allowedProps: ["className", "class", "title", "cta"] },
  FeatureCard: { name: "FeatureCard", allowedProps: ["className", "class", "title", "description"] },
  LineGraph: { name: "LineGraph", allowedProps: ["className", "class", "data", "xKey", "yKey", "color"] },
}
