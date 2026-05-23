// Syra Component Registry — maps the AI's JSON manifest element types to
// actual shadcn/ui React components and their import paths.
// This is the ONLY bridge between the AI output and the rendered UI.

export interface RegistryEntry {
  component: string
  importPath: string
  exports: string[]
  isClient: boolean
  voidElement: boolean
  subcomponents: string[]
}

export const REGISTRY: RegistryEntry[] = [
  // Layout & Content
  { component: "button", importPath: "@/components/ui/button", exports: ["Button"], isClient: false, voidElement: false, subcomponents: [] },
  { component: "badge", importPath: "@/components/ui/badge", exports: ["Badge"], isClient: false, voidElement: false, subcomponents: [] },
  { component: "card", importPath: "@/components/ui/card", exports: ["Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"], isClient: false, voidElement: false, subcomponents: ["CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"] },
  { component: "separator", importPath: "@/components/ui/separator", exports: ["Separator"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "skeleton", importPath: "@/components/ui/skeleton", exports: ["Skeleton"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "progress", importPath: "@/components/ui/progress", exports: ["Progress"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "avatar", importPath: "@/components/ui/avatar", exports: ["Avatar", "AvatarImage", "AvatarFallback"], isClient: false, voidElement: false, subcomponents: ["AvatarImage", "AvatarFallback"] },
  { component: "input", importPath: "@/components/ui/input", exports: ["Input"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "textarea", importPath: "@/components/ui/textarea", exports: ["Textarea"], isClient: false, voidElement: true, subcomponents: [] },
  { component: "label", importPath: "@/components/ui/label", exports: ["Label"], isClient: false, voidElement: false, subcomponents: [] },
  // Client Components
  { component: "accordion", importPath: "@/components/ui/accordion", exports: ["Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent"], isClient: true, voidElement: false, subcomponents: ["AccordionItem", "AccordionTrigger", "AccordionContent"] },
  { component: "tabs", importPath: "@/components/ui/tabs", exports: ["Tabs", "TabsList", "TabsTrigger", "TabsContent"], isClient: true, voidElement: false, subcomponents: ["TabsList", "TabsTrigger", "TabsContent"] },
  { component: "dialog", importPath: "@/components/ui/dialog", exports: ["Dialog", "DialogTrigger", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"], isClient: true, voidElement: false, subcomponents: ["DialogTrigger", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"] },
  { component: "select", importPath: "@/components/ui/select", exports: ["Select", "SelectTrigger", "SelectValue", "SelectContent", "SelectItem"], isClient: true, voidElement: false, subcomponents: ["SelectTrigger", "SelectValue", "SelectContent", "SelectItem"] },
  { component: "checkbox", importPath: "@/components/ui/checkbox", exports: ["Checkbox"], isClient: true, voidElement: true, subcomponents: [] },
  { component: "switch", importPath: "@/components/ui/switch", exports: ["Switch"], isClient: true, voidElement: true, subcomponents: [] },
  { component: "tooltip", importPath: "@/components/ui/tooltip", exports: ["Tooltip", "TooltipTrigger", "TooltipContent"], isClient: true, voidElement: false, subcomponents: ["TooltipTrigger", "TooltipContent"] },
  { component: "hover-card", importPath: "@/components/ui/hover-card", exports: ["HoverCard", "HoverCardTrigger", "HoverCardContent"], isClient: true, voidElement: false, subcomponents: ["HoverCardTrigger", "HoverCardContent"] },
  { component: "popover", importPath: "@/components/ui/popover", exports: ["Popover", "PopoverTrigger", "PopoverContent"], isClient: true, voidElement: false, subcomponents: ["PopoverTrigger", "PopoverContent"] },
  { component: "carousel", importPath: "@/components/ui/carousel", exports: ["Carousel", "CarouselContent", "CarouselItem", "CarouselPrevious", "CarouselNext"], isClient: true, voidElement: false, subcomponents: ["CarouselContent", "CarouselItem"] },
  { component: "slider", importPath: "@/components/ui/slider", exports: ["Slider"], isClient: true, voidElement: true, subcomponents: [] },
  { component: "toggle", importPath: "@/components/ui/toggle", exports: ["Toggle"], isClient: true, voidElement: false, subcomponents: [] },
  { component: "calendar", importPath: "@/components/ui/calendar", exports: ["Calendar"], isClient: true, voidElement: true, subcomponents: [] },
  { component: "sheet", importPath: "@/components/ui/sheet", exports: ["Sheet", "SheetTrigger", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], isClient: true, voidElement: false, subcomponents: ["SheetTrigger", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"] },
  { component: "scroll-area", importPath: "@/components/ui/scroll-area", exports: ["ScrollArea", "ScrollBar"], isClient: false, voidElement: false, subcomponents: [] },
  // Data Display
  { component: "table", importPath: "@/components/ui/table", exports: ["Table", "TableHeader", "TableBody", "TableRow", "TableHead", "TableCell"], isClient: false, voidElement: false, subcomponents: ["TableHeader", "TableBody", "TableRow", "TableHead", "TableCell"] },
  { component: "chart", importPath: "@/components/ui/chart", exports: ["ChartContainer", "ChartTooltip", "ChartTooltipContent", "ChartLegend", "ChartLegendContent"], isClient: true, voidElement: false, subcomponents: [] },
  // Feedback
  { component: "alert", importPath: "@/components/ui/alert", exports: ["Alert", "AlertTitle", "AlertDescription"], isClient: false, voidElement: false, subcomponents: ["AlertTitle", "AlertDescription"] },
  { component: "alert-dialog", importPath: "@/components/ui/alert-dialog", exports: ["AlertDialog", "AlertDialogTrigger", "AlertDialogContent", "AlertDialogHeader", "AlertDialogTitle", "AlertDialogDescription", "AlertDialogFooter", "AlertDialogAction", "AlertDialogCancel"], isClient: true, voidElement: false, subcomponents: ["AlertDialogTrigger", "AlertDialogContent", "AlertDialogHeader", "AlertDialogTitle", "AlertDialogDescription", "AlertDialogFooter", "AlertDialogAction", "AlertDialogCancel"] },
  // Navigation
  { component: "breadcrumb", importPath: "@/components/ui/breadcrumb", exports: ["Breadcrumb", "BreadcrumbList", "BreadcrumbItem", "BreadcrumbLink", "BreadcrumbPage", "BreadcrumbSeparator"], isClient: false, voidElement: false, subcomponents: ["BreadcrumbList", "BreadcrumbItem", "BreadcrumbLink", "BreadcrumbPage", "BreadcrumbSeparator"] },
  { component: "pagination", importPath: "@/components/ui/pagination", exports: ["Pagination", "PaginationContent", "PaginationItem", "PaginationLink", "PaginationPrevious", "PaginationNext"], isClient: false, voidElement: false, subcomponents: ["PaginationContent", "PaginationItem", "PaginationLink", "PaginationPrevious", "PaginationNext"] },
  { component: "navigation-menu", importPath: "@/components/ui/navigation-menu", exports: ["NavigationMenu", "NavigationMenuList", "NavigationMenuItem", "NavigationMenuTrigger", "NavigationMenuContent", "NavigationMenuLink"], isClient: false, voidElement: false, subcomponents: ["NavigationMenuList", "NavigationMenuItem", "NavigationMenuTrigger", "NavigationMenuContent", "NavigationMenuLink"] },
  // Forms
  { component: "radio-group", importPath: "@/components/ui/radio-group", exports: ["RadioGroup", "RadioGroupItem"], isClient: false, voidElement: false, subcomponents: ["RadioGroupItem"] },
  // Resizable
  { component: "resizable", importPath: "@/components/ui/resizable", exports: ["ResizablePanelGroup", "ResizablePanel", "ResizableHandle"], isClient: false, voidElement: false, subcomponents: ["ResizablePanel", "ResizableHandle"] },
]

export const registryByName = new Map(REGISTRY.map((r) => [r.component, r]))
export const subcomponentToParent = new Map<string, string>()

for (const entry of REGISTRY) {
  for (const sub of entry.subcomponents) {
    subcomponentToParent.set(sub, entry.component)
    subcomponentToParent.set(sub.toLowerCase(), entry.component)
  }
}
for (const entry of REGISTRY) {
  subcomponentToParent.set(entry.component.toLowerCase(), entry.component)
}

export function getEntry(type: string): RegistryEntry | undefined {
  const lower = type.toLowerCase()
  return registryByName.get(lower) ??
    (subcomponentToParent.has(lower) ? registryByName.get(subcomponentToParent.get(lower)!) : undefined) ??
    registryByName.get(type)
}

export function getAllowedTypes(): string[] {
  const types = REGISTRY.map((r) => r.component)
  for (const entry of REGISTRY) types.push(...entry.subcomponents.map((s) => s.toLowerCase()))
  return types
}
