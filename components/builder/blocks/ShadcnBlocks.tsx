"use client"

import * as React from "react"
import { toast } from "sonner"
import {
  ChevronDown, ChevronRight, Bold, Calendar as CalendarIcon, Check, Search, MoreHorizontal,
  Mail, User, Settings, Bell,
} from "lucide-react"
import type { BlockConfig } from "@/lib/builder/types"

import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogFooter, AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbLink, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Carousel, CarouselContent, CarouselItem, CarouselPrevious, CarouselNext } from "@/components/ui/carousel"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Checkbox } from "@/components/ui/checkbox"
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible"
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command"
import { ContextMenu, ContextMenuTrigger, ContextMenuContent, ContextMenuItem, ContextMenuSeparator } from "@/components/ui/context-menu"
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerFooter, DrawerTitle, DrawerDescription, DrawerClose } from "@/components/ui/drawer"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card"
import { Input } from "@/components/ui/input"
import { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Menubar, MenubarMenu, MenubarTrigger, MenubarContent, MenubarItem, MenubarSeparator } from "@/components/ui/menubar"
import { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink } from "@/components/ui/navigation-menu"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@/components/ui/pagination"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectGroup, SelectValue, SelectTrigger, SelectContent, SelectLabel, SelectItem } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell, TableCaption } from "@/components/ui/table"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Toggle } from "@/components/ui/toggle"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip"
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions } from "@/components/ui/item"
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription, EmptyContent, EmptyMedia } from "@/components/ui/empty"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Spinner } from "@/components/ui/spinner"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"

type P = { block: BlockConfig }
const s = (v: unknown, fallback: string) => (typeof v === "string" && v ? v : fallback)

