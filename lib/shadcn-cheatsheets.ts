export type ShadcnComponentCheatSheetEntry = {
  name: string
  variants: string[]
  code: string
}

export const SHADCN_COMPONENT_CATALOG: ShadcnComponentCheatSheetEntry[] = [
  { name: "Accordion", variants: ["type=single", "type=multiple", "collapsible"], code: "<Accordion type=\"single\" collapsible><AccordionItem value=\"item-1\">...</AccordionItem></Accordion>" },
  { name: "Alert", variants: ["default", "destructive"], code: "<Alert variant=\"destructive\"><AlertTitle>Error</AlertTitle><AlertDescription>Something failed.</AlertDescription></Alert>" },
  { name: "AlertDialog", variants: ["confirm", "destructive"], code: "<AlertDialog><AlertDialogTrigger>Delete</AlertDialogTrigger><AlertDialogContent>...</AlertDialogContent></AlertDialog>" },
  { name: "AspectRatio", variants: ["ratio=16/9", "ratio=1/1"], code: "<AspectRatio ratio={16 / 9}><img src=\"https://placehold.co/800x450.png\" alt=\"Preview\" /></AspectRatio>" },
  { name: "Avatar", variants: ["image", "fallback"], code: "<Avatar><AvatarImage src=\"https://placehold.co/64x64.png\" /><AvatarFallback>JD</AvatarFallback></Avatar>" },
  { name: "Badge", variants: ["default", "secondary", "outline", "destructive"], code: "<Badge variant=\"secondary\">Pro</Badge>" },
  { name: "Breadcrumb", variants: ["with separators", "with current page"], code: "<Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href=\"/\">Home</BreadcrumbLink></BreadcrumbItem></BreadcrumbList></Breadcrumb>" },
  { name: "Button", variants: ["default", "secondary", "destructive", "outline", "ghost", "link", "size=sm/lg/icon"], code: "<Button variant=\"outline\" size=\"sm\">Save</Button>" },
  { name: "Calendar", variants: ["single date", "range"], code: "<Calendar mode=\"single\" selected={date} onSelect={setDate} />" },
  { name: "Card", variants: ["default", "elevated", "bordered"], code: "<Card><CardHeader><CardTitle>Title</CardTitle></CardHeader><CardContent>Body</CardContent></Card>" },
  { name: "Carousel", variants: ["horizontal", "vertical"], code: "<Carousel><CarouselContent><CarouselItem>Slide</CarouselItem></CarouselContent></Carousel>" },
  { name: "Checkbox", variants: ["checked", "unchecked", "disabled"], code: "<Checkbox checked={value} onCheckedChange={setValue} />" },
  { name: "Collapsible", variants: ["open", "closed"], code: "<Collapsible open={open} onOpenChange={setOpen}><CollapsibleTrigger>Toggle</CollapsibleTrigger><CollapsibleContent>Details</CollapsibleContent></Collapsible>" },
  { name: "Command", variants: ["search", "grouped items"], code: "<Command><CommandInput placeholder=\"Search...\" /><CommandList><CommandItem>Item</CommandItem></CommandList></Command>" },
  { name: "ContextMenu", variants: ["default", "nested"], code: "<ContextMenu><ContextMenuTrigger>Right click</ContextMenuTrigger><ContextMenuContent><ContextMenuItem>Edit</ContextMenuItem></ContextMenuContent></ContextMenu>" },
  { name: "Dialog", variants: ["default", "form dialog"], code: "<Dialog><DialogTrigger>Open</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader></DialogContent></Dialog>" },
  { name: "DropdownMenu", variants: ["default", "checkbox items", "radio group"], code: "<DropdownMenu><DropdownMenuTrigger asChild><Button>Menu</Button></DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem>Profile</DropdownMenuItem></DropdownMenuContent></DropdownMenu>" },
  { name: "Form", variants: ["react-hook-form", "zod validation"], code: "<Form {...form}><form onSubmit={form.handleSubmit(onSubmit)}>...</form></Form>" },
  { name: "HoverCard", variants: ["default", "delayed open"], code: "<HoverCard><HoverCardTrigger>@username</HoverCardTrigger><HoverCardContent>Profile card</HoverCardContent></HoverCard>" },
  { name: "Input", variants: ["text", "email", "password", "search", "disabled"], code: "<Input type=\"email\" placeholder=\"name@example.com\" />" },
  { name: "InputOTP", variants: ["length=4", "length=6"], code: "<InputOTP maxLength={6}><InputOTPGroup><InputOTPSlot index={0} /></InputOTPGroup></InputOTP>" },
  { name: "Label", variants: ["default", "required"], code: "<Label htmlFor=\"email\">Email</Label>" },
  { name: "Menubar", variants: ["default", "nested menus"], code: "<Menubar><MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent><MenubarItem>New</MenubarItem></MenubarContent></MenubarMenu></Menubar>" },
  { name: "NavigationMenu", variants: ["default", "with viewport"], code: "<NavigationMenu><NavigationMenuList><NavigationMenuItem>...</NavigationMenuItem></NavigationMenuList></NavigationMenu>" },
  { name: "Pagination", variants: ["numbered", "next/prev"], code: "<Pagination><PaginationContent><PaginationItem><PaginationLink href=\"#\">1</PaginationLink></PaginationItem></PaginationContent></Pagination>" },
  { name: "Popover", variants: ["default", "form popover"], code: "<Popover><PopoverTrigger asChild><Button>Open</Button></PopoverTrigger><PopoverContent>Content</PopoverContent></Popover>" },
  { name: "Progress", variants: ["value=0-100", "animated"], code: "<Progress value={66} />" },
  { name: "RadioGroup", variants: ["single choice", "disabled options"], code: "<RadioGroup defaultValue=\"option-1\"><RadioGroupItem value=\"option-1\" id=\"r1\" /></RadioGroup>" },
  { name: "Resizable", variants: ["horizontal panels", "vertical panels"], code: "<ResizablePanelGroup direction=\"horizontal\"><ResizablePanel>Left</ResizablePanel></ResizablePanelGroup>" },
  { name: "ScrollArea", variants: ["vertical", "horizontal", "both"], code: "<ScrollArea className=\"h-48\">Long content</ScrollArea>" },
  { name: "Select", variants: ["single select", "placeholder", "disabled"], code: "<Select><SelectTrigger><SelectValue placeholder=\"Pick one\" /></SelectTrigger><SelectContent><SelectItem value=\"a\">A</SelectItem></SelectContent></Select>" },
  { name: "Separator", variants: ["horizontal", "vertical"], code: "<Separator orientation=\"horizontal\" />" },
  { name: "Sheet", variants: ["side=left/right/top/bottom"], code: "<Sheet><SheetTrigger asChild><Button>Open</Button></SheetTrigger><SheetContent side=\"right\">Panel</SheetContent></Sheet>" },
  { name: "Skeleton", variants: ["text line", "card placeholder", "avatar circle"], code: "<Skeleton className=\"h-4 w-40\" />" },
  { name: "Slider", variants: ["single thumb", "range"], code: "<Slider defaultValue={[50]} max={100} step={1} />" },
  { name: "Switch", variants: ["on", "off", "disabled"], code: "<Switch checked={enabled} onCheckedChange={setEnabled} />" },
  { name: "Table", variants: ["basic", "striped via class", "sortable headers"], code: "<Table><TableHeader><TableRow><TableHead>Name</TableHead></TableRow></TableHeader><TableBody><TableRow><TableCell>Jane</TableCell></TableRow></TableBody></Table>" },
  { name: "Tabs", variants: ["default", "underlined via class"], code: "<Tabs defaultValue=\"account\"><TabsList><TabsTrigger value=\"account\">Account</TabsTrigger></TabsList><TabsContent value=\"account\">...</TabsContent></Tabs>" },
  { name: "Textarea", variants: ["default", "resize-none", "disabled"], code: "<Textarea placeholder=\"Write details...\" />" },
  { name: "Toast", variants: ["default", "destructive", "action"], code: "toast({ title: \"Saved\", description: \"Changes stored\" })" },
  { name: "Toggle", variants: ["default", "outline", "size=sm/lg"], code: "<Toggle variant=\"outline\" aria-label=\"Toggle bold\">B</Toggle>" },
  { name: "ToggleGroup", variants: ["type=single", "type=multiple"], code: "<ToggleGroup type=\"multiple\"><ToggleGroupItem value=\"bold\">B</ToggleGroupItem></ToggleGroup>" },
  { name: "Tooltip", variants: ["default", "delayed"], code: "<Tooltip><TooltipTrigger asChild><Button>Hover</Button></TooltipTrigger><TooltipContent>Info</TooltipContent></Tooltip>" },
]

