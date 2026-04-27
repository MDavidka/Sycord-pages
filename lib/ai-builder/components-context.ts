// Loads components.json from the repo root and exposes a
// fast lookup for the JSON-tree → TSX converter and the
// per-page component subset selector.
//
// components.json is the single source of truth. The builder
// MUST NOT invent shadcn components.

import { promises as fs } from "node:fs"
import path from "node:path"

import type { ComponentSpec, ComponentsCheatsheet } from "./types"

export type { ComponentSpec, ComponentsCheatsheet } from "./types"

interface RawComponentEntry {
  slug: string
  name: string
  import_path: string
  exports: string[]
  json_generator_hint?: {
    node_name_options?: string[]
  }
}

interface RawCheatsheet {
  components: RawComponentEntry[]
}

let cached: ComponentsCheatsheet | null = null

// Components that frequently appear together as parts of a single
// shadcn primitive. Used to expand `componentsNeeded` from the AI
// plan (e.g. asking for "Card" pulls in CardHeader/CardTitle/etc.).
const REQUIRED_COMPANIONS: Record<string, string[]> = {
  Card: ["CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"],
  Accordion: ["AccordionItem", "AccordionTrigger", "AccordionContent"],
  Tabs: ["TabsList", "TabsTrigger", "TabsContent"],
  AlertDialog: [
    "AlertDialogTrigger",
    "AlertDialogContent",
    "AlertDialogHeader",
    "AlertDialogTitle",
    "AlertDialogDescription",
    "AlertDialogFooter",
    "AlertDialogAction",
    "AlertDialogCancel",
  ],
  Dialog: [
    "DialogTrigger",
    "DialogContent",
    "DialogHeader",
    "DialogTitle",
    "DialogDescription",
    "DialogFooter",
  ],
  DropdownMenu: ["DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem"],
  Sheet: ["SheetTrigger", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"],
  Form: ["FormField", "FormItem", "FormLabel", "FormControl", "FormDescription", "FormMessage"],
  NavigationMenu: ["NavigationMenuList", "NavigationMenuItem", "NavigationMenuLink"],
  Select: ["SelectTrigger", "SelectValue", "SelectContent", "SelectItem"],
  Breadcrumb: ["BreadcrumbList", "BreadcrumbItem", "BreadcrumbLink", "BreadcrumbSeparator"],
  Carousel: ["CarouselContent", "CarouselItem", "CarouselPrevious", "CarouselNext"],
  RadioGroup: ["RadioGroupItem"],
  ToggleGroup: ["ToggleGroupItem"],
  HoverCard: ["HoverCardTrigger", "HoverCardContent"],
  Popover: ["PopoverTrigger", "PopoverContent"],
  Drawer: ["DrawerTrigger", "DrawerContent", "DrawerHeader", "DrawerTitle", "DrawerDescription", "DrawerFooter"],
  Table: ["TableHeader", "TableBody", "TableRow", "TableCell", "TableHead"],
  Sidebar: ["SidebarHeader", "SidebarContent", "SidebarFooter", "SidebarMenu", "SidebarMenuItem"],
  ContextMenu: ["ContextMenuTrigger", "ContextMenuContent", "ContextMenuItem"],
  Menubar: ["MenubarMenu", "MenubarTrigger", "MenubarContent", "MenubarItem"],
  Pagination: ["PaginationContent", "PaginationItem", "PaginationLink", "PaginationNext", "PaginationPrevious"],
  Tooltip: ["TooltipTrigger", "TooltipContent", "TooltipProvider"],
  Collapsible: ["CollapsibleTrigger", "CollapsibleContent"],
  Avatar: ["AvatarImage", "AvatarFallback"],
  InputOTP: ["InputOTPGroup", "InputOTPSlot"],
}

export async function loadComponentsCheatsheet(repoRoot?: string): Promise<ComponentsCheatsheet> {
  if (cached) return cached
  const root = repoRoot ?? process.cwd()
  const filePath = path.join(root, "components.json")
  const raw = await fs.readFile(filePath, "utf8")
  const parsed = JSON.parse(raw) as RawCheatsheet

  const byName: Record<string, ComponentSpec> = {}
  const bySlug: Record<string, ComponentSpec> = {}
  const allowedNodeNames = new Set<string>()

  for (const entry of parsed.components) {
    const spec: ComponentSpec = {
      slug: entry.slug,
      name: entry.name,
      importPath: entry.import_path,
      exports: entry.exports ?? [],
    }
    bySlug[entry.slug] = spec
    // Always claim the primary `name` mapping for this primitive. This
    // guards against another component re-listing this name in its own
    // `exports` (e.g. `date-picker` re-exports `Button`); the canonical
    // primitive must win the lookup.
    byName[entry.name] = spec
    for (const exp of spec.exports) {
      // Don't overwrite a registration where the export name equals the
      // owning primitive's `name` (so `Button` stays mapped to the
      // `button` primitive, not to `date-picker`).
      const existing = byName[exp]
      if (!existing || existing.name !== exp) {
        byName[exp] = spec
      }
      allowedNodeNames.add(exp)
    }
    // Also register the json_generator_hint node name options.
    for (const opt of entry.json_generator_hint?.node_name_options ?? []) {
      allowedNodeNames.add(opt)
    }
  }

  // Always allow plain HTML primitives the converter knows how to handle.
  for (const name of HTML_PRIMITIVES) allowedNodeNames.add(name)

  cached = { byName, bySlug, allowedNodeNames }
  return cached
}

export const HTML_PRIMITIVES = new Set([
  "main",
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "nav",
  "div",
  "span",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "img",
  "a",
  "form",
  "label",
  "button",
  "br",
  "hr",
  "strong",
  "em",
  "small",
  "blockquote",
  "figure",
  "figcaption",
])

// Wrappers provided by the scaffold (components/motion/*).
export const MOTION_WRAPPERS: Record<string, string> = {
  FadeIn: "@/components/motion/fade-in",
  Stagger: "@/components/motion/stagger",
  StaggerItem: "@/components/motion/stagger",
  MotionCard: "@/components/motion/motion-card",
}

export function isHtmlPrimitive(name: string): boolean {
  return HTML_PRIMITIVES.has(name)
}

export function isMotionWrapper(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(MOTION_WRAPPERS, name)
}

// Expand the AI's `componentsNeeded` list into a verified, deduped subset
// that includes any required companion exports.
export function expandComponentSubset(
  cheatsheet: ComponentsCheatsheet,
  requested: string[],
): { exports: string[]; ignored: string[] } {
  const out = new Set<string>()
  const ignored: string[] = []
  for (const raw of requested) {
    const name = raw.trim()
    if (!name) continue
    const spec = cheatsheet.byName[name]
    if (!spec) {
      ignored.push(name)
      continue
    }
    // Add the requested export.
    out.add(name)
    // Add companion exports for primitives that need them.
    const companions = REQUIRED_COMPANIONS[name]
    if (companions) {
      for (const c of companions) {
        if (cheatsheet.byName[c]) out.add(c)
      }
    }
  }
  return { exports: Array.from(out).sort(), ignored }
}

// Returns a compact summary of components for prompt injection.
export function summarizeComponentsForPrompt(
  cheatsheet: ComponentsCheatsheet,
  exportsAllowed: string[],
): Array<{ name: string; importPath: string; exports: string[] }> {
  // Group exports by spec so the model sees the canonical primitive list.
  const seen = new Set<string>()
  const out: Array<{ name: string; importPath: string; exports: string[] }> = []
  for (const exp of exportsAllowed) {
    const spec = cheatsheet.byName[exp]
    if (!spec || seen.has(spec.slug)) continue
    seen.add(spec.slug)
    out.push({
      name: spec.name,
      importPath: spec.importPath,
      exports: spec.exports.filter((e) => exportsAllowed.includes(e)),
    })
  }
  return out
}

// Group export names by their import path so the converter can
// emit a minimal `import { A, B, C } from "@/components/ui/x"` per page.
export function groupExportsByImportPath(
  cheatsheet: ComponentsCheatsheet,
  exports: string[],
): Map<string, string[]> {
  const grouped = new Map<string, string[]>()
  for (const exp of exports) {
    const spec = cheatsheet.byName[exp]
    if (!spec) continue
    const list = grouped.get(spec.importPath) ?? []
    if (!list.includes(exp)) list.push(exp)
    grouped.set(spec.importPath, list)
  }
  for (const [k, v] of grouped) {
    grouped.set(k, v.sort())
  }
  return grouped
}
