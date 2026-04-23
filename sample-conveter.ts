import fs from 'fs'
import path from 'path'

// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface UINode {
  id?: string
  name: string
  props?: Record<string, unknown>
  text?: string
  condition?: string
  slot?: string
  repeat?: { source: string; item: string; key?: string }
  children?: UINode[]
}

export interface UITreeRoot {
  type: 'ui-tree'
  version: string
  importsMode?: 'auto' | 'manual'
  component: UINode
}

export interface ConversionResult {
  imports: string
  component: string
  filePath: string
  stateVars: string[]
  handlerNames: string[]
}

// ─── IMPORT MAP ───────────────────────────────────────────────────────────────

// Every export from every vendored shadcn/ui file (see components/ui/).
// Kept exhaustive on purpose so the AI Style stage can freely pick any
// shadcn primitive without hallucinating component names.
export const IMPORT_MAP: Record<string, string> = {
  Accordion: '@/components/ui/accordion',
  AccordionContent: '@/components/ui/accordion',
  AccordionItem: '@/components/ui/accordion',
  AccordionTrigger: '@/components/ui/accordion',
  Alert: '@/components/ui/alert',
  AlertDescription: '@/components/ui/alert',
  AlertTitle: '@/components/ui/alert',
  AlertDialog: '@/components/ui/alert-dialog',
  AlertDialogAction: '@/components/ui/alert-dialog',
  AlertDialogCancel: '@/components/ui/alert-dialog',
  AlertDialogContent: '@/components/ui/alert-dialog',
  AlertDialogDescription: '@/components/ui/alert-dialog',
  AlertDialogFooter: '@/components/ui/alert-dialog',
  AlertDialogHeader: '@/components/ui/alert-dialog',
  AlertDialogOverlay: '@/components/ui/alert-dialog',
  AlertDialogPortal: '@/components/ui/alert-dialog',
  AlertDialogTitle: '@/components/ui/alert-dialog',
  AlertDialogTrigger: '@/components/ui/alert-dialog',
  AspectRatio: '@/components/ui/aspect-ratio',
  Avatar: '@/components/ui/avatar',
  AvatarFallback: '@/components/ui/avatar',
  AvatarImage: '@/components/ui/avatar',
  Badge: '@/components/ui/badge',
  Breadcrumb: '@/components/ui/breadcrumb',
  BreadcrumbEllipsis: '@/components/ui/breadcrumb',
  BreadcrumbItem: '@/components/ui/breadcrumb',
  BreadcrumbLink: '@/components/ui/breadcrumb',
  BreadcrumbList: '@/components/ui/breadcrumb',
  BreadcrumbPage: '@/components/ui/breadcrumb',
  BreadcrumbSeparator: '@/components/ui/breadcrumb',
  Button: '@/components/ui/button',
  Calendar: '@/components/ui/calendar',
  CalendarDayButton: '@/components/ui/calendar',
  Card: '@/components/ui/card',
  CardAction: '@/components/ui/card',
  CardContent: '@/components/ui/card',
  CardDescription: '@/components/ui/card',
  CardFooter: '@/components/ui/card',
  CardHeader: '@/components/ui/card',
  CardTitle: '@/components/ui/card',
  Carousel: '@/components/ui/carousel',
  CarouselContent: '@/components/ui/carousel',
  CarouselItem: '@/components/ui/carousel',
  CarouselNext: '@/components/ui/carousel',
  CarouselPrevious: '@/components/ui/carousel',
  Checkbox: '@/components/ui/checkbox',
  Collapsible: '@/components/ui/collapsible',
  CollapsibleContent: '@/components/ui/collapsible',
  CollapsibleTrigger: '@/components/ui/collapsible',
  Command: '@/components/ui/command',
  CommandDialog: '@/components/ui/command',
  CommandEmpty: '@/components/ui/command',
  CommandGroup: '@/components/ui/command',
  CommandInput: '@/components/ui/command',
  CommandItem: '@/components/ui/command',
  CommandList: '@/components/ui/command',
  CommandSeparator: '@/components/ui/command',
  CommandShortcut: '@/components/ui/command',
  ContextMenu: '@/components/ui/context-menu',
  ContextMenuCheckboxItem: '@/components/ui/context-menu',
  ContextMenuContent: '@/components/ui/context-menu',
  ContextMenuGroup: '@/components/ui/context-menu',
  ContextMenuItem: '@/components/ui/context-menu',
  ContextMenuLabel: '@/components/ui/context-menu',
  ContextMenuPortal: '@/components/ui/context-menu',
  ContextMenuRadioGroup: '@/components/ui/context-menu',
  ContextMenuRadioItem: '@/components/ui/context-menu',
  ContextMenuSeparator: '@/components/ui/context-menu',
  ContextMenuShortcut: '@/components/ui/context-menu',
  ContextMenuSub: '@/components/ui/context-menu',
  ContextMenuSubContent: '@/components/ui/context-menu',
  ContextMenuSubTrigger: '@/components/ui/context-menu',
  ContextMenuTrigger: '@/components/ui/context-menu',
  Dialog: '@/components/ui/dialog',
  DialogClose: '@/components/ui/dialog',
  DialogContent: '@/components/ui/dialog',
  DialogDescription: '@/components/ui/dialog',
  DialogFooter: '@/components/ui/dialog',
  DialogHeader: '@/components/ui/dialog',
  DialogOverlay: '@/components/ui/dialog',
  DialogPortal: '@/components/ui/dialog',
  DialogTitle: '@/components/ui/dialog',
  DialogTrigger: '@/components/ui/dialog',
  Drawer: '@/components/ui/drawer',
  DrawerClose: '@/components/ui/drawer',
  DrawerContent: '@/components/ui/drawer',
  DrawerDescription: '@/components/ui/drawer',
  DrawerFooter: '@/components/ui/drawer',
  DrawerHeader: '@/components/ui/drawer',
  DrawerOverlay: '@/components/ui/drawer',
  DrawerPortal: '@/components/ui/drawer',
  DrawerTitle: '@/components/ui/drawer',
  DrawerTrigger: '@/components/ui/drawer',
  DropdownMenu: '@/components/ui/dropdown-menu',
  DropdownMenuCheckboxItem: '@/components/ui/dropdown-menu',
  DropdownMenuContent: '@/components/ui/dropdown-menu',
  DropdownMenuGroup: '@/components/ui/dropdown-menu',
  DropdownMenuItem: '@/components/ui/dropdown-menu',
  DropdownMenuLabel: '@/components/ui/dropdown-menu',
  DropdownMenuPortal: '@/components/ui/dropdown-menu',
  DropdownMenuRadioGroup: '@/components/ui/dropdown-menu',
  DropdownMenuRadioItem: '@/components/ui/dropdown-menu',
  DropdownMenuSeparator: '@/components/ui/dropdown-menu',
  DropdownMenuShortcut: '@/components/ui/dropdown-menu',
  DropdownMenuSub: '@/components/ui/dropdown-menu',
  DropdownMenuSubContent: '@/components/ui/dropdown-menu',
  DropdownMenuSubTrigger: '@/components/ui/dropdown-menu',
  DropdownMenuTrigger: '@/components/ui/dropdown-menu',
  Form: '@/components/ui/form',
  FormControl: '@/components/ui/form',
  FormDescription: '@/components/ui/form',
  FormField: '@/components/ui/form',
  FormItem: '@/components/ui/form',
  FormLabel: '@/components/ui/form',
  FormMessage: '@/components/ui/form',
  HoverCard: '@/components/ui/hover-card',
  HoverCardContent: '@/components/ui/hover-card',
  HoverCardTrigger: '@/components/ui/hover-card',
  Input: '@/components/ui/input',
  InputOTP: '@/components/ui/input-otp',
  InputOTPGroup: '@/components/ui/input-otp',
  InputOTPSeparator: '@/components/ui/input-otp',
  InputOTPSlot: '@/components/ui/input-otp',
  Label: '@/components/ui/label',
  Menubar: '@/components/ui/menubar',
  MenubarCheckboxItem: '@/components/ui/menubar',
  MenubarContent: '@/components/ui/menubar',
  MenubarGroup: '@/components/ui/menubar',
  MenubarItem: '@/components/ui/menubar',
  MenubarLabel: '@/components/ui/menubar',
  MenubarMenu: '@/components/ui/menubar',
  MenubarPortal: '@/components/ui/menubar',
  MenubarRadioGroup: '@/components/ui/menubar',
  MenubarRadioItem: '@/components/ui/menubar',
  MenubarSeparator: '@/components/ui/menubar',
  MenubarShortcut: '@/components/ui/menubar',
  MenubarSub: '@/components/ui/menubar',
  MenubarSubContent: '@/components/ui/menubar',
  MenubarSubTrigger: '@/components/ui/menubar',
  MenubarTrigger: '@/components/ui/menubar',
  NavigationMenu: '@/components/ui/navigation-menu',
  NavigationMenuContent: '@/components/ui/navigation-menu',
  NavigationMenuIndicator: '@/components/ui/navigation-menu',
  NavigationMenuItem: '@/components/ui/navigation-menu',
  NavigationMenuLink: '@/components/ui/navigation-menu',
  NavigationMenuList: '@/components/ui/navigation-menu',
  NavigationMenuTrigger: '@/components/ui/navigation-menu',
  NavigationMenuViewport: '@/components/ui/navigation-menu',
  Pagination: '@/components/ui/pagination',
  PaginationContent: '@/components/ui/pagination',
  PaginationEllipsis: '@/components/ui/pagination',
  PaginationItem: '@/components/ui/pagination',
  PaginationLink: '@/components/ui/pagination',
  PaginationNext: '@/components/ui/pagination',
  PaginationPrevious: '@/components/ui/pagination',
  Popover: '@/components/ui/popover',
  PopoverAnchor: '@/components/ui/popover',
  PopoverContent: '@/components/ui/popover',
  PopoverTrigger: '@/components/ui/popover',
  Progress: '@/components/ui/progress',
  RadioGroup: '@/components/ui/radio-group',
  RadioGroupItem: '@/components/ui/radio-group',
  ResizableHandle: '@/components/ui/resizable',
  ResizablePanel: '@/components/ui/resizable',
  ResizablePanelGroup: '@/components/ui/resizable',
  ScrollArea: '@/components/ui/scroll-area',
  ScrollBar: '@/components/ui/scroll-area',
  Select: '@/components/ui/select',
  SelectContent: '@/components/ui/select',
  SelectGroup: '@/components/ui/select',
  SelectItem: '@/components/ui/select',
  SelectLabel: '@/components/ui/select',
  SelectScrollDownButton: '@/components/ui/select',
  SelectScrollUpButton: '@/components/ui/select',
  SelectSeparator: '@/components/ui/select',
  SelectTrigger: '@/components/ui/select',
  SelectValue: '@/components/ui/select',
  Separator: '@/components/ui/separator',
  Sheet: '@/components/ui/sheet',
  SheetClose: '@/components/ui/sheet',
  SheetContent: '@/components/ui/sheet',
  SheetDescription: '@/components/ui/sheet',
  SheetFooter: '@/components/ui/sheet',
  SheetHeader: '@/components/ui/sheet',
  SheetTitle: '@/components/ui/sheet',
  SheetTrigger: '@/components/ui/sheet',
  Sidebar: '@/components/ui/sidebar',
  SidebarContent: '@/components/ui/sidebar',
  SidebarFooter: '@/components/ui/sidebar',
  SidebarGroup: '@/components/ui/sidebar',
  SidebarGroupAction: '@/components/ui/sidebar',
  SidebarGroupContent: '@/components/ui/sidebar',
  SidebarGroupLabel: '@/components/ui/sidebar',
  SidebarHeader: '@/components/ui/sidebar',
  SidebarInput: '@/components/ui/sidebar',
  SidebarInset: '@/components/ui/sidebar',
  SidebarMenu: '@/components/ui/sidebar',
  SidebarMenuAction: '@/components/ui/sidebar',
  SidebarMenuBadge: '@/components/ui/sidebar',
  SidebarMenuButton: '@/components/ui/sidebar',
  SidebarMenuItem: '@/components/ui/sidebar',
  SidebarMenuSkeleton: '@/components/ui/sidebar',
  SidebarMenuSub: '@/components/ui/sidebar',
  SidebarMenuSubButton: '@/components/ui/sidebar',
  SidebarMenuSubItem: '@/components/ui/sidebar',
  SidebarProvider: '@/components/ui/sidebar',
  SidebarRail: '@/components/ui/sidebar',
  SidebarSeparator: '@/components/ui/sidebar',
  SidebarTrigger: '@/components/ui/sidebar',
  Skeleton: '@/components/ui/skeleton',
  Slider: '@/components/ui/slider',
  Toaster: '@/components/ui/sonner',
  Switch: '@/components/ui/switch',
  Table: '@/components/ui/table',
  TableBody: '@/components/ui/table',
  TableCaption: '@/components/ui/table',
  TableCell: '@/components/ui/table',
  TableFooter: '@/components/ui/table',
  TableHead: '@/components/ui/table',
  TableHeader: '@/components/ui/table',
  TableRow: '@/components/ui/table',
  Tabs: '@/components/ui/tabs',
  TabsContent: '@/components/ui/tabs',
  TabsList: '@/components/ui/tabs',
  TabsTrigger: '@/components/ui/tabs',
  Textarea: '@/components/ui/textarea',
  Toggle: '@/components/ui/toggle',
  ToggleGroup: '@/components/ui/toggle-group',
  ToggleGroupItem: '@/components/ui/toggle-group',
  Tooltip: '@/components/ui/tooltip',
  TooltipContent: '@/components/ui/tooltip',
  TooltipProvider: '@/components/ui/tooltip',
  TooltipTrigger: '@/components/ui/tooltip',
  // React-Router navigation primitive. The converter auto-rewrites
  // <a href="/..."> to <Link to="/..."> so in-app navigation doesn't
  // reload the whole page.
  Link: 'react-router-dom',
  NavLink: 'react-router-dom',
  Outlet: 'react-router-dom',
}

