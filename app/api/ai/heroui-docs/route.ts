// HeroUI React documentation endpoint for Syra.
//
// Syra calls this endpoint via the `heroUiDocs` tool to retrieve live,
// accurate documentation for HeroUI v3 React components directly from the
// official source (heroui.com). This gives Syra current API knowledge
// without hallucination and helps it generate production-quality HeroUI
// component usage on every request.
//
// POST /api/ai/heroui-docs
// Body: { component: string }          — e.g. "button", "modal", "input"
//
// Returns:
//   { component, docs: string, url: string, source: "live" | "static" }

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// HeroUI v3 React component names — used for URL construction.
// Docs live at https://heroui.com/docs/react/components/{component}.mdx
const COMPONENT_MAP: Record<string, string> = {
  accordion: "accordion",
  alert: "alert",
  autocomplete: "autocomplete",
  avatar: "avatar",
  badge: "badge",
  breadcrumbs: "breadcrumbs",
  button: "button",
  calendar: "calendar",
  card: "card",
  checkbox: "checkbox",
  "checkbox-group": "checkbox-group",
  chip: "chip",
  "circular-progress": "circular-progress",
  code: "code",
  "date-input": "date-input",
  "date-picker": "date-picker",
  "date-range-picker": "date-range-picker",
  divider: "divider",
  drawer: "drawer",
  dropdown: "dropdown",
  image: "image",
  input: "input",
  "input-otp": "input-otp",
  kbd: "kbd",
  link: "link",
  listbox: "listbox",
  modal: "modal",
  navbar: "navbar",
  "number-input": "number-input",
  pagination: "pagination",
  popover: "popover",
  progress: "progress",
  "radio-group": "radio-group",
  "range-calendar": "range-calendar",
  "scroll-shadow": "scroll-shadow",
  select: "select",
  skeleton: "skeleton",
  slider: "slider",
  snippet: "snippet",
  spacer: "spacer",
  spinner: "spinner",
  switch: "switch",
  table: "table",
  tabs: "tabs",
  textarea: "textarea",
  "time-input": "time-input",
  tooltip: "tooltip",
  user: "user",
}

// Aliases: normalise common shorthand names
const ALIASES: Record<string, string> = {
  dialog: "modal",
  "check-box": "checkbox",
  checkboxgroup: "checkbox-group",
  radiogroup: "radio-group",
  radio: "radio-group",
  "date-range": "date-range-picker",
  datepicker: "date-picker",
  daterangepicker: "date-range-picker",
  dateinput: "date-input",
  timeinput: "time-input",
  numberinput: "number-input",
  inputotp: "input-otp",
  scrollshadow: "scroll-shadow",
  circprogress: "circular-progress",
  circularprogress: "circular-progress",
  otp: "input-otp",
}

async function fetchMdxDoc(component: string): Promise<string> {
  // Primary: heroui.com MDX docs
  const url = `https://heroui.com/docs/react/components/${component}.mdx`
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Syra-AI/1.0 (documentation-fetcher)",
        Accept: "text/plain,text/markdown,*/*",
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ""
    const text = await res.text()
    // Return first 8000 chars to stay within context window
    return text.slice(0, 8000)
  } catch {
    return ""
  }
}

async function fetchHtmlDoc(component: string): Promise<string> {
  // Fallback: scrape the rendered docs page
  const url = `https://www.heroui.com/en/docs/react/components/${component}`
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Syra-AI/1.0 (documentation-fetcher)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ""
    const html = await res.text()
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s{2,}/g, " ")
      .trim()
    return text.slice(0, 8000)
  } catch {
    return ""
  }
}

