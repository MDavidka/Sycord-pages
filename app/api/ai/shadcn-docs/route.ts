// shadcn/ui documentation MCP endpoint for Syra.
//
// Syra calls this endpoint via the `shadcnDocs` tool to retrieve live,
// accurate documentation for shadcn/ui components directly from the
// official source (ui.shadcn.com). This gives Syra current API
// knowledge without hallucination and helps it generate production-quality
// shadcn component usage on every request.
//
// POST /api/ai/shadcn-docs
// Body: { component: string }          — e.g. "button", "dialog", "form"
//
// Returns:
//   { component, docs: string, examples: string, url: string }

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 30

// Canonical shadcn/ui docs paths keyed by component name.
const COMPONENT_MAP: Record<string, string> = {
  accordion: "accordion",
  alert: "alert",
  "alert-dialog": "alert-dialog",
  "aspect-ratio": "aspect-ratio",
  avatar: "avatar",
  badge: "badge",
  breadcrumb: "breadcrumb",
  button: "button",
  calendar: "calendar",
  card: "card",
  carousel: "carousel",
  chart: "chart",
  checkbox: "checkbox",
  collapsible: "collapsible",
  combobox: "combobox",
  command: "command",
  "context-menu": "context-menu",
  "data-table": "data-table",
  "date-picker": "date-picker",
  dialog: "dialog",
  drawer: "drawer",
  "dropdown-menu": "dropdown-menu",
  form: "form",
  "hover-card": "hover-card",
  input: "input",
  "input-otp": "input-otp",
  label: "label",
  menubar: "menubar",
  "navigation-menu": "navigation-menu",
  pagination: "pagination",
  popover: "popover",
  progress: "progress",
  "radio-group": "radio-group",
  resizable: "resizable",
  "scroll-area": "scroll-area",
  select: "select",
  separator: "separator",
  sheet: "sheet",
  sidebar: "sidebar",
  skeleton: "skeleton",
  slider: "slider",
  sonner: "sonner",
  switch: "switch",
  table: "table",
  tabs: "tabs",
  textarea: "textarea",
  toast: "toast",
  toggle: "toggle",
  "toggle-group": "toggle-group",
  tooltip: "tooltip",
  typography: "typography",
}

async function fetchDoc(path: string): Promise<string> {
  const url = `https://ui.shadcn.com/docs/components/${path}`
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Syra-AI/1.0 (documentation-fetcher)",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return ""
    const html = await res.text()
    // Strip HTML tags and collapse whitespace for clean text
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
    // Return first 8000 chars to stay within context
    return text.slice(0, 8000)
  } catch {
    return ""
  }
}

// Inline static reference data as a fast fallback when the network is slow.
// This covers the most-used APIs so Syra always has something useful.
const STATIC_DOCS: Record<string, string> = {
  button: `Button — variants: default | destructive | outline | secondary | ghost | link. Size: default | sm | lg | icon. Use data-icon="inline-start" or data-icon="inline-end" on icons inside Button. Never add sizing classes (w-4 h-4) on icons inside components. Compose loading state with <Spinner /> and disabled prop.`,
  card: `Card — always compose with CardHeader, CardTitle, CardDescription, CardContent, CardFooter. Never dump content directly into <Card>. Use <CardHeader> to hold title + description.`,
  dialog: `Dialog — compose: Dialog > DialogTrigger > DialogContent > DialogHeader > DialogTitle (required for a11y) + DialogDescription + DialogFooter. Use className="sr-only" on DialogTitle if visually hidden.`,
  form: `Form — built on react-hook-form. Use FieldGroup + Field + FieldLabel + Input + FieldDescription + FieldError. Never use raw div/space-y for form layout. For validation: data-invalid on Field, aria-invalid on the control.`,
  input: `Input — always pair with Label or FieldLabel. Use InputGroup + InputGroupAddon when adding buttons/icons inline. Never use raw styled divs for input addons.`,
  select: `Select — compose: Select > SelectTrigger > SelectValue. SelectContent > SelectGroup > SelectItem. Always wrap items in SelectGroup.`,
  table: `Table — compose: Table > TableHeader > TableRow > TableHead. Table > TableBody > TableRow > TableCell. Use TableCaption for accessible captions.`,
  tabs: `Tabs — compose: Tabs > TabsList > TabsTrigger. Tabs > TabsContent. TabsTrigger must always be inside TabsList, never rendered directly in Tabs.`,
  sheet: `Sheet — side panel overlay. Compose: Sheet > SheetTrigger > SheetContent > SheetHeader > SheetTitle (required). Use side prop: top | right | bottom | left.`,
  badge: `Badge — variants: default | secondary | destructive | outline. Never use styled <span> for status chips — always use Badge.`,
  avatar: `Avatar — always include AvatarFallback for when image fails. Compose: Avatar > AvatarImage + AvatarFallback. Use size-* not w-* h-* for sizing.`,
  tooltip: `Tooltip — must wrap in TooltipProvider at root. Compose: TooltipProvider > Tooltip > TooltipTrigger > TooltipContent.`,
  separator: `Separator — use instead of <hr> or <div className="border-t">. orientation prop: horizontal | vertical.`,
  skeleton: `Skeleton — loading placeholder. Never use custom animate-pulse divs. Just <Skeleton className="h-4 w-[250px]" />.`,
}

import { checkRateLimit } from "@/lib/security/rate-limit"
import { getClientIP } from "@/lib/get-client-ip"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rate = checkRateLimit(`shadcn-docs:${userId}`, { limit: 30, windowMs: 60_000 })
  if (!rate.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      },
    )
  }

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

  // Normalise aliases (e.g. "dropdown" → "dropdown-menu")
  const aliases: Record<string, string> = {
    dropdown: "dropdown-menu",
    "alert-dialog": "alert-dialog",
    alertdialog: "alert-dialog",
    contextmenu: "context-menu",
    hovercard: "hover-card",
    inputotp: "input-otp",
    navigationmenu: "navigation-menu",
    radiog: "radio-group",
    radiogroup: "radio-group",
    scrollarea: "scroll-area",
    togglegroup: "toggle-group",
    datatable: "data-table",
    datepicker: "date-picker",
  }
  const component = aliases[raw] ?? raw
  const path = COMPONENT_MAP[component]
  const url = path ? `https://ui.shadcn.com/docs/components/${path}` : `https://ui.shadcn.com/docs/components/${component}`

  // Try live fetch; fall back to static inline docs
  const [liveDocs] = await Promise.allSettled([path ? fetchDoc(path) : Promise.resolve("")])
  const liveText = liveDocs.status === "fulfilled" ? liveDocs.value : ""
  const staticText = STATIC_DOCS[component] || STATIC_DOCS[raw] || ""

  const docs = liveText.length > 200 ? liveText : staticText || `No documentation found for component "${component}". Check https://ui.shadcn.com/docs/components/${component} manually.`

  return Response.json({
    component,
    docs,
    url,
    source: liveText.length > 200 ? "live" : "static",
  })
}