// ─── ALIAS MAP ────────────────────────────────────────────────────────────────

const ALIAS_MAP: Record<string, string> = {
  button: 'Button',
  card: 'Card',
  'card-header': 'CardHeader',
  'card-title': 'CardTitle',
  'card-description': 'CardDescription',
  'card-content': 'CardContent',
  'card-footer': 'CardFooter',
  dialog: 'Dialog',
  'alert-dialog': 'AlertDialog',
  input: 'Input',
  label: 'Label',
  textarea: 'Textarea',
  badge: 'Badge',
  tabs: 'Tabs',
  select: 'Select',
  popover: 'Popover',
  command: 'Command',
  accordion: 'Accordion',
  sheet: 'Sheet',
  drawer: 'Drawer',
  dropdown: 'DropdownMenu',
  'dropdown-menu': 'DropdownMenu',
  table: 'Table',
  toggle: 'Toggle',
  tooltip: 'Tooltip',
  avatar: 'Avatar',
  skeleton: 'Skeleton',
  separator: 'Separator',
  slider: 'Slider',
  switch: 'Switch',
  progress: 'Progress',
  calendar: 'Calendar',
  checkbox: 'Checkbox',
  form: 'Form',
  sidebar: 'Sidebar',
  carousel: 'Carousel',
  breadcrumb: 'Breadcrumb',
  pagination: 'Pagination',
  menubar: 'Menubar',
  'navigation-menu': 'NavigationMenu',
  'input-otp': 'InputOTP',
  resizable: 'Resizable',
  'hover-card': 'HoverCard',
  collapsible: 'Collapsible',
  'scroll-area': 'ScrollArea',
  'toggle-group': 'ToggleGroup',
  'aspect-ratio': 'AspectRatio',
}

