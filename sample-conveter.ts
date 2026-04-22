'use server'

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

const IMPORT_MAP: Record<string, string> = {
  Button: '@/components/ui/button',
  Card: '@/components/ui/card',
  CardHeader: '@/components/ui/card',
  CardTitle: '@/components/ui/card',
  CardDescription: '@/components/ui/card',
  CardAction: '@/components/ui/card',
  CardContent: '@/components/ui/card',
  CardFooter: '@/components/ui/card',
  Dialog: '@/components/ui/dialog',
  DialogTrigger: '@/components/ui/dialog',
  DialogContent: '@/components/ui/dialog',
  DialogHeader: '@/components/ui/dialog',
  DialogFooter: '@/components/ui/dialog',
  DialogTitle: '@/components/ui/dialog',
  DialogDescription: '@/components/ui/dialog',
  DialogClose: '@/components/ui/dialog',
  AlertDialog: '@/components/ui/alert-dialog',
  AlertDialogTrigger: '@/components/ui/alert-dialog',
  AlertDialogContent: '@/components/ui/alert-dialog',
  AlertDialogHeader: '@/components/ui/alert-dialog',
  AlertDialogFooter: '@/components/ui/alert-dialog',
  AlertDialogTitle: '@/components/ui/alert-dialog',
  AlertDialogDescription: '@/components/ui/alert-dialog',
  AlertDialogAction: '@/components/ui/alert-dialog',
  AlertDialogCancel: '@/components/ui/alert-dialog',
  Input: '@/components/ui/input',
  Label: '@/components/ui/label',
  Textarea: '@/components/ui/textarea',
  Checkbox: '@/components/ui/checkbox',
  Switch: '@/components/ui/switch',
  Slider: '@/components/ui/slider',
  Badge: '@/components/ui/badge',
  Skeleton: '@/components/ui/skeleton',
  Separator: '@/components/ui/separator',
  Progress: '@/components/ui/progress',
  Tabs: '@/components/ui/tabs',
  TabsList: '@/components/ui/tabs',
  TabsTrigger: '@/components/ui/tabs',
  TabsContent: '@/components/ui/tabs',
  Select: '@/components/ui/select',
  SelectTrigger: '@/components/ui/select',
  SelectValue: '@/components/ui/select',
  SelectContent: '@/components/ui/select',
  SelectItem: '@/components/ui/select',
  SelectLabel: '@/components/ui/select',
  SelectSeparator: '@/components/ui/select',
  SelectGroup: '@/components/ui/select',
  SelectScrollUpButton: '@/components/ui/select',
  SelectScrollDownButton: '@/components/ui/select',
  Popover: '@/components/ui/popover',
  PopoverTrigger: '@/components/ui/popover',
  PopoverContent: '@/components/ui/popover',
  Command: '@/components/ui/command',
  CommandInput: '@/components/ui/command',
  CommandList: '@/components/ui/command',
  CommandEmpty: '@/components/ui/command',
  CommandGroup: '@/components/ui/command',
  CommandItem: '@/components/ui/command',
  CommandSeparator: '@/components/ui/command',
  CommandShortcut: '@/components/ui/command',
  Calendar: '@/components/ui/calendar',
  Accordion: '@/components/ui/accordion',
  AccordionItem: '@/components/ui/accordion',
  AccordionTrigger: '@/components/ui/accordion',
  AccordionContent: '@/components/ui/accordion',
  Sheet: '@/components/ui/sheet',
  SheetTrigger: '@/components/ui/sheet',
  SheetContent: '@/components/ui/sheet',
  SheetHeader: '@/components/ui/sheet',
  SheetFooter: '@/components/ui/sheet',
  SheetTitle: '@/components/ui/sheet',
  SheetDescription: '@/components/ui/sheet',
  SheetClose: '@/components/ui/sheet',
  Drawer: '@/components/ui/drawer',
  DrawerTrigger: '@/components/ui/drawer',
  DrawerContent: '@/components/ui/drawer',
  DrawerHeader: '@/components/ui/drawer',
  DrawerFooter: '@/components/ui/drawer',
  DrawerTitle: '@/components/ui/drawer',
  DrawerDescription: '@/components/ui/drawer',
  DrawerClose: '@/components/ui/drawer',
  DropdownMenu: '@/components/ui/dropdown-menu',
  DropdownMenuTrigger: '@/components/ui/dropdown-menu',
  DropdownMenuContent: '@/components/ui/dropdown-menu',
  DropdownMenuItem: '@/components/ui/dropdown-menu',
  DropdownMenuLabel: '@/components/ui/dropdown-menu',
  DropdownMenuSeparator: '@/components/ui/dropdown-menu',
  DropdownMenuShortcut: '@/components/ui/dropdown-menu',
  DropdownMenuGroup: '@/components/ui/dropdown-menu',
  DropdownMenuSub: '@/components/ui/dropdown-menu',
  DropdownMenuSubTrigger: '@/components/ui/dropdown-menu',
  DropdownMenuSubContent: '@/components/ui/dropdown-menu',
  DropdownMenuCheckboxItem: '@/components/ui/dropdown-menu',
  DropdownMenuRadioGroup: '@/components/ui/dropdown-menu',
  DropdownMenuRadioItem: '@/components/ui/dropdown-menu',
  Table: '@/components/ui/table',
  TableHeader: '@/components/ui/table',
  TableBody: '@/components/ui/table',
  TableFooter: '@/components/ui/table',
  TableRow: '@/components/ui/table',
  TableHead: '@/components/ui/table',
  TableCell: '@/components/ui/table',
  TableCaption: '@/components/ui/table',
  Toggle: '@/components/ui/toggle',
  ToggleGroup: '@/components/ui/toggle-group',
  ToggleGroupItem: '@/components/ui/toggle-group',
  Tooltip: '@/components/ui/tooltip',
  TooltipProvider: '@/components/ui/tooltip',
  TooltipTrigger: '@/components/ui/tooltip',
  TooltipContent: '@/components/ui/tooltip',
  HoverCard: '@/components/ui/hover-card',
  HoverCardTrigger: '@/components/ui/hover-card',
  HoverCardContent: '@/components/ui/hover-card',
  Collapsible: '@/components/ui/collapsible',
  CollapsibleTrigger: '@/components/ui/collapsible',
  CollapsibleContent: '@/components/ui/collapsible',
  ScrollArea: '@/components/ui/scroll-area',
  ScrollBar: '@/components/ui/scroll-area',
  Carousel: '@/components/ui/carousel',
  CarouselContent: '@/components/ui/carousel',
  CarouselItem: '@/components/ui/carousel',
  CarouselPrevious: '@/components/ui/carousel',
  CarouselNext: '@/components/ui/carousel',
  Breadcrumb: '@/components/ui/breadcrumb',
  BreadcrumbList: '@/components/ui/breadcrumb',
  BreadcrumbItem: '@/components/ui/breadcrumb',
  BreadcrumbLink: '@/components/ui/breadcrumb',
  BreadcrumbPage: '@/components/ui/breadcrumb',
  BreadcrumbSeparator: '@/components/ui/breadcrumb',
  BreadcrumbEllipsis: '@/components/ui/breadcrumb',
  Pagination: '@/components/ui/pagination',
  PaginationContent: '@/components/ui/pagination',
  PaginationItem: '@/components/ui/pagination',
  PaginationLink: '@/components/ui/pagination',
  PaginationPrevious: '@/components/ui/pagination',
  PaginationNext: '@/components/ui/pagination',
  PaginationEllipsis: '@/components/ui/pagination',
  Sidebar: '@/components/ui/sidebar',
  SidebarProvider: '@/components/ui/sidebar',
  SidebarTrigger: '@/components/ui/sidebar',
  SidebarContent: '@/components/ui/sidebar',
  SidebarHeader: '@/components/ui/sidebar',
  SidebarFooter: '@/components/ui/sidebar',
  SidebarGroup: '@/components/ui/sidebar',
  SidebarGroupLabel: '@/components/ui/sidebar',
  SidebarGroupContent: '@/components/ui/sidebar',
  SidebarMenu: '@/components/ui/sidebar',
  SidebarMenuItem: '@/components/ui/sidebar',
  SidebarMenuButton: '@/components/ui/sidebar',
  SidebarInset: '@/components/ui/sidebar',
  SidebarSeparator: '@/components/ui/sidebar',
  Form: '@/components/ui/form',
  FormField: '@/components/ui/form',
  FormItem: '@/components/ui/form',
  FormLabel: '@/components/ui/form',
  FormControl: '@/components/ui/form',
  FormDescription: '@/components/ui/form',
  FormMessage: '@/components/ui/form',
  Menubar: '@/components/ui/menubar',
  MenubarMenu: '@/components/ui/menubar',
  MenubarTrigger: '@/components/ui/menubar',
  MenubarContent: '@/components/ui/menubar',
  MenubarItem: '@/components/ui/menubar',
  MenubarSeparator: '@/components/ui/menubar',
  NavigationMenu: '@/components/ui/navigation-menu',
  NavigationMenuList: '@/components/ui/navigation-menu',
  NavigationMenuItem: '@/components/ui/navigation-menu',
  NavigationMenuTrigger: '@/components/ui/navigation-menu',
  NavigationMenuContent: '@/components/ui/navigation-menu',
  NavigationMenuLink: '@/components/ui/navigation-menu',
  InputOTP: '@/components/ui/input-otp',
  InputOTPGroup: '@/components/ui/input-otp',
  InputOTPSlot: '@/components/ui/input-otp',
  InputOTPSeparator: '@/components/ui/input-otp',
  Resizable: '@/components/ui/resizable',
  ResizablePanelGroup: '@/components/ui/resizable',
  ResizablePanel: '@/components/ui/resizable',
  ResizableHandle: '@/components/ui/resizable',
  AspectRatio: '@/components/ui/aspect-ratio',
  Avatar: '@/components/ui/avatar',
  AvatarImage: '@/components/ui/avatar',
  AvatarFallback: '@/components/ui/avatar',
  Toaster: 'sonner',
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

function normalizeName(name: string): string {
  if (REGEX.COMPONENT_NAME.test(name)) return name
  if (REGEX.ALIAS_NAME.test(name) && ALIAS_MAP[name]) return ALIAS_MAP[name]
  throw new Error(`UNKNOWN_COMPONENT: "${name}" is not a known shadcn/ui component`)
}

function normalizeTree(node: UINode): UINode {
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

// ─── INITIAL VALUE HEURISTIC ──────────────────────────────────────────────────

function initialValue(name: string): string {
  if (/open|show|visible|active|checked|enabled/i.test(name)) return 'false'
  if (/value|query|text|search|input|name|email|password/i.test(name)) return "''"
  if (/count|index|step|page|num|size/i.test(name)) return '0'
  return 'undefined'
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

  for (const name of components) {
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

  // 2. Validate root
  if (tree.type !== 'ui-tree' || !tree.component) {
    throw new Error('SCHEMA_ERROR: Missing type="ui-tree" or component field')
  }

  // 3. Normalize names
  const normalized = normalizeTree(tree.component)

  // 4. Collect
  const acc: Collected = {
    states: new Set(),
    handlers: new Set(),
    components: new Set(),
  }
  collect(normalized, acc)

  const needsReact = acc.states.size > 0

  // 5. Build imports
  const importsBlock = buildImports(acc.components, needsReact)

  // 6. Props interface
  const propsInterface = buildPropsInterface(acc.handlers, acc.states)
  const hasProps = acc.handlers.size > 0
  const paramStr = hasProps
    ? `{ ${[...acc.handlers].join(', ')} }: Props`
    : ''

  // 7. State declarations
  const stateLines = [...acc.states]
    .map(name => {
      const setter = 'set' + name.charAt(0).toUpperCase() + name.slice(1)
      const init = initialValue(name)
      return `  const [${name}, ${setter}] = React.useState(${init})`
    })
    .join('\n')

  // 8. Render JSX
  const jsxBody = renderNode(normalized, 2)

  // 9. Assemble
  const sections: string[] = [
    "'use client'",
    '',
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

  // 10. Write file
  const filePath = path.resolve(`${outputDir}/${componentName}.tsx`)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, component, 'utf-8')

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
    imports: importsBlock,
    component,
    filePath,
    stateVars: [...acc.states],
    handlerNames: [...acc.handlers],
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
