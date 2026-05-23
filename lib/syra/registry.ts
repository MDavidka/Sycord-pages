// Syra Registry — maps ManifestComponent.shadcnPrimitive to shadcn/ui import paths.
// Used by the compiler to resolve deterministic imports. No hallucination possible.

export interface RegistryEntry {
  primitive: string
  importPath: string
  mainExport: string
  subExports: string[]
  isClient: boolean
  voidElement: boolean
}

export const REGISTRY: RegistryEntry[] = [
  { primitive: "button", importPath: "@/components/ui/button", mainExport: "Button", subExports: [], isClient: false, voidElement: false },
  { primitive: "badge", importPath: "@/components/ui/badge", mainExport: "Badge", subExports: [], isClient: false, voidElement: false },
  { primitive: "card", importPath: "@/components/ui/card", mainExport: "Card", subExports: ["CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"], isClient: false, voidElement: false },
  { primitive: "label", importPath: "@/components/ui/label", mainExport: "Label", subExports: [], isClient: false, voidElement: false },
  { primitive: "separator", importPath: "@/components/ui/separator", mainExport: "Separator", subExports: [], isClient: false, voidElement: true },
  { primitive: "skeleton", importPath: "@/components/ui/skeleton", mainExport: "Skeleton", subExports: [], isClient: false, voidElement: true },
  { primitive: "progress", importPath: "@/components/ui/progress", mainExport: "Progress", subExports: [], isClient: false, voidElement: true },
  { primitive: "avatar", importPath: "@/components/ui/avatar", mainExport: "Avatar", subExports: ["AvatarImage", "AvatarFallback"], isClient: false, voidElement: false },
  { primitive: "input", importPath: "@/components/ui/input", mainExport: "Input", subExports: [], isClient: false, voidElement: true },
  { primitive: "textarea", importPath: "@/components/ui/textarea", mainExport: "Textarea", subExports: [], isClient: false, voidElement: true },
  { primitive: "accordion", importPath: "@/components/ui/accordion", mainExport: "Accordion", subExports: ["AccordionItem", "AccordionTrigger", "AccordionContent"], isClient: true, voidElement: false },
  { primitive: "tabs", importPath: "@/components/ui/tabs", mainExport: "Tabs", subExports: ["TabsList", "TabsTrigger", "TabsContent"], isClient: true, voidElement: false },
  { primitive: "dialog", importPath: "@/components/ui/dialog", mainExport: "Dialog", subExports: ["DialogTrigger", "DialogContent", "DialogHeader", "DialogTitle", "DialogDescription"], isClient: true, voidElement: false },
  { primitive: "select", importPath: "@/components/ui/select", mainExport: "Select", subExports: ["SelectTrigger", "SelectValue", "SelectContent", "SelectItem"], isClient: true, voidElement: false },
  { primitive: "checkbox", importPath: "@/components/ui/checkbox", mainExport: "Checkbox", subExports: [], isClient: true, voidElement: true },
  { primitive: "switch", importPath: "@/components/ui/switch", mainExport: "Switch", subExports: [], isClient: true, voidElement: true },
  { primitive: "tooltip", importPath: "@/components/ui/tooltip", mainExport: "Tooltip", subExports: ["TooltipTrigger", "TooltipContent"], isClient: true, voidElement: false },
  { primitive: "popover", importPath: "@/components/ui/popover", mainExport: "Popover", subExports: ["PopoverTrigger", "PopoverContent"], isClient: true, voidElement: false },
  { primitive: "sheet", importPath: "@/components/ui/sheet", mainExport: "Sheet", subExports: ["SheetTrigger", "SheetContent", "SheetHeader", "SheetTitle", "SheetDescription"], isClient: true, voidElement: false },
  { primitive: "alert", importPath: "@/components/ui/alert", mainExport: "Alert", subExports: ["AlertTitle", "AlertDescription"], isClient: false, voidElement: false },
  { primitive: "carousel", importPath: "@/components/ui/carousel", mainExport: "Carousel", subExports: ["CarouselContent", "CarouselItem"], isClient: true, voidElement: false },
  { primitive: "slider", importPath: "@/components/ui/slider", mainExport: "Slider", subExports: [], isClient: true, voidElement: true },
  { primitive: "toggle", importPath: "@/components/ui/toggle", mainExport: "Toggle", subExports: [], isClient: true, voidElement: false },
  { primitive: "breadcrumb", importPath: "@/components/ui/breadcrumb", mainExport: "Breadcrumb", subExports: ["BreadcrumbList", "BreadcrumbItem", "BreadcrumbLink", "BreadcrumbSeparator"], isClient: false, voidElement: false },
  { primitive: "pagination", importPath: "@/components/ui/pagination", mainExport: "Pagination", subExports: ["PaginationContent", "PaginationItem", "PaginationLink"], isClient: false, voidElement: false },
  { primitive: "navigation-menu", importPath: "@/components/ui/navigation-menu", mainExport: "NavigationMenu", subExports: ["NavigationMenuList", "NavigationMenuItem", "NavigationMenuTrigger", "NavigationMenuContent"], isClient: false, voidElement: false },
  { primitive: "radio-group", importPath: "@/components/ui/radio-group", mainExport: "RadioGroup", subExports: ["RadioGroupItem"], isClient: false, voidElement: false },
  { primitive: "scroll-area", importPath: "@/components/ui/scroll-area", mainExport: "ScrollArea", subExports: ["ScrollBar"], isClient: false, voidElement: false },
  { primitive: "table", importPath: "@/components/ui/table", mainExport: "Table", subExports: ["TableHeader", "TableBody", "TableRow", "TableHead", "TableCell"], isClient: false, voidElement: false },
]

export const byPrimitive = new Map(REGISTRY.map((r) => [r.primitive, r]))
export const byExport = new Map<string, RegistryEntry>()
for (const e of REGISTRY) {
  byExport.set(e.mainExport, e)
  for (const s of e.subExports) byExport.set(s, e)
}

export function getPrimitive(name: string): RegistryEntry | undefined {
  return byPrimitive.get(name) ?? byExport.get(name)
}

export function isClient(primitive: string): boolean {
  return getPrimitive(primitive)?.isClient ?? false
}