const HTML_TAGS = new Set([
  'div', 'span', 'p', 'a', 'button', 'input', 'textarea', 'label', 'form',
  'section', 'article', 'main', 'header', 'footer', 'nav', 'aside',
  'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img',
  'table', 'thead', 'tbody', 'tr', 'td', 'th', 'select', 'option',
  'video', 'audio', 'canvas', 'svg', 'path', 'g', 'circle', 'rect', 'line',
  'polyline', 'polygon', 'pre', 'code', 'blockquote', 'hr', 'br', 'iframe',
])

// ─── REGEX ────────────────────────────────────────────────────────────────────

const REGEX = {
  COMPONENT_NAME: /^[A-Z][A-Za-z0-9]+$/,
  ALIAS_NAME: /^[a-z][a-z0-9-]*$/,
  STATE_BINDING: /^\$state\.([A-Za-z_][A-Za-z0-9_]*)$/,
  HANDLER_BINDING: /^\$handler\.([A-Za-z_][A-Za-z0-9_]*)$/,
  BOOLEAN_TRUE: /^true$/,
  BOOLEAN_FALSE: /^false$/,
  NUMBER: /^\d+(\.\d+)?$/,
}

// ─── NORMALIZE ────────────────────────────────────────────────────────────────

// Every component name the Style stage is allowed to emit. Derived from
// IMPORT_MAP so we never drift: if we vendor a new shadcn file, add its
// exports to IMPORT_MAP and both systems pick it up automatically.
export const SUPPORTED_COMPONENTS: Set<string> = new Set(Object.keys(IMPORT_MAP))

