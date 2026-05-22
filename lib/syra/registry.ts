// Syra Component Registry — maps string keys to shadcn/ui React components.
// This is the bridge between the AI manifest (JSON) and the rendered UI (TSX).
// Never use eval() — always resolve through this registry.

import type { RegistryEntry } from "@/lib/syra/types"

// All shadcn UI components installed in this project.
// Each entry maps the AI-facing string key to the physical import path and exports.
// `isClient: true` marks components that require "use client" hydration.
// `voidElement: true` marks self-closing components that never have children.

export const REGISTRY: RegistryEntry[] = [
  // ── Layout Primitives ──────────────────────────────────────
  { component: "button", importPath: "@/components/ui/button", exports: ["Button"], isClient: false, voidElement: false, subcomponents: [] },
  { component: "badge", importPath: "@/components/ui/badge", exports: ["Badge"], isClient: false, voidElement: false, subcomponents: [] },
  { component: "card", importPath: "@/components/ui/card", exports: ["Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"], isClient: false, voidElement: false, subcomponents: ["CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"] },
  { component: "separator", importPath: "@/components/ui/separator", exports: ["Separator"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "skeleton", importPath: "@/components/ui/skeleton", exports: ["Skeleton"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "progress", importPath: "@/components/ui/progress", exports: ["Progress"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "avatar", importPath: "@/components/ui/avatar", exports: ["Avatar", "AvatarImage", "AvatarFallback"], isClient: false, voidElement: false, subcomponents: ["AvatarImage", "AvatarFallback"] },
  { component: "image", importPath: "@/components/ui/avatar", exports: ["Avatar", "AvatarImage", "AvatarFallback"], isClient: false, voidElement: false, subcomponents: ["AvatarImage", "AvatarFallback"] },

  // ── Typography ─────────────────────────────────────────────
  { component: "label", importPath: "@/components/ui/label", exports: ["Label"], isClient: false, voidElement: false, subcomponents: [] },
  { component: "input", importPath: "@/components/ui/input", exports: ["Input"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "textarea", importPath: "@/components/ui/textarea", exports: ["Textarea"], isClient: false, voidElement: true, subcomponents: [] },

  // ── Client Components (require hydration) ──────────────────
  { component: "accordion", importPath: "@/components/ui/accordion", exports: ["Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent"], isClient: true, voidElement: false, subcomponents: ["AccordionItem", "AccordionTrigger", "AccordionContent"] },
  { component: "tabs", importPath: "@/components/ui/tabs", exports: ["Tabs", "TabsList", "TabsTrigger", "TabsContent"], isClient: true, voidElement: false, subcomponents: ["TabsList", "TabsTrigger", "TabsContent"] },
  { component: "dialog", importPath: "@/components/ui/dialog", exports: ["Dialog", "DialogTrigger", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"], isClient: true, voidElement: false, subcomponents: ["DialogTrigger", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"] },
  { component: "sheet", importPath: "@/components/ui/sheet", exports: ["Sheet", "SheetTrigger", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], isClient: true, voidElement: false, subcomponents: ["SheetTrigger", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"] },
  { component: "dropdown-menu", importPath: "@/components/ui/dropdown-menu", exports: ["DropdownMenu", "DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem"], isClient: true, voidElement: false, subcomponents: ["DropdownMenuTrigger", "DropdownMenuContent", "DropdownMenuItem"] },
  { component: "select", importPath: "@/components/ui/select", exports: ["Select", "SelectTrigger", "SelectValue", "SelectContent", "SelectItem"], isClient: true, voidElement: false, subcomponents: ["SelectTrigger", "SelectValue", "SelectContent", "SelectItem"] },
  { component: "checkbox", importPath: "@/components/ui/checkbox", exports: ["Checkbox"], isClient: true, voidElement: true, subcomponents: [] },
  { component: "switch", importPath: "@/components/ui/switch", exports: ["Switch"], isClient: true, voidElement: true, subcomponents: [] },
  { component: "tooltip", importPath: "@/components/ui/tooltip", exports: ["Tooltip", "TooltipTrigger", "TooltipContent"], isClient: true, voidElement: false, subcomponents: ["TooltipTrigger", "TooltipContent"] },
  { component: "hover-card", importPath: "@/components/ui/hover-card", exports: ["HoverCard", "HoverCardTrigger", "HoverCardContent"], isClient: true, voidElement: false, subcomponents: ["HoverCardTrigger", "HoverCardContent"] },
  { component: "popover", importPath: "@/components/ui/popover", exports: ["Popover", "PopoverTrigger", "PopoverContent"], isClient: true, voidElement: false, subcomponents: ["PopoverTrigger", "PopoverContent"] },
  { component: "carousel", importPath: "@/components/ui/carousel", exports: ["Carousel", "CarouselContent", "CarouselItem", "CarouselPrevious", "CarouselNext"], isClient: true, voidElement: false, subcomponents: ["CarouselContent", "CarouselItem"] },
  { component: "calendar", importPath: "@/components/ui/calendar", exports: ["Calendar"], isClient: true, voidElement: true, subcomponents: [] },
  { component: "slider", importPath: "@/components/ui/slider", exports: ["Slider"], isClient: true, voidElement: true, subcomponents: [] },
  { component: "toggle", importPath: "@/components/ui/toggle", exports: ["Toggle"], isClient: true, voidElement: false, subcomponents: [] },
  { component: "toggle-group", importPath: "@/components/ui/toggle-group", exports: ["ToggleGroup", "ToggleGroupItem"], isClient: true, voidElement: false, subcomponents: ["ToggleGroupItem"] },
  { component: "scroll-area", importPath: "@/components/ui/scroll-area", exports: ["ScrollArea", "ScrollBar"], isClient: false, voidElement: false, subcomponents: [] },

  // ── Data Display ───────────────────────────────────────────
  { component: "table", importPath: "@/components/ui/table", exports: ["Table", "TableHeader", "TableBody", "TableRow", "TableHead", "TableCell"], isClient: false, voidElement: false, subcomponents: ["TableHeader", "TableBody", "TableRow", "TableHead", "TableCell"] },
  { component: "chart", importPath: "@/components/ui/chart", exports: ["ChartContainer", "ChartTooltip", "ChartTooltipContent", "ChartLegend", "ChartLegendContent"], isClient: true, voidElement: false, subcomponents: [] },

  // ── Feedback ───────────────────────────────────────────────
  { component: "alert", importPath: "@/components/ui/alert", exports: ["Alert", "AlertTitle", "AlertDescription"], isClient: false, voidElement: false, subcomponents: ["AlertTitle", "AlertDescription"] },
  { component: "alert-dialog", importPath: "@/components/ui/alert-dialog", exports: ["AlertDialog", "AlertDialogTrigger", "AlertDialogContent", "AlertDialogHeader", "AlertDialogTitle", "AlertDialogDescription", "AlertDialogFooter", "AlertDialogAction", "AlertDialogCancel"], isClient: true, voidElement: false, subcomponents: ["AlertDialogTrigger", "AlertDialogContent", "AlertDialogHeader", "AlertDialogTitle", "AlertDialogDescription", "AlertDialogFooter", "AlertDialogAction", "AlertDialogCancel"] },
  { component: "sonner", importPath: "@/components/ui/sonner", exports: ["Toaster"], isClient: true, voidElement: true, subcomponents: [] },

  // ── Navigation ─────────────────────────────────────────────
  { component: "breadcrumb", importPath: "@/components/ui/breadcrumb", exports: ["Breadcrumb", "BreadcrumbList", "BreadcrumbItem", "BreadcrumbLink", "BreadcrumbPage", "BreadcrumbSeparator"], isClient: false, voidElement: false, subcomponents: ["BreadcrumbList", "BreadcrumbItem", "BreadcrumbLink", "BreadcrumbPage", "BreadcrumbSeparator"] },
  { component: "pagination", importPath: "@/components/ui/pagination", exports: ["Pagination", "PaginationContent", "PaginationItem", "PaginationLink", "PaginationPrevious", "PaginationNext"], isClient: false, voidElement: false, subcomponents: ["PaginationContent", "PaginationItem", "PaginationLink", "PaginationPrevious", "PaginationNext"] },
  { component: "navigation-menu", importPath: "@/components/ui/navigation-menu", exports: ["NavigationMenu", "NavigationMenuList", "NavigationMenuItem", "NavigationMenuTrigger", "NavigationMenuContent", "NavigationMenuLink"], isClient: false, voidElement: false, subcomponents: ["NavigationMenuList", "NavigationMenuItem", "NavigationMenuTrigger", "NavigationMenuContent", "NavigationMenuLink"] },

  // ── Forms ──────────────────────────────────────────────────
  { component: "radio-group", importPath: "@/components/ui/radio-group", exports: ["RadioGroup", "RadioGroupItem"], isClient: false, voidElement: false, subcomponents: ["RadioGroupItem"] },

  // ── Resizable ──────────────────────────────────────────────
  { component: "resizable", importPath: "@/components/ui/resizable", exports: ["ResizablePanelGroup", "ResizablePanel", "ResizableHandle"], isClient: false, voidElement: false, subcomponents: ["ResizablePanel", "ResizableHandle"] },
]

// Fast lookup maps
export const registryByName = new Map(REGISTRY.map((r) => [r.component, r]))

export const registryByExport = new Map<string, RegistryEntry>()
for (const entry of REGISTRY) {
  for (const exp of entry.exports) {
    registryByExport.set(exp, entry)
  }
}

// Subcomponent map: "CardHeader" → "card"
export const subcomponentToParent = new Map<string, string>()
for (const entry of REGISTRY) {
  for (const sub of entry.subcomponents) {
    subcomponentToParent.set(sub, entry.component)
  }
}

export function getRegistryEntry(type: string): RegistryEntry | undefined {
  return registryByName.get(type) ?? (() => {
    const parent = subcomponentToParent.get(type)
    return parent ? registryByName.get(parent) : undefined
  })()
}

export function getAllowedTypes(): string[] {
  const types = REGISTRY.map((r) => r.component)
  for (const entry of REGISTRY) {
    types.push(...entry.subcomponents)
  }
  return types
}

export function isClientComponent(type: string): boolean {
  const entry = getRegistryEntry(type)
  return entry?.isClient ?? false
}

export function isVoidElement(type: string): boolean {
  const entry = getRegistryEntry(type)
  return entry?.voidElement ?? false
}
