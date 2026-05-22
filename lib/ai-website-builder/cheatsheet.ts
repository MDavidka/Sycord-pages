// Deterministic Component Cheatsheet — the single source of truth for every
// component the AI is allowed to use. The AI MUST NOT reference any component
// not registered here. The TSX compiler resolves imports and props from this
// registry exclusively.

export interface CheatsheetEntry {
  import: string | null
  props: string[]
  isClient?: boolean
  childrenType?: "text" | "nodes" | "none"
  description?: string
}

export const COMPONENT_CHEATSHEET: Record<string, CheatsheetEntry> = {
  // ── App Shell ──────────────────────────────────────────────────
  Page: {
    import: null,
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Root page wrapper — only at depth 0",
  },

  // ── Layout Primitives ──────────────────────────────────────────
  Section: {
    import: null,
    props: ["className", "children", "id"],
    childrenType: "nodes",
    description: "Semantic page section with full-width padding",
  },

  Container: {
    import: null,
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Max-width constraint container",
  },

  Grid: {
    import: null,
    props: ["className", "children"],
    childrenType: "nodes",
    description: "CSS Grid or responsive flex grid layout",
  },

  Stack: {
    import: null,
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Vertical flex column with configurable gap and alignment",
  },

  Flex: {
    import: null,
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Horizontal or vertical flex container",
  },

  Spacer: {
    import: null,
    props: ["className"],
    childrenType: "none",
    description: "Negative space / breathing room divider",
  },

  Divider: {
    import: null,
    props: ["className"],
    childrenType: "none",
    description: "Horizontal rule / thematic break",
  },

  // ── Typography ─────────────────────────────────────────────────
  Heading: {
    import: null,
    props: ["className", "children"],
    childrenType: "text",
    description: "H1-H6 heading with responsive sizing",
  },

  Text: {
    import: null,
    props: ["className", "children"],
    childrenType: "text",
    description: "Paragraph / body text with tone variants",
  },

  Label: {
    import: null,
    props: ["className", "children"],
    childrenType: "text",
    description: "Small label / caption text",
  },

  Eyebrow: {
    import: null,
    props: ["className", "children"],
    childrenType: "text",
    description: "Small uppercase eyebrow label above a heading",
  },

  // ── shadcn/ui Components ───────────────────────────────────────
  Button: {
    import: "@/components/ui/button",
    props: ["className", "children", "size", "variant"],
    childrenType: "text",
    description: "shadcn button — all 6 variants + 5 sizes",
  },

  Badge: {
    import: "@/components/ui/badge",
    props: ["className", "children", "variant"],
    childrenType: "text",
    description: "shadcn badge — status/brand pills",
  },

  Card: {
    import: "@/components/ui/card",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "shadcn card root wrapper",
  },

  CardHeader: {
    import: "@/components/ui/card",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Card header section",
  },

  CardTitle: {
    import: "@/components/ui/card",
    props: ["className", "children"],
    childrenType: "text",
    description: "Card title heading",
  },

  CardDescription: {
    import: "@/components/ui/card",
    props: ["className", "children"],
    childrenType: "text",
    description: "Card muted description text",
  },

  CardContent: {
    import: "@/components/ui/card",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Card body content area",
  },

  CardFooter: {
    import: "@/components/ui/card",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Card footer action area",
  },

  Accordion: {
    import: "@/components/ui/accordion",
    props: ["className", "children", "type", "collapsible"],
    childrenType: "nodes",
    description: "shadcn accordion root",
  },

  AccordionItem: {
    import: "@/components/ui/accordion",
    props: ["className", "children", "value"],
    childrenType: "nodes",
    description: "Accordion expandable item",
  },

  AccordionTrigger: {
    import: "@/components/ui/accordion",
    props: ["className", "children"],
    childrenType: "text",
    description: "Accordion item expand/collapse trigger",
  },

  AccordionContent: {
    import: "@/components/ui/accordion",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Accordion item collapsible content",
  },

  Tabs: {
    import: "@/components/ui/tabs",
    props: ["className", "children", "defaultValue"],
    childrenType: "nodes",
    description: "shadcn tabs root",
  },

  TabsList: {
    import: "@/components/ui/tabs",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Tab trigger button list",
  },

  TabsTrigger: {
    import: "@/components/ui/tabs",
    props: ["className", "children", "value"],
    childrenType: "text",
    description: "Individual tab trigger button",
  },

  TabsContent: {
    import: "@/components/ui/tabs",
    props: ["className", "children", "value"],
    childrenType: "nodes",
    description: "Tab content panel",
  },

  Input: {
    import: "@/components/ui/input",
    props: ["className", "type", "placeholder"],
    childrenType: "none",
    description: "shadcn text input",
  },

  Textarea: {
    import: "@/components/ui/textarea",
    props: ["className", "placeholder"],
    childrenType: "none",
    description: "shadcn textarea input",
  },

  Select: {
    import: "@/components/ui/select",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "shadcn select dropdown root",
  },

  SelectTrigger: {
    import: "@/components/ui/select",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Select trigger button",
  },

  SelectValue: {
    import: "@/components/ui/select",
    props: ["className", "placeholder"],
    childrenType: "text",
    description: "Selected value display",
  },

  SelectContent: {
    import: "@/components/ui/select",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Select dropdown content",
  },

  SelectItem: {
    import: "@/components/ui/select",
    props: ["className", "children", "value"],
    childrenType: "text",
    description: "Select option item",
  },

  Avatar: {
    import: "@/components/ui/avatar",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "shadcn avatar wrapper",
  },

  AvatarImage: {
    import: "@/components/ui/avatar",
    props: ["className", "src", "alt"],
    childrenType: "none",
    description: "Avatar image element",
  },

  AvatarFallback: {
    import: "@/components/ui/avatar",
    props: ["className", "children"],
    childrenType: "text",
    description: "Avatar initials/text fallback",
  },

  Alert: {
    import: "@/components/ui/alert",
    props: ["className", "children", "variant"],
    childrenType: "nodes",
    description: "shadcn alert banner",
  },

  AlertTitle: {
    import: "@/components/ui/alert",
    props: ["className", "children"],
    childrenType: "text",
    description: "Alert heading",
  },

  AlertDescription: {
    import: "@/components/ui/alert",
    props: ["className", "children"],
    childrenType: "text",
    description: "Alert body text",
  },

  Skeleton: {
    import: "@/components/ui/skeleton",
    props: ["className"],
    childrenType: "none",
    description: "Loading placeholder skeleton",
  },

  Progress: {
    import: "@/components/ui/progress",
    props: ["className", "value"],
    childrenType: "none",
    description: "Progress bar indicator",
  },

  Checkbox: {
    import: "@/components/ui/checkbox",
    props: ["className"],
    childrenType: "none",
    description: "Checkbox input",
  },

  Switch: {
    import: "@/components/ui/switch",
    props: ["className"],
    childrenType: "none",
    description: "Toggle switch",
  },

  Separator: {
    import: "@/components/ui/separator",
    props: ["className", "orientation"],
    childrenType: "none",
    description: "Visual separator line",
  },

  Dialog: {
    import: "@/components/ui/dialog",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Modal dialog root",
  },

  DialogTrigger: {
    import: "@/components/ui/dialog",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Dialog open trigger",
  },

  DialogContent: {
    import: "@/components/ui/dialog",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Dialog content panel",
  },

  DialogHeader: {
    import: "@/components/ui/dialog",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Dialog header section",
  },

  DialogTitle: {
    import: "@/components/ui/dialog",
    props: ["className", "children"],
    childrenType: "text",
    description: "Dialog heading",
  },

  DialogDescription: {
    import: "@/components/ui/dialog",
    props: ["className", "children"],
    childrenType: "text",
    description: "Dialog body description",
  },

  Sheet: {
    import: "@/components/ui/sheet",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Slide-over panel root",
  },

  SheetTrigger: {
    import: "@/components/ui/sheet",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Sheet open trigger",
  },

  SheetContent: {
    import: "@/components/ui/sheet",
    props: ["className", "children", "side"],
    childrenType: "nodes",
    description: "Sheet slide-over content",
  },

  // ── Media ──────────────────────────────────────────────────────
  Image: {
    import: null,
    props: ["className", "src", "alt", "width", "height"],
    childrenType: "none",
    description: "Next.js Image component",
  },

  // ── Navigation ─────────────────────────────────────────────────
  Link: {
    import: null,
    props: ["className", "children", "href"],
    childrenType: "text",
    description: "Next.js Link component",
  },

  // ── Data Display ───────────────────────────────────────────────
  Table: {
    import: "@/components/ui/table",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Data table root",
  },

  TableHeader: {
    import: "@/components/ui/table",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Table head section",
  },

  TableBody: {
    import: "@/components/ui/table",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Table body section",
  },

  TableRow: {
    import: "@/components/ui/table",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Table row",
  },

  TableHead: {
    import: "@/components/ui/table",
    props: ["className", "children"],
    childrenType: "text",
    description: "Table header cell",
  },

  TableCell: {
    import: "@/components/ui/table",
    props: ["className", "children"],
    childrenType: "text",
    description: "Table data cell",
  },

  Tooltip: {
    import: "@/components/ui/tooltip",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Tooltip root",
  },

  // ── Forms ──────────────────────────────────────────────────────
  RadioGroup: {
    import: "@/components/ui/radio-group",
    props: ["className", "children"],
    childrenType: "nodes",
    description: "Radio button group",
  },

  RadioGroupItem: {
    import: "@/components/ui/radio-group",
    props: ["className", "value"],
    childrenType: "none",
    description: "Radio button option",
  },

  // ── Client-only interactive components ─────────────────────────
  Toggle: {
    import: "@/components/ui/toggle",
    props: ["className", "children"],
    childrenType: "text",
    isClient: true,
    description: "Toggle button (interactive)",
  },

  Calendar: {
    import: "@/components/ui/calendar",
    props: ["className"],
    childrenType: "none",
    isClient: true,
    description: "Date picker calendar",
  },
}

export const ALLOWED_COMPONENT_NAMES = new Set(Object.keys(COMPONENT_CHEATSHEET))

export const CLIENT_COMPONENTS = new Set(
  Object.entries(COMPONENT_CHEATSHEET)
    .filter(([, entry]) => entry.isClient)
    .map(([name]) => name),
)

export const LAYOUT_COMPONENTS = new Set([
  "Page", "Section", "Container", "Grid", "Stack", "Flex", "Spacer",
])

export function getComponentEntry(name: string): CheatsheetEntry | undefined {
  return COMPONENT_CHEATSHEET[name]
}

export function isAllowedProp(componentName: string, propName: string): boolean {
  const entry = COMPONENT_CHEATSHEET[componentName]
  if (!entry) return false
  return entry.props.includes(propName)
}

export function getImportPath(componentName: string): string | null {
  return COMPONENT_CHEATSHEET[componentName]?.import ?? null
}