// A PascalCase name ending in "Icon" is assumed to be a HeroIcon. Imports
// are resolved at the buildImports stage (pulled from @heroicons/react/24/outline).
function isHeroIconName(name: string): boolean {
  return REGEX.COMPONENT_NAME.test(name) && /Icon$/.test(name) && name !== 'Icon'
}

function normalizeName(name: string): string {
  if (HTML_TAGS.has(name)) return name
  if (REGEX.ALIAS_NAME.test(name) && ALIAS_MAP[name]) {
    const mapped = ALIAS_MAP[name]
    return SUPPORTED_COMPONENTS.has(mapped) ? mapped : 'div'
  }
  if (REGEX.COMPONENT_NAME.test(name)) {
    // A PascalCase component is only emitted if (a) we know where to import
    // it from, and (b) it's actually in the scaffold's vendored UI set.
    // HeroIcons (any PascalCase name ending in "Icon") are also allowed.
    if (IMPORT_MAP[name] && SUPPORTED_COMPONENTS.has(name)) return name
    if (isHeroIconName(name)) return name
    return 'div'
  }
  return 'div'
}

function normalizeTree(node: UINode): UINode {
  // Internal <a href="/..."> is rewritten to <Link to="/..."> from
  // react-router-dom so in-app navigation doesn't full-reload the page.
  // External links (http://, https://, mailto:, #anchor) stay as <a>.
  if (node.name === 'a' && node.props && typeof node.props.href === 'string') {
    const href = node.props.href as string
    if (href.startsWith('/') && !href.startsWith('//')) {
      const { href: _, ...rest } = node.props as Record<string, unknown>
      return {
        ...node,
        name: 'Link',
        props: { ...rest, to: href },
        children: node.children?.map(normalizeTree),
      }
    }
  }
  return {
    ...node,
    name: normalizeName(node.name),
    children: node.children?.map(normalizeTree),
  }
}

