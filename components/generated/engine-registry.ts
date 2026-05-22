// Engine Registry — runtime component map for dynamic rendering.
//
// Maps string keys (from SiteManifest elements) to actual React components.
// This is the bridge between JSON manifests and the rendered DOM.
// Never uses eval() — all mappings are explicit, typed imports.
//
// Used by the Syra Renderer to dynamically render generated pages
// without compiling them into static files at build time.

"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"
import {
  Alert,
  AlertTitle,
  AlertDescription,
} from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"
import {
  HoverCard,
  HoverCardTrigger,
  HoverCardContent,
} from "@/components/ui/hover-card"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from "@/components/ui/carousel"
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from "@/components/ui/pagination"
import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
} from "@/components/ui/navigation-menu"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { Toggle } from "@/components/ui/toggle"
import { Calendar } from "@/components/ui/calendar"

// The registry maps AI-facing component names ("button", "card", etc.)
// to their React implementations. Client components (Dialog, Dropdown, etc.)
// are marked with isClient: true for safe hydration.

export interface RegistryComponent {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: React.FC<any>
  isClient: boolean
  voidElement: boolean
}

export const ComponentRegistry: Record<string, RegistryComponent> = {
  // ── Layout ─────────────────────────────────────────────────
  button: { component: Button, isClient: false, voidElement: false },
  badge: { component: Badge, isClient: false, voidElement: false },
  card: { component: Card, isClient: false, voidElement: false },
  separator: { component: Separator, isClient: false, voidElement: true },
  skeleton: { component: Skeleton, isClient: false, voidElement: true },
  progress: { component: Progress, isClient: false, voidElement: true },
  avatar: { component: Avatar, isClient: false, voidElement: false },
  label: { component: Label, isClient: false, voidElement: false },
  input: { component: Input, isClient: false, voidElement: true },
  textarea: { component: Textarea, isClient: false, voidElement: true },

  // Card subcomponents
  cardheader: { component: CardHeader, isClient: false, voidElement: false },
  cardtitle: { component: CardTitle, isClient: false, voidElement: false },
  carddescription: { component: CardDescription, isClient: false, voidElement: false },
  cardcontent: { component: CardContent, isClient: false, voidElement: false },
  cardfooter: { component: CardFooter, isClient: false, voidElement: false },

  // Avatar subcomponents
  avatarimage: { component: AvatarImage, isClient: false, voidElement: true },
  avatarfallback: { component: AvatarFallback, isClient: false, voidElement: false },

  // ── Client Components ──────────────────────────────────────
  accordion: { component: Accordion, isClient: true, voidElement: false },
  accordionitem: { component: AccordionItem, isClient: true, voidElement: false },
  accordiontrigger: { component: AccordionTrigger, isClient: true, voidElement: false },
  accordioncontent: { component: AccordionContent, isClient: true, voidElement: false },
  tabs: { component: Tabs, isClient: true, voidElement: false },
  tabslist: { component: TabsList, isClient: true, voidElement: false },
  tabstrigger: { component: TabsTrigger, isClient: true, voidElement: false },
  tabscontent: { component: TabsContent, isClient: true, voidElement: false },
  dialog: { component: Dialog, isClient: true, voidElement: false },
  dialogtrigger: { component: DialogTrigger, isClient: true, voidElement: false },
  dialogcontent: { component: DialogContent, isClient: true, voidElement: false },
  dialogheader: { component: DialogHeader, isClient: true, voidElement: false },
  dialogtitle: { component: DialogTitle, isClient: true, voidElement: false },
  dialogdescription: { component: DialogDescription, isClient: true, voidElement: false },
  select: { component: Select, isClient: true, voidElement: false },
  selecttrigger: { component: SelectTrigger, isClient: true, voidElement: false },
  selectvalue: { component: SelectValue, isClient: true, voidElement: true },
  selectcontent: { component: SelectContent, isClient: true, voidElement: false },
  selectitem: { component: SelectItem, isClient: true, voidElement: false },
  checkbox: { component: Checkbox, isClient: true, voidElement: true },
  switch: { component: Switch, isClient: true, voidElement: true },
  tooltip: { component: Tooltip, isClient: true, voidElement: false },
  tooltiptrigger: { component: TooltipTrigger, isClient: true, voidElement: false },
  tooltipcontent: { component: TooltipContent, isClient: true, voidElement: false },
  hovercard: { component: HoverCard, isClient: true, voidElement: false },
  hovercardtrigger: { component: HoverCardTrigger, isClient: true, voidElement: false },
  hovercardcontent: { component: HoverCardContent, isClient: true, voidElement: false },
  popover: { component: Popover, isClient: true, voidElement: false },
  popovertrigger: { component: PopoverTrigger, isClient: true, voidElement: false },
  popovercontent: { component: PopoverContent, isClient: true, voidElement: false },
  carousel: { component: Carousel, isClient: true, voidElement: false },
  carouselcontent: { component: CarouselContent, isClient: true, voidElement: false },
  carouselitem: { component: CarouselItem, isClient: true, voidElement: false },
  toggle: { component: Toggle, isClient: true, voidElement: false },
  slider: { component: Slider, isClient: true, voidElement: true },
  calendar: { component: Calendar, isClient: true, voidElement: true },
  scrollarea: { component: ScrollArea, isClient: false, voidElement: false },
  scrollbar: { component: ScrollBar, isClient: false, voidElement: true },

  // ── Data ───────────────────────────────────────────────────
  table: { component: Table, isClient: false, voidElement: false },
  tableheader: { component: TableHeader, isClient: false, voidElement: false },
  tablebody: { component: TableBody, isClient: false, voidElement: false },
  tablerow: { component: TableRow, isClient: false, voidElement: false },
  tablehead: { component: TableHead, isClient: false, voidElement: false },
  tablecell: { component: TableCell, isClient: false, voidElement: false },

  // ── Feedback ───────────────────────────────────────────────
  alert: { component: Alert, isClient: false, voidElement: false },
  alerttitle: { component: AlertTitle, isClient: false, voidElement: false },
  alertdescription: { component: AlertDescription, isClient: false, voidElement: false },
  alertdialog: { component: AlertDialog, isClient: true, voidElement: false },

  // ── Navigation ─────────────────────────────────────────────
  breadcrumb: { component: Breadcrumb, isClient: false, voidElement: false },
  breadcrumblist: { component: BreadcrumbList, isClient: false, voidElement: false },
  breadcrumbitem: { component: BreadcrumbItem, isClient: false, voidElement: false },
  breadcrumblink: { component: BreadcrumbLink, isClient: false, voidElement: false },
  breadcrumbpage: { component: BreadcrumbPage, isClient: false, voidElement: false },
  breadcrumbseparator: { component: BreadcrumbSeparator, isClient: false, voidElement: false },
  pagination: { component: Pagination, isClient: false, voidElement: false },
  navigationmenu: { component: NavigationMenu, isClient: false, voidElement: false },

  // ── Forms ──────────────────────────────────────────────────
  radiogroup: { component: RadioGroup, isClient: false, voidElement: false },
  radiogroupitem: { component: RadioGroupItem, isClient: false, voidElement: true },

  // ── Resizable ──────────────────────────────────────────────
  resizable: { component: ResizablePanelGroup, isClient: false, voidElement: false },
  resizablepanel: { component: ResizablePanel, isClient: false, voidElement: false },
  resizablehandle: { component: ResizableHandle, isClient: false, voidElement: false },
}

export function getComponent(name: string): RegistryComponent | undefined {
  return ComponentRegistry[name]
}