export const SHADCN_COMPONENT_NAMES = SHADCN_COMPONENT_CATALOG.map((entry) => entry.name)

export const SHADCN_COMPONENT_CODE_MAP = Object.fromEntries(
  SHADCN_COMPONENT_CATALOG.map((entry) => [entry.name, entry.code]),
) as Record<string, string>

export const AI_BUILDER_PLAN_PROMPT_DESCRIPTION = `STEP 1 (AI via /api/ai/generate-plan): Understand the shadcn/ui library and produce strict Style JSON only.\nThe model must use only the allowed component names from the component catalog and set variants as props.\nNo state, handlers, or business logic are allowed in this step.`

export const AI_BUILDER_CONVERTER_PROMPT_DESCRIPTION = `STEP 2 (AI via /api/ai/generate-functions + deterministic /api/ai/orchestrate converter):\n- AI returns Function JSON that maps state, handlers, and render injections onto IDs from Style JSON.\n- Then a deterministic converter (no AI) assembles Style JSON + Function JSON into runnable code files.`

function buildCheatSheetHeader(title: string, filePath: string) {
  return `# ${title}\n# file: ${filePath}\n# source: https://ui.shadcn.com\n# total_components: ${SHADCN_COMPONENT_CATALOG.length}`
}

export function buildShadcnComponentVariantFile() {
  const rows = SHADCN_COMPONENT_CATALOG.map((entry, index) => {
    return `${String(index + 1).padStart(2, "0")}. ${entry.name}\n   variants: ${entry.variants.join(", ")}`
  })

  return `${buildCheatSheetHeader("AI Builder shadcn/ui Component + Variant Cheat Sheet", "docs/ai-cheatsheets/shadcn-components-variants.txt")}\n\n${rows.join("\n\n")}`
}

export function buildShadcnComponentCodeFile() {
  const rows = SHADCN_COMPONENT_CATALOG.map((entry, index) => {
    return `${String(index + 1).padStart(2, "0")}. ${entry.name}\n   variants: ${entry.variants.join(", ")}\n   code: ${entry.code}`
  })

  return `${buildCheatSheetHeader("AI Builder shadcn/ui Component + Code Cheat Sheet", "docs/ai-cheatsheets/shadcn-components-with-code.txt")}\n\n${rows.join("\n\n")}`
}

export const SHADCN_COMPONENT_VARIANT_CHEAT_SHEET_FILE = buildShadcnComponentVariantFile()
export const SHADCN_COMPONENT_CODE_CHEAT_SHEET_FILE = buildShadcnComponentCodeFile()