// ─── COLLECT STATE + HANDLERS ─────────────────────────────────────────────────

interface Collected {
  states: Set<string>
  handlers: Set<string>
  components: Set<string>
}

function collect(node: UINode, acc: Collected): void {
  acc.components.add(node.name)

  for (const val of Object.values(node.props ?? {})) {
    const s = String(val)
    const stateMatch = s.match(REGEX.STATE_BINDING)
    const handlerMatch = s.match(REGEX.HANDLER_BINDING)
    if (stateMatch) acc.states.add(stateMatch[1])
    if (handlerMatch) acc.handlers.add(handlerMatch[1])
  }

  node.children?.forEach(c => collect(c, acc))
}

// Any handler named `set<Capitalized>` that matches an existing `$state.<x>`
// collides with the useState setter the converter already creates. Drop it
// from the handlers set so the page uses the local setter directly — this
// stops the Logic stage from having to emit bogus stub setters and keeps
// pages self-contained (no external Props plumbing for state updates).
function pruneLocalSetterHandlers(acc: Collected): void {
  const states = acc.states
  for (const h of [...acc.handlers]) {
    const match = h.match(/^set([A-Z][A-Za-z0-9_]*)$/)
    if (!match) continue
    const stateName = match[1].charAt(0).toLowerCase() + match[1].slice(1)
    if (states.has(stateName)) {
      acc.handlers.delete(h)
    }
  }
}