// Static reference docs — accurate HeroUI v3 API summaries used when live
// fetch is unavailable or too slow.
const STATIC_DOCS: Record<string, string> = {
  button: `HeroUI v3 Button — import { Button } from "@heroui/react"
Props: variant ("primary"|"secondary"|"tertiary"|"outline"|"ghost"|"danger"|"danger-soft"), size ("sm"|"md"|"lg"), fullWidth (bool), isDisabled (bool), isPending (bool), isIconOnly (bool), onPress ((e: PressEvent) => void), children (ReactNode | render-prop).
Render prop: ({ isPending, isPressed, isHovered, isFocused, isFocusVisible }) => ReactNode.
No "color" prop — use variant. No "onClick" — use onPress. Loading state: isPending (not isLoading). Width defaults to w-fit (use fullWidth for 100%).
Example: <Button variant="primary" size="md" onPress={() => {}}>Click me</Button>
Icon-only: <Button isIconOnly variant="ghost"><PlusIcon /></Button>`,

  input: `HeroUI v3 Input — import { Input } from "@heroui/react"
Props: label (string), placeholder (string), description (string), errorMessage (string), isInvalid (bool), isRequired (bool), isDisabled (bool), isReadOnly (bool), value (string), defaultValue (string), onValueChange ((v: string) => void), onChange (ChangeEvent), type (HTML input type), variant ("flat"|"bordered"|"underlined"|"faded"), size ("sm"|"md"|"lg"), radius ("none"|"sm"|"md"|"lg"|"full"), startContent / endContent (ReactNode), isClearable (bool), onClear (() => void).
Example: <Input label="Email" placeholder="you@example.com" type="email" isRequired />`,

  select: `HeroUI v3 Select — import { Select, SelectItem } from "@heroui/react"
Props: label, placeholder, selectedKeys, defaultSelectedKeys, onSelectionChange ((keys: Set<Key>) => void), isDisabled, isRequired, isInvalid, errorMessage, description, variant, size.
Usage: <Select label="Role"><SelectItem key="admin">Admin</SelectItem><SelectItem key="user">User</SelectItem></Select>`,

  card: `HeroUI v3 Card — import { Card, CardHeader, CardBody, CardFooter } from "@heroui/react"
Props: isHoverable (bool), isPressable (bool), isBlurred (bool), isFooterBlurred (bool), shadow ("none"|"sm"|"md"|"lg"), radius ("none"|"sm"|"md"|"lg"), fullWidth (bool).
Compose: <Card><CardHeader>...</CardHeader><CardBody>...</CardBody><CardFooter>...</CardFooter></Card>`,

  modal: `HeroUI v3 Modal — import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/react"
useDisclosure returns { isOpen, onOpen, onClose, onOpenChange }.
Usage: const {isOpen, onOpen, onOpenChange} = useDisclosure();
<Button onPress={onOpen}>Open</Button>
<Modal isOpen={isOpen} onOpenChange={onOpenChange}>
  <ModalContent>{(onClose) => (<><ModalHeader>Title</ModalHeader><ModalBody>Body</ModalBody><ModalFooter><Button onPress={onClose}>Close</Button></ModalFooter></>)}</ModalContent>
</Modal>`,

  table: `HeroUI v3 Table — import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/react"
Props on Table: aria-label (required), selectionMode ("none"|"single"|"multiple"), color, isStriped (bool), isCompact (bool), removeWrapper (bool).
Usage: <Table aria-label="Users"><TableHeader><TableColumn>Name</TableColumn></TableHeader><TableBody><TableRow key="1"><TableCell>Alice</TableCell></TableRow></TableBody></Table>`,

  tabs: `HeroUI v3 Tabs — import { Tabs, Tab } from "@heroui/react"
Props: selectedKey, defaultSelectedKey, onSelectionChange, variant ("solid"|"bordered"|"light"|"underlined"), color, size, placement ("top"|"bottom"|"start"|"end"), isDisabled.
Usage: <Tabs><Tab key="photos" title="Photos">Photos content</Tab><Tab key="videos" title="Videos">Videos content</Tab></Tabs>`,

  badge: `HeroUI v3 Badge — import { Badge } from "@heroui/react"
Props: content (string|number), color ("default"|"primary"|"secondary"|"success"|"warning"|"danger"), variant ("solid"|"flat"|"faded"|"shadow"), size ("sm"|"md"|"lg"), isInvisible (bool), showOutline (bool), placement ("top-right"|"top-left"|"bottom-right"|"bottom-left").
Usage: <Badge content="5" color="danger"><BellIcon /></Badge>`,

  avatar: `HeroUI v3 Avatar — import { Avatar, AvatarGroup } from "@heroui/react"
Props: src (string), name (string — used as fallback initials), size ("sm"|"md"|"lg"), radius ("none"|"sm"|"md"|"lg"|"full"), isBordered (bool), isDisabled (bool), color.
AvatarGroup: max (number), isBordered, size. Wraps multiple Avatar components.`,

  tooltip: `HeroUI v3 Tooltip — import { Tooltip } from "@heroui/react"
Props: content (ReactNode), placement, color, delay (number ms), closeDelay, isDisabled, showArrow.
Usage: <Tooltip content="Delete item"><Button isIconOnly><TrashIcon /></Button></Tooltip>`,

  chip: `HeroUI v3 Chip — import { Chip } from "@heroui/react"
Props: variant ("solid"|"bordered"|"light"|"flat"|"faded"|"shadow"|"dot"), color, size, radius, isDisabled, onClose (() => void — renders a close button), startContent / endContent.
Usage: <Chip color="success" variant="flat">Active</Chip>`,

  checkbox: `HeroUI v3 Checkbox — import { Checkbox, CheckboxGroup } from "@heroui/react"
Checkbox props: isSelected, defaultSelected, onValueChange ((v: boolean) => void), isDisabled, isIndeterminate, color, size.
CheckboxGroup props: value, defaultValue, onValueChange ((v: string[]) => void), label, description, isDisabled, orientation ("horizontal"|"vertical").`,

  switch: `HeroUI v3 Switch — import { Switch } from "@heroui/react"
Props: isSelected, defaultSelected, onValueChange ((v: boolean) => void), isDisabled, color, size, startContent / endContent (icons shown left/right of thumb).`,

  spinner: `HeroUI v3 Spinner — import { Spinner } from "@heroui/react"
Props: size ("sm"|"md"|"lg"), color ("default"|"primary"|"secondary"|"success"|"warning"|"danger"), label (string — shown below spinner), labelColor.`,

  skeleton: `HeroUI v3 Skeleton — import { Skeleton } from "@heroui/react"
Props: isLoaded (bool — fades out skeleton when true), className. Wrap actual content: <Skeleton isLoaded={isLoaded} className="rounded-lg"><div className="h-24 w-full">content</div></Skeleton>`,

  progress: `HeroUI v3 Progress — import { Progress } from "@heroui/react"
Props: value (0–100), minValue, maxValue, color, size, radius, isIndeterminate (bool), label, showValueLabel (bool), formatOptions (Intl.NumberFormatOptions).`,

  navbar: `HeroUI v3 Navbar — import { Navbar, NavbarBrand, NavbarContent, NavbarItem, NavbarMenu, NavbarMenuItem, NavbarMenuToggle } from "@heroui/react"
Props: isMenuOpen, onMenuOpenChange, isBordered, isBlurred, position ("static"|"sticky"|"floating").
Pattern: <Navbar><NavbarBrand>Logo</NavbarBrand><NavbarContent justify="end"><NavbarItem><Button>Sign up</Button></NavbarItem></NavbarContent></Navbar>`,

  dropdown: `HeroUI v3 Dropdown — import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection } from "@heroui/react"
Usage: <Dropdown><DropdownTrigger><Button>Open</Button></DropdownTrigger><DropdownMenu><DropdownItem key="copy">Copy</DropdownItem><DropdownItem key="delete" color="danger">Delete</DropdownItem></DropdownMenu></Dropdown>`,

  pagination: `HeroUI v3 Pagination — import { Pagination } from "@heroui/react"
Props: total (number), page, initialPage, onChange ((page: number) => void), color, size, radius, isCompact (bool), isDisabled, showControls (bool), showShadow.`,

  popover: `HeroUI v3 Popover — import { Popover, PopoverTrigger, PopoverContent } from "@heroui/react"
Props: placement, color, isOpen, defaultOpen, onOpenChange, showArrow, offset.
Usage: <Popover><PopoverTrigger><Button>Info</Button></PopoverTrigger><PopoverContent><p>Content here</p></PopoverContent></Popover>`,

  textarea: `HeroUI v3 Textarea — import { Textarea } from "@heroui/react"
Props: same as Input plus: minRows, maxRows, disableAutosize. Extends Input API.`,

  slider: `HeroUI v3 Slider — import { Slider } from "@heroui/react"
Props: value, defaultValue, onChange, minValue, maxValue, step, color, size, orientation ("horizontal"|"vertical"), label, showTooltip, showOutline, marks (Array<{value,label}>).`,

  accordion: `HeroUI v3 Accordion — import { Accordion, AccordionItem } from "@heroui/react"
Props on Accordion: variant ("light"|"shadow"|"bordered"|"splitted"), selectionMode ("single"|"multiple"), selectedKeys, defaultExpandedKeys, onSelectionChange, isCompact.
AccordionItem props: key (required), title, subtitle, startContent, isDisabled.`,

  autocomplete: `HeroUI v3 Autocomplete — import { Autocomplete, AutocompleteItem } from "@heroui/react"
Extends Select with filtering. Props: inputValue, onInputChange, items (array), allowsCustomValue.
Usage: <Autocomplete label="Search"><AutocompleteItem key="a">Apple</AutocompleteItem></Autocomplete>`,
}

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const raw = typeof body?.component === "string" ? body.component.trim().toLowerCase() : ""
  if (!raw) {
    return Response.json({ error: "Missing 'component' field" }, { status: 400 })
  }

  // Resolve aliases then look up canonical name
  const component = ALIASES[raw] ?? raw
  const canonicalPath = COMPONENT_MAP[component] ?? component
  const docsUrl = `https://heroui.com/docs/react/components/${canonicalPath}`

  // Try live MDX fetch first, then HTML fallback — both have short timeouts
  const [mdxResult, htmlResult] = await Promise.allSettled([
    fetchMdxDoc(canonicalPath),
    fetchHtmlDoc(canonicalPath),
  ])

  const mdxText = mdxResult.status === "fulfilled" ? mdxResult.value : ""
  const htmlText = htmlResult.status === "fulfilled" ? htmlResult.value : ""
  const liveDocs = mdxText.length > 200 ? mdxText : htmlText.length > 200 ? htmlText : ""

  const staticText = STATIC_DOCS[component] || STATIC_DOCS[raw] || ""
  const docs =
    liveDocs.length > 200
      ? liveDocs
      : staticText ||
        `No documentation found for HeroUI component "${component}". Visit ${docsUrl} for the full API reference.`

  return Response.json({
    component,
    docs,
    url: docsUrl,
    source: liveDocs.length > 200 ? "live" : "static",
  })
}
