// ── Step 6: Component Context Selection ─────────────────────────────
// Select only the shadcn components relevant for a page. No AI call.

import type { ManifestPage } from "./types"

interface ComponentDef {
  name: string
  import: string
  usage: string
}

const COMPONENT_CATALOG: Record<string, ComponentDef> = {
  Button: {
    name: "Button",
    import: `import { Button } from "@/components/ui/button"`,
    usage: `<Button variant="default" size="default">Label</Button>\nVariants: default, destructive, outline, secondary, ghost, link\nSizes: default, sm, lg, icon\nUse asChild for Link wrapping: <Button asChild><Link href="/">Go</Link></Button>`,
  },
  Card: {
    name: "Card",
    import: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"`,
    usage: `<Card><CardHeader><CardTitle>Title</CardTitle><CardDescription>Desc</CardDescription></CardHeader><CardContent>...</CardContent><CardFooter>...</CardFooter></Card>`,
  },
  Badge: {
    name: "Badge",
    import: `import { Badge } from "@/components/ui/badge"`,
    usage: `<Badge variant="default">Text</Badge>\nVariants: default, secondary, destructive, outline`,
  },
  Input: {
    name: "Input",
    import: `import { Input } from "@/components/ui/input"`,
    usage: `<Input type="text" placeholder="Enter..." />`,
  },
  Textarea: {
    name: "Textarea",
    import: `import { Textarea } from "@/components/ui/textarea"`,
    usage: `<Textarea placeholder="Your message..." />`,
  },
  Separator: {
    name: "Separator",
    import: `import { Separator } from "@/components/ui/separator"`,
    usage: `<Separator /> or <Separator orientation="vertical" />`,
  },
  Accordion: {
    name: "Accordion",
    import: `import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"`,
    usage: `<Accordion type="single" collapsible><AccordionItem value="item-1"><AccordionTrigger>Question?</AccordionTrigger><AccordionContent>Answer.</AccordionContent></AccordionItem></Accordion>`,
  },
  Tabs: {
    name: "Tabs",
    import: `import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"`,
    usage: `<Tabs defaultValue="tab1"><TabsList><TabsTrigger value="tab1">Tab 1</TabsTrigger></TabsList><TabsContent value="tab1">...</TabsContent></Tabs>`,
  },
  Avatar: {
    name: "Avatar",
    import: `import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"`,
    usage: `<Avatar><AvatarImage src="..." alt="..." /><AvatarFallback>AB</AvatarFallback></Avatar>`,
  },
  Select: {
    name: "Select",
    import: `import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"`,
    usage: `<Select><SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger><SelectContent><SelectItem value="a">Option A</SelectItem></SelectContent></Select>`,
  },
  Table: {
    name: "Table",
    import: `import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table"`,
    usage: `<Table><TableHeader><TableRow><TableHead>Col</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Val</TableCell></TableRow></TableBody></Table>`,
  },
}

const PAGE_ROLE_COMPONENTS: Record<string, string[]> = {
  landing: ["Button", "Card", "Badge", "Separator"],
  catalog: ["Card", "Badge", "Button", "Input", "Tabs"],
  promotions: ["Card", "Badge", "Button", "Separator"],
  form: ["Input", "Textarea", "Button", "Card"],
  transaction: ["Card", "Button", "Input", "Separator", "Badge"],
  support: ["Accordion", "Input", "Card", "Button"],
  informational: ["Card", "Button", "Badge", "Separator"],
  pricing: ["Card", "Badge", "Button", "Tabs", "Table", "Accordion"],
  "social-proof": ["Card", "Avatar", "Badge", "Button"],
  documentation: ["Card", "Tabs", "Accordion", "Badge"],
  portfolio: ["Card", "Badge", "Button", "Tabs"],
  "case-study": ["Card", "Badge", "Button", "Separator"],
  settings: ["Input", "Button", "Card", "Tabs", "Separator"],
  dashboard: ["Card", "Table", "Tabs", "Badge", "Button"],
  "data-table": ["Table", "Button", "Badge", "Input"],
  services: ["Card", "Button", "Badge", "Separator"],
  blog: ["Card", "Badge", "Button", "Separator"],
}

export interface ComponentContext {
  components: ComponentDef[]
  contextString: string
}

export function selectComponentContextForPage(page: ManifestPage): ComponentContext {
  const roleComponents = PAGE_ROLE_COMPONENTS[page.pageRole] ?? PAGE_ROLE_COMPONENTS.informational
  const uniqueNames = [...new Set(roleComponents)]
  const components = uniqueNames
    .map(name => COMPONENT_CATALOG[name])
    .filter((c): c is ComponentDef => !!c)

  const contextString = components
    .map(c => `Component: ${c.name}\nImport: ${c.import}\nUsage: ${c.usage}`)
    .join("\n\n")

  return { components, contextString }
}