// ─── INITIAL VALUE HEURISTIC ──────────────────────────────────────────────────

function initialValue(name: string): string {
  if (/open|show|visible|active|checked|enabled|loading|disabled|dark/i.test(name)) return 'false'
  if (/value|query|text|search|input|name|email|password|message|content|title|description|subject|phone|address/i.test(name)) return "''"
  if (/count|index|step|page|num|size|total|quantity|amount|price/i.test(name)) return '0'
  if (/list|items|results|entries|rows|options|tags|errors/i.test(name)) return '[]'
  return "''"
}

// ─── PROP RESOLUTION ──────────────────────────────────────────────────────────

function resolveProps(props: Record<string, unknown>): string {
  return Object.entries(props)
    .map(([key, val]) => {
      const s = String(val)

      // $state.x → {x}
      const stateMatch = s.match(REGEX.STATE_BINDING)
      if (stateMatch) return `${key}={${stateMatch[1]}}`

      // $handler.x → {x}
      const handlerMatch = s.match(REGEX.HANDLER_BINDING)
      if (handlerMatch) return `${key}={${handlerMatch[1]}}`

      // "true" → shorthand boolean
      if (REGEX.BOOLEAN_TRUE.test(s)) return key

      // "false" → omit
      if (REGEX.BOOLEAN_FALSE.test(s)) return null

      // numeric
      if (REGEX.NUMBER.test(s)) return `${key}={${s}}`

      // string literal
      return `${key}="${s}"`
    })
    .filter(Boolean)
    .join(' ')
}

// ─── NODE RENDERER ────────────────────────────────────────────────────────────

function renderNode(node: UINode, depth: number): string {
  const indent = '  '.repeat(depth)
  const propsStr = node.props ? ' ' + resolveProps(node.props) : ''
  const tag = `${node.name}${propsStr}`

  // Self-closing
  if (!node.children?.length && !node.text) {
    return `${indent}<${tag} />`
  }

  // Inline text
  if (node.text && !node.children?.length) {
    return `${indent}<${tag}>${node.text}</${node.name}>`
  }

  // Children
  const childLines = (node.children ?? [])
    .map(c => renderNode(c, depth + 1))
    .join('\n')

  return `${indent}<${tag}>\n${childLines}\n${indent}</${node.name}>`
}

// ─── IMPORT BUILDER ───────────────────────────────────────────────────────────

function buildImports(components: Set<string>, needsReact: boolean): string {
  const grouped = new Map<string, string[]>()
  const heroIcons: string[] = []

  for (const name of components) {
    if (isHeroIconName(name) && !IMPORT_MAP[name]) {
      heroIcons.push(name)
      continue
    }
    const src = IMPORT_MAP[name]
    if (!src) continue
    if (!grouped.has(src)) grouped.set(src, [])
    grouped.get(src)!.push(name)
  }

  const lines: string[] = []

  if (needsReact) lines.push("import React from 'react'")

  const sorted = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
  for (const [src, names] of sorted) {
    const sorted_names = names.sort().join(', ')
    lines.push(`import { ${sorted_names} } from '${src}'`)
  }

  if (heroIcons.length > 0) {
    const sortedIcons = [...new Set(heroIcons)].sort().join(', ')
    lines.push(`import { ${sortedIcons} } from '@heroicons/react/24/outline'`)
  }

  return lines.join('\n')
}

// ─── PROPS INTERFACE ──────────────────────────────────────────────────────────

function buildPropsInterface(handlers: Set<string>, states: Set<string>): string {
  if (handlers.size === 0) return ''

  const entries: string[] = []
  for (const h of handlers) {
    if (/^set[A-Z]/.test(h)) {
      // setter — infer type from matching state name
      const stateName = h.charAt(3).toLowerCase() + h.slice(4)
      const init = initialValue(stateName)
      const type = init === 'false' ? 'boolean' : init === "''" ? 'string' : init === '0' ? 'number' : 'unknown'
      entries.push(`  ${h}: (value: ${type}) => void`)
    } else {
      entries.push(`  ${h}: () => void`)
    }
  }

  return `interface Props {\n${entries.join('\n')}\n}`
}