function Pad({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className || ""}`}>{children}</div>
}

/* ----------------------------------- demos ---------------------------------- */
const UiAccordion = () => (
  <Pad>
    <Accordion type="single" collapsible className="w-full max-w-md">
      <AccordionItem value="1"><AccordionTrigger>Is it accessible?</AccordionTrigger><AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent></AccordionItem>
      <AccordionItem value="2"><AccordionTrigger>Is it styled?</AccordionTrigger><AccordionContent>Yes. It comes with default styles that match your theme.</AccordionContent></AccordionItem>
    </Accordion>
  </Pad>
)
const UiAlert = ({ block }: P) => (
  <Pad>
    <Alert variant={(block.variant as "default" | "destructive") || "default"} className="max-w-md">
      <Bell />
      <AlertTitle>{s(block.props.title, "Heads up!")}</AlertTitle>
      <AlertDescription>{s(block.props.text, "You can add components to your app using the CLI.")}</AlertDescription>
    </Alert>
  </Pad>
)
const UiAlertDialog = ({ block }: P) => (
  <Pad>
    <AlertDialog>
      <AlertDialogTrigger asChild><Button variant="outline">{s(block.props.text, "Show dialog")}</Button></AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle><AlertDialogDescription>This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction>Continue</AlertDialogAction></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </Pad>
)
const UiAspectRatio = () => (
  <Pad>
    <div className="max-w-sm"><AspectRatio ratio={16 / 9} className="bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">16 / 9</AspectRatio></div>
  </Pad>
)
const UiAvatar = () => (
  <Pad>
    <div className="flex gap-3">
      <Avatar><AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" /><AvatarFallback>CN</AvatarFallback></Avatar>
      <Avatar><AvatarFallback>AB</AvatarFallback></Avatar>
    </div>
  </Pad>
)
const UiBadge = ({ block }: P) => <Pad><Badge variant={(block.variant as "default" | "secondary" | "outline" | "destructive") || "default"}>{s(block.props.text, "Badge")}</Badge></Pad>
const UiBreadcrumb = () => (
  <Pad>
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem><BreadcrumbLink href="#">Home</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbLink href="#">Components</BreadcrumbLink></BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem><BreadcrumbPage>Breadcrumb</BreadcrumbPage></BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  </Pad>
)
const UiButton = ({ block }: P) => <Pad><Button variant={(block.variant as "default" | "secondary" | "outline" | "ghost" | "link" | "destructive") || "default"}>{s(block.props.text, "Button")}</Button></Pad>
const UiCalendar = () => <Pad><Calendar mode="single" className="rounded-md border w-fit" /></Pad>
const UiCard = ({ block }: P) => (
  <Pad>
    <Card className="max-w-sm">
      <CardHeader><CardTitle>{s(block.props.title, "Card title")}</CardTitle><CardDescription>{s(block.props.text, "Card description goes here.")}</CardDescription></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground">Card body content.</p></CardContent>
      <CardFooter><Button size="sm">Action</Button></CardFooter>
    </Card>
  </Pad>
)
const UiCarousel = () => (
  <Pad>
    <Carousel className="w-full max-w-xs mx-auto">
      <CarouselContent>
        {[1, 2, 3].map((i) => (
          <CarouselItem key={i}><Card><CardContent className="flex aspect-square items-center justify-center p-6"><span className="text-3xl font-semibold">{i}</span></CardContent></Card></CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious /><CarouselNext />
    </Carousel>
  </Pad>
)
const chartData = [{ m: "Jan", d: 186 }, { m: "Feb", d: 305 }, { m: "Mar", d: 237 }, { m: "Apr", d: 273 }]
const UiChart = () => (
  <Pad>
    <ChartContainer config={{ d: { label: "Desktop", color: "var(--color-green, var(--primary))" } }} className="h-[200px] w-full max-w-md">
      <BarChart data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="m" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="d" fill="var(--color-d)" radius={4} />
      </BarChart>
    </ChartContainer>
  </Pad>
)
const UiCheckbox = ({ block }: P) => <Pad><div className="flex items-center gap-2"><Checkbox id="cb" defaultChecked /><Label htmlFor="cb">{s(block.props.label, "Accept terms and conditions")}</Label></div></Pad>
const UiCollapsible = ({ block }: P) => (
  <Pad>
    <Collapsible className="w-full max-w-md space-y-2">
      <div className="flex items-center justify-between gap-4 rounded-md border px-4 py-2">
        <span className="text-sm font-medium">{s(block.props.text, "Toggle content")}</span>
        <CollapsibleTrigger asChild><Button variant="ghost" size="icon-sm"><ChevronDown className="size-4" /></Button></CollapsibleTrigger>
      </div>
      <CollapsibleContent className="space-y-2">
        <div className="rounded-md border px-4 py-2 text-sm">@radix-ui/react-collapsible</div>
        <div className="rounded-md border px-4 py-2 text-sm">@radix-ui/react-icons</div>
      </CollapsibleContent>
    </Collapsible>
  </Pad>
)
const UiCombobox = () => (
  <Pad>
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" className="w-[220px] justify-between">Select framework... <ChevronDown className="size-4 opacity-50" /></Button></PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search framework..." />
          <CommandList><CommandEmpty>No framework found.</CommandEmpty><CommandGroup>
            {["Next.js", "SvelteKit", "Astro", "Remix"].map((f) => <CommandItem key={f}>{f}</CommandItem>)}
          </CommandGroup></CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  </Pad>
)
const UiCommand = () => (
  <Pad>
    <Command className="rounded-lg border shadow-sm max-w-md">
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem><CalendarIcon className="mr-2 size-4" />Calendar</CommandItem>
          <CommandItem><User className="mr-2 size-4" />Profile</CommandItem>
          <CommandItem><Settings className="mr-2 size-4" />Settings</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  </Pad>
)
const UiContextMenu = ({ block }: P) => (
  <Pad>
    <ContextMenu>
      <ContextMenuTrigger className="flex h-[120px] w-full max-w-sm items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">{s(block.props.text, "Right click here")}</ContextMenuTrigger>
      <ContextMenuContent><ContextMenuItem>Back</ContextMenuItem><ContextMenuItem>Forward</ContextMenuItem><ContextMenuSeparator /><ContextMenuItem>Reload</ContextMenuItem></ContextMenuContent>
    </ContextMenu>
  </Pad>
)
const UiDataTable = () => (
  <Pad>
    <div className="rounded-md border max-w-lg">
      <Table>
        <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>
          {[["INV001", "Paid", "$250.00"], ["INV002", "Pending", "$150.00"], ["INV003", "Unpaid", "$350.00"]].map((r) => (
            <TableRow key={r[0]}><TableCell className="font-medium">{r[0]}</TableCell><TableCell>{r[1]}</TableCell><TableCell className="text-right">{r[2]}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  </Pad>
)
const UiDatePicker = () => (
  <Pad>
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" className="w-[240px] justify-start text-left font-normal"><CalendarIcon className="mr-2 size-4" />Pick a date</Button></PopoverTrigger>
      <PopoverContent className="w-auto p-0"><Calendar mode="single" /></PopoverContent>
    </Popover>
  </Pad>
)
const UiDialog = ({ block }: P) => (
  <Pad>
    <Dialog>
      <DialogTrigger asChild><Button variant="outline">{s(block.props.text, "Open dialog")}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Edit profile</DialogTitle><DialogDescription>Make changes to your profile here.</DialogDescription></DialogHeader>
        <div className="grid gap-3"><Label htmlFor="n">Name</Label><Input id="n" defaultValue="Pedro Duarte" /></div>
        <DialogFooter><Button>Save changes</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </Pad>
)
const UiDrawer = ({ block }: P) => (
  <Pad>
    <Drawer>
      <DrawerTrigger asChild><Button variant="outline">{s(block.props.text, "Open drawer")}</Button></DrawerTrigger>
      <DrawerContent>
        <DrawerHeader><DrawerTitle>Are you sure?</DrawerTitle><DrawerDescription>This action cannot be undone.</DrawerDescription></DrawerHeader>
        <DrawerFooter><Button>Submit</Button><DrawerClose asChild><Button variant="outline">Cancel</Button></DrawerClose></DrawerFooter>
      </DrawerContent>
    </Drawer>
  </Pad>
)
const UiDropdownMenu = ({ block }: P) => (
  <Pad>
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline">{s(block.props.text, "Open menu")}</Button></DropdownMenuTrigger>
      <DropdownMenuContent><DropdownMenuLabel>My Account</DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem>Profile</DropdownMenuItem><DropdownMenuItem>Billing</DropdownMenuItem><DropdownMenuItem>Settings</DropdownMenuItem></DropdownMenuContent>
    </DropdownMenu>
  </Pad>
)
const UiForm = () => (
  <Pad>
    <div className="grid gap-4 max-w-sm">
      <div className="grid gap-2"><Label htmlFor="fe">Email</Label><Input id="fe" type="email" placeholder="you@example.com" /><p className="text-[12px] text-muted-foreground">We&apos;ll never share your email.</p></div>
      <Button type="submit" className="w-fit">Submit</Button>
    </div>
  </Pad>
)
const UiHoverCard = ({ block }: P) => (
  <Pad>
    <HoverCard>
      <HoverCardTrigger asChild><Button variant="link">{s(block.props.text, "Hover me")}</Button></HoverCardTrigger>
      <HoverCardContent className="w-72"><p className="text-sm">The React framework — created and maintained by @vercel.</p></HoverCardContent>
    </HoverCard>
  </Pad>
)
const UiInput = ({ block }: P) => <Pad><Input className="max-w-sm" placeholder={s(block.props.placeholder, "Email")} /></Pad>
const UiInputOtp = () => (
  <Pad>
    <InputOTP maxLength={6}>
      <InputOTPGroup><InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} /></InputOTPGroup>
      <InputOTPSeparator />
      <InputOTPGroup><InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} /></InputOTPGroup>
    </InputOTP>
  </Pad>
)
const UiLabel = ({ block }: P) => <Pad><div className="grid gap-2 max-w-sm"><Label htmlFor="le">{s(block.props.text, "Your email address")}</Label><Input id="le" /></div></Pad>
const UiMenubar = () => (
  <Pad>
    <Menubar className="w-fit">
      <MenubarMenu><MenubarTrigger>File</MenubarTrigger><MenubarContent><MenubarItem>New Tab</MenubarItem><MenubarItem>New Window</MenubarItem><MenubarSeparator /><MenubarItem>Print</MenubarItem></MenubarContent></MenubarMenu>
      <MenubarMenu><MenubarTrigger>Edit</MenubarTrigger><MenubarContent><MenubarItem>Undo</MenubarItem><MenubarItem>Redo</MenubarItem></MenubarContent></MenubarMenu>
    </Menubar>
  </Pad>
)
const UiNavigationMenu = () => (
  <Pad>
    <NavigationMenu>
      <NavigationMenuList>
        <NavigationMenuItem><NavigationMenuTrigger>Getting started</NavigationMenuTrigger><NavigationMenuContent><div className="grid w-[280px] gap-1 p-3"><NavigationMenuLink>Introduction</NavigationMenuLink><NavigationMenuLink>Installation</NavigationMenuLink></div></NavigationMenuContent></NavigationMenuItem>
        <NavigationMenuItem><NavigationMenuLink className="px-4 py-2 text-sm">Docs</NavigationMenuLink></NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  </Pad>
)
const UiPagination = () => (
  <Pad>
    <Pagination>
      <PaginationContent>
        <PaginationItem><PaginationPrevious href="#" size="default" /></PaginationItem>
        <PaginationItem><PaginationLink href="#" size="icon">1</PaginationLink></PaginationItem>
        <PaginationItem><PaginationLink href="#" size="icon" isActive>2</PaginationLink></PaginationItem>
        <PaginationItem><PaginationLink href="#" size="icon">3</PaginationLink></PaginationItem>
        <PaginationItem><PaginationEllipsis /></PaginationItem>
        <PaginationItem><PaginationNext href="#" size="default" /></PaginationItem>
      </PaginationContent>
    </Pagination>
  </Pad>
)
const UiPopover = ({ block }: P) => (
  <Pad>
    <Popover>
      <PopoverTrigger asChild><Button variant="outline">{s(block.props.text, "Open popover")}</Button></PopoverTrigger>
      <PopoverContent className="w-80"><div className="grid gap-2"><h4 className="font-medium leading-none">Dimensions</h4><p className="text-sm text-muted-foreground">Set the dimensions for the layer.</p></div></PopoverContent>
    </Popover>
  </Pad>
)
const UiProgress = ({ block }: P) => <Pad><Progress value={typeof block.props.value === "number" ? (block.props.value as number) : 60} className="max-w-sm" /></Pad>
const UiRadioGroup = () => (
  <Pad>
    <RadioGroup defaultValue="comfortable" className="gap-2">
      <div className="flex items-center gap-2"><RadioGroupItem value="default" id="r1" /><Label htmlFor="r1">Default</Label></div>
      <div className="flex items-center gap-2"><RadioGroupItem value="comfortable" id="r2" /><Label htmlFor="r2">Comfortable</Label></div>
    </RadioGroup>
  </Pad>
)
const UiResizable = () => (
  <Pad>
    <ResizablePanelGroup direction="horizontal" className="max-w-md rounded-lg border h-[160px]">
      <ResizablePanel defaultSize={50}><div className="flex h-full items-center justify-center p-6"><span className="font-semibold">One</span></div></ResizablePanel>
      <ResizableHandle withHandle />
      <ResizablePanel defaultSize={50}><div className="flex h-full items-center justify-center p-6"><span className="font-semibold">Two</span></div></ResizablePanel>
    </ResizablePanelGroup>
  </Pad>
)
const UiScrollArea = () => (
  <Pad>
    <ScrollArea className="h-40 w-60 rounded-md border p-4">
      <div className="space-y-2">{Array.from({ length: 20 }).map((_, i) => <div key={i} className="text-sm">Item {i + 1}</div>)}</div>
    </ScrollArea>
  </Pad>
)
const UiSelect = () => (
  <Pad>
    <Select>
      <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a fruit" /></SelectTrigger>
      <SelectContent><SelectGroup><SelectLabel>Fruits</SelectLabel><SelectItem value="apple">Apple</SelectItem><SelectItem value="banana">Banana</SelectItem><SelectItem value="orange">Orange</SelectItem></SelectGroup></SelectContent>
    </Select>
  </Pad>
)
const UiSeparator = () => (
  <Pad>
    <div className="max-w-sm"><div className="space-y-1"><h4 className="text-sm font-medium">Radix Primitives</h4><p className="text-sm text-muted-foreground">An open-source UI component library.</p></div><Separator className="my-4" /><div className="flex h-5 items-center gap-4 text-sm"><span>Blog</span><Separator orientation="vertical" /><span>Docs</span><Separator orientation="vertical" /><span>Source</span></div></div>
  </Pad>
)
const UiSheet = ({ block }: P) => (
  <Pad>
    <Sheet>
      <SheetTrigger asChild><Button variant="outline">{s(block.props.text, "Open sheet")}</Button></SheetTrigger>
      <SheetContent><SheetHeader><SheetTitle>Edit profile</SheetTitle><SheetDescription>Make changes to your profile here.</SheetDescription></SheetHeader></SheetContent>
    </Sheet>
  </Pad>
)
const UiSidebar = () => (
  <Pad>
    <div className="rounded-lg border overflow-hidden max-w-[240px]">
      <div className="px-3 py-2 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">Application</div>
      <nav className="p-2 space-y-0.5">
        {[{ i: Mail, l: "Inbox" }, { i: CalendarIcon, l: "Calendar" }, { i: Search, l: "Search" }, { i: Settings, l: "Settings" }].map(({ i: Icon, l }) => (
          <button key={l} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-foreground hover:bg-accent transition-colors"><Icon className="size-4" />{l}</button>
        ))}
      </nav>
    </div>
  </Pad>
)
const UiSkeleton = () => (
  <Pad>
    <div className="flex items-center gap-4"><Skeleton className="size-12 rounded-full" /><div className="space-y-2"><Skeleton className="h-4 w-[200px]" /><Skeleton className="h-4 w-[160px]" /></div></div>
  </Pad>
)
const UiSlider = ({ block }: P) => <Pad><Slider defaultValue={[typeof block.props.value === "number" ? (block.props.value as number) : 50]} max={100} step={1} className="max-w-sm" /></Pad>
const UiSonner = ({ block }: P) => <Pad><Button variant="outline" onClick={() => toast("Event has been created", { description: "Sunday, December 03, 2025 at 9:00 AM" })}>{s(block.props.text, "Show toast")}</Button></Pad>
const UiSwitch = ({ block }: P) => <Pad><div className="flex items-center gap-2"><Switch id="sw" /><Label htmlFor="sw">{s(block.props.label, "Airplane mode")}</Label></div></Pad>
const UiTable = () => (
  <Pad>
    <Table className="max-w-lg">
      <TableCaption>A list of your recent invoices.</TableCaption>
      <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
      <TableBody><TableRow><TableCell className="font-medium">INV001</TableCell><TableCell>Paid</TableCell><TableCell className="text-right">$250.00</TableCell></TableRow><TableRow><TableCell className="font-medium">INV002</TableCell><TableCell>Pending</TableCell><TableCell className="text-right">$150.00</TableCell></TableRow></TableBody>
    </Table>
  </Pad>
)
const UiTabs = () => (
  <Pad>
    <Tabs defaultValue="account" className="w-[360px]">
      <TabsList><TabsTrigger value="account">Account</TabsTrigger><TabsTrigger value="password">Password</TabsTrigger></TabsList>
      <TabsContent value="account"><p className="text-sm text-muted-foreground pt-2">Make changes to your account here.</p></TabsContent>
      <TabsContent value="password"><p className="text-sm text-muted-foreground pt-2">Change your password here.</p></TabsContent>
    </Tabs>
  </Pad>
)
const UiTextarea = ({ block }: P) => <Pad><Textarea className="max-w-sm" placeholder={s(block.props.placeholder, "Type your message here.")} /></Pad>
const UiToggle = ({ block }: P) => <Pad><Toggle aria-label="Toggle bold" variant={(block.variant as "default" | "outline") || "default"}><Bold className="size-4" />{s(block.props.text, "Bold")}</Toggle></Pad>
const UiToggleGroup = () => (
  <Pad>
    <ToggleGroup type="single" defaultValue="center" variant="outline"><ToggleGroupItem value="left">Left</ToggleGroupItem><ToggleGroupItem value="center">Center</ToggleGroupItem><ToggleGroupItem value="right">Right</ToggleGroupItem></ToggleGroup>
  </Pad>
)
const UiTooltip = ({ block }: P) => (
  <Pad>
    <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline">{s(block.props.text, "Hover me")}</Button></TooltipTrigger><TooltipContent><p>Add to library</p></TooltipContent></Tooltip></TooltipProvider>
  </Pad>
)
const UiTypography = () => (
  <Pad>
    <div className="max-w-2xl">
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight">The Joke Tax Chronicles</h1>
      <p className="leading-7 mt-4 text-muted-foreground">Once upon a time, in a far-off land, there was a king who taxed his subjects&apos; jokes.</p>
      <blockquote className="mt-4 border-l-2 pl-6 italic">&ldquo;After all,&rdquo; he said, &ldquo;everyone enjoys a good joke.&rdquo;</blockquote>
      <ul className="my-4 ml-6 list-disc [&>li]:mt-1 text-sm"><li>1st level of puns</li><li>2nd level of jokes</li><li>3rd level of one-liners</li></ul>
    </div>
  </Pad>
)
const UiField = () => (
  <Pad>
    <Field className="max-w-sm"><FieldLabel htmlFor="fld">Username</FieldLabel><Input id="fld" placeholder="shadcn" /><FieldDescription>This is your public display name.</FieldDescription></Field>
  </Pad>
)
const UiInputGroup = () => (
  <Pad>
    <InputGroup className="max-w-sm"><InputGroupAddon><Search className="size-4" /></InputGroupAddon><InputGroupInput placeholder="Search..." /></InputGroup>
  </Pad>
)
const UiItem = () => (
  <Pad>
    <Item variant="outline" className="max-w-sm">
      <ItemMedia><Avatar><AvatarFallback>CN</AvatarFallback></Avatar></ItemMedia>
      <ItemContent><ItemTitle>Evil Rabbit</ItemTitle><ItemDescription>Last seen 5 months ago</ItemDescription></ItemContent>
      <ItemActions><Button size="icon-sm" variant="ghost"><MoreHorizontal className="size-4" /></Button></ItemActions>
    </Item>
  </Pad>
)
const UiEmpty = () => (
  <Pad>
    <Empty className="max-w-sm border rounded-lg">
      <EmptyHeader><EmptyMedia variant="icon"><Search /></EmptyMedia><EmptyTitle>No results found</EmptyTitle><EmptyDescription>Try adjusting your search filters.</EmptyDescription></EmptyHeader>
      <EmptyContent><Button size="sm" variant="outline">Clear filters</Button></EmptyContent>
    </Empty>
  </Pad>
)
const UiKbd = () => <Pad><KbdGroup><Kbd>Ctrl</Kbd><Kbd>B</Kbd></KbdGroup></Pad>
const UiSpinner = () => <Pad><div className="flex items-center gap-3 text-muted-foreground"><Spinner /><span className="text-sm">Loading…</span></div></Pad>

export const shadcnRenderers: Record<string, React.ComponentType<P>> = {
  "ui-accordion": UiAccordion,
  "ui-alert": UiAlert,
  "ui-alert-dialog": UiAlertDialog,
  "ui-aspect-ratio": UiAspectRatio,
  "ui-avatar": UiAvatar,
  "ui-badge": UiBadge,
  "ui-breadcrumb": UiBreadcrumb,
  "ui-button": UiButton,
  "ui-calendar": UiCalendar,
  "ui-card": UiCard,
  "ui-carousel": UiCarousel,
  "ui-chart": UiChart,
  "ui-checkbox": UiCheckbox,
  "ui-collapsible": UiCollapsible,
  "ui-combobox": UiCombobox,
  "ui-command": UiCommand,
  "ui-context-menu": UiContextMenu,
  "ui-data-table": UiDataTable,
  "ui-date-picker": UiDatePicker,
  "ui-dialog": UiDialog,
  "ui-drawer": UiDrawer,
  "ui-dropdown-menu": UiDropdownMenu,
  "ui-form": UiForm,
  "ui-hover-card": UiHoverCard,
  "ui-input": UiInput,
  "ui-input-otp": UiInputOtp,
  "ui-label": UiLabel,
  "ui-menubar": UiMenubar,
  "ui-navigation-menu": UiNavigationMenu,
  "ui-pagination": UiPagination,
  "ui-popover": UiPopover,
  "ui-progress": UiProgress,
  "ui-radio-group": UiRadioGroup,
  "ui-resizable": UiResizable,
  "ui-scroll-area": UiScrollArea,
  "ui-select": UiSelect,
  "ui-separator": UiSeparator,
  "ui-sheet": UiSheet,
  "ui-sidebar": UiSidebar,
  "ui-skeleton": UiSkeleton,
  "ui-slider": UiSlider,
  "ui-sonner": UiSonner,
  "ui-switch": UiSwitch,
  "ui-table": UiTable,
  "ui-tabs": UiTabs,
  "ui-textarea": UiTextarea,
  "ui-toast": UiSonner,
  "ui-toggle": UiToggle,
  "ui-toggle-group": UiToggleGroup,
  "ui-tooltip": UiTooltip,
  "ui-typography": UiTypography,
  "ui-field": UiField,
  "ui-input-group": UiInputGroup,
  "ui-item": UiItem,
  "ui-empty": UiEmpty,
  "ui-kbd": UiKbd,
  "ui-spinner": UiSpinner,
}