// ─── MAIN CONVERTER ───────────────────────────────────────────────────────────

function convertTreeToTypeScriptInternal(
  tree: UITreeRoot,
  componentName: string,
): Omit<ConversionResult, 'filePath'> {
  // 1. Validate root
  if (tree.type !== 'ui-tree' || !tree.component) {
    throw new Error('SCHEMA_ERROR: Missing type="ui-tree" or component field')
  }

  // 2. Normalize names
  const normalized = normalizeTree(tree.component)

  // 3. Collect
  const acc: Collected = {
    states: new Set(),
    handlers: new Set(),
    components: new Set(),
  }
  collect(normalized, acc)
  pruneLocalSetterHandlers(acc)

  const needsReact = acc.states.size > 0

  // 4. Build imports
  const importsBlock = buildImports(acc.components, needsReact)

  // 5. Props interface
  const propsInterface = buildPropsInterface(acc.handlers, acc.states)
  const hasProps = acc.handlers.size > 0
  const paramStr = hasProps
    ? `{ ${[...acc.handlers].join(', ')} }: Props`
    : ''

  // 6. State declarations
  const stateLines = [...acc.states]
    .map(name => {
      const setter = 'set' + name.charAt(0).toUpperCase() + name.slice(1)
      const init = initialValue(name)
      return `  const [${name}, ${setter}] = React.useState(${init})`
    })
    .join('\n')

  // 7. Render JSX
  const jsxBody = renderNode(normalized, 2)

  // 8. Assemble. We do NOT emit `'use client'` — that's Next.js boilerplate.
  // The generated project is a pure Vite + React app where every module is
  // already a client module, so the directive is just noise.
  const sections: string[] = [
    importsBlock,
  ]

  if (propsInterface) {
    sections.push('', propsInterface)
  }

  sections.push(
    '',
    `export function ${componentName}(${paramStr}) {`,
    stateLines ? stateLines + '\n' : '',
    '  return (',
    jsxBody,
    '  )',
    '}'
  )

  const component = sections.filter(s => s !== undefined).join('\n')

  return {
    imports: importsBlock,
    component,
    stateVars: [...acc.states],
    handlerNames: [...acc.handlers],
  }
}

export function convertTreeToTypeScript(
  tree: UITreeRoot,
  componentName: string,
): ConversionResult {
  const result = convertTreeToTypeScriptInternal(tree, componentName)
  return {
    ...result,
    filePath: '',
  }
}

export function convertJSONToTypeScript(
  jsonInput: string,
  componentName: string,
  outputDir = 'src/components/generated'
): ConversionResult {
  // 1. Parse
  let tree: UITreeRoot
  try {
    tree = JSON.parse(jsonInput)
  } catch {
    throw new Error('JSON_PARSE_ERROR: Input is not valid JSON')
  }
  const converted = convertTreeToTypeScriptInternal(tree, componentName)

  // 10. Write file
  const filePath = path.resolve(`${outputDir}/${componentName}.tsx`)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, converted.component, 'utf-8')

  // 11. Update barrel index
  const indexPath = path.resolve(`${outputDir}/index.ts`)
  const exportLine = `export { ${componentName} } from './${componentName}'\n`
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, exportLine, 'utf-8')
  } else {
    const existing = fs.readFileSync(indexPath, 'utf-8')
    if (!existing.includes(`'./${componentName}'`)) {
      fs.appendFileSync(indexPath, exportLine)
    }
  }

  return {
    imports: converted.imports,
    component: converted.component,
    filePath,
    stateVars: converted.stateVars,
    handlerNames: converted.handlerNames,
  }
}

// ─── FILE-BASED ENTRY POINT ───────────────────────────────────────────────────

export function convertFileToTypeScript(
  jsonFilePath: string,
  componentName: string,
  outputDir?: string
): ConversionResult {
  const raw = fs.readFileSync(path.resolve(jsonFilePath), 'utf-8')
  return convertJSONToTypeScript(raw, componentName, outputDir)
}
