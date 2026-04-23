import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

// ─── CONVERTER LOGIC (inlined from sample-conveter.ts) ────────────────────────

interface UINode {
  id?: string
  name: string
  props?: Record<string, unknown>
  text?: string
  condition?: string
  slot?: string
  repeat?: { source: string; item: string; key?: string }
  children?: UINode[]
}

interface UITreeRoot {
  type: "ui-tree"
  version: string
  importsMode?: "auto" | "manual"
  component: UINode
}

const IMPORT_MAP: Record<string, string> = {
  Button: "@/components/ui/button",
  Card: "@/components/ui/card", CardHeader: "@/components/ui/card", CardTitle: "@/components/ui/card",
  CardDescription: "@/components/ui/card", CardAction: "@/components/ui/card",
  CardContent: "@/components/ui/card", CardFooter: "@/components/ui/card",
  Dialog: "@/components/ui/dialog", DialogTrigger: "@/components/ui/dialog",
  DialogContent: "@/components/ui/dialog", DialogHeader: "@/components/ui/dialog",
  DialogFooter: "@/components/ui/dialog", DialogTitle: "@/components/ui/dialog",
  DialogDescription: "@/components/ui/dialog", DialogClose: "@/components/ui/dialog",
  AlertDialog: "@/components/ui/alert-dialog", AlertDialogTrigger: "@/components/ui/alert-dialog",
  AlertDialogContent: "@/components/ui/alert-dialog", AlertDialogHeader: "@/components/ui/alert-dialog",
  AlertDialogFooter: "@/components/ui/alert-dialog", AlertDialogTitle: "@/components/ui/alert-dialog",
  AlertDialogDescription: "@/components/ui/alert-dialog", AlertDialogAction: "@/components/ui/alert-dialog",
  AlertDialogCancel: "@/components/ui/alert-dialog",
  Input: "@/components/ui/input", Label: "@/components/ui/label", Textarea: "@/components/ui/textarea",
  Checkbox: "@/components/ui/checkbox", Switch: "@/components/ui/switch", Slider: "@/components/ui/slider",
  Badge: "@/components/ui/badge", Skeleton: "@/components/ui/skeleton", Separator: "@/components/ui/separator",
  Progress: "@/components/ui/progress", Tabs: "@/components/ui/tabs", TabsList: "@/components/ui/tabs",
  TabsTrigger: "@/components/ui/tabs", TabsContent: "@/components/ui/tabs",
  Select: "@/components/ui/select", SelectTrigger: "@/components/ui/select",
  SelectValue: "@/components/ui/select", SelectContent: "@/components/ui/select",
  SelectItem: "@/components/ui/select", SelectLabel: "@/components/ui/select",
  SelectSeparator: "@/components/ui/select", SelectGroup: "@/components/ui/select",
  Popover: "@/components/ui/popover", PopoverTrigger: "@/components/ui/popover",
  PopoverContent: "@/components/ui/popover",
  Accordion: "@/components/ui/accordion", AccordionItem: "@/components/ui/accordion",
  AccordionTrigger: "@/components/ui/accordion", AccordionContent: "@/components/ui/accordion",
  Sheet: "@/components/ui/sheet", SheetTrigger: "@/components/ui/sheet",
  SheetContent: "@/components/ui/sheet", SheetHeader: "@/components/ui/sheet",
  SheetFooter: "@/components/ui/sheet", SheetTitle: "@/components/ui/sheet",
  SheetDescription: "@/components/ui/sheet", SheetClose: "@/components/ui/sheet",
  DropdownMenu: "@/components/ui/dropdown-menu", DropdownMenuTrigger: "@/components/ui/dropdown-menu",
  DropdownMenuContent: "@/components/ui/dropdown-menu", DropdownMenuItem: "@/components/ui/dropdown-menu",
  DropdownMenuLabel: "@/components/ui/dropdown-menu", DropdownMenuSeparator: "@/components/ui/dropdown-menu",
  Avatar: "@/components/ui/avatar", AvatarImage: "@/components/ui/avatar", AvatarFallback: "@/components/ui/avatar",
  Table: "@/components/ui/table", TableHeader: "@/components/ui/table", TableBody: "@/components/ui/table",
  TableRow: "@/components/ui/table", TableHead: "@/components/ui/table", TableCell: "@/components/ui/table",
  TableCaption: "@/components/ui/table",
}

const ALIAS_MAP: Record<string, string> = {
  button: "Button", card: "Card", "card-header": "CardHeader", "card-title": "CardTitle",
  "card-description": "CardDescription", "card-content": "CardContent", "card-footer": "CardFooter",
  dialog: "Dialog", "alert-dialog": "AlertDialog", input: "Input", label: "Label",
  textarea: "Textarea", badge: "Badge", tabs: "Tabs", select: "Select", popover: "Popover",
  accordion: "Accordion", sheet: "Sheet", dropdown: "DropdownMenu", "dropdown-menu": "DropdownMenu",
  table: "Table", avatar: "Avatar", skeleton: "Skeleton", separator: "Separator",
  switch: "Switch", progress: "Progress", checkbox: "Checkbox",
}

const HTML_TAGS = new Set([
  "div","span","p","a","button","input","textarea","label","form","section","article",
  "main","header","footer","nav","aside","ul","ol","li","h1","h2","h3","h4","h5","h6",
  "img","table","thead","tbody","tr","td","th","pre","code","blockquote","hr","br",
])

const REGEX = {
  COMPONENT_NAME: /^[A-Z][A-Za-z0-9]+$/,
  ALIAS_NAME: /^[a-z][a-z0-9-]*$/,
  STATE_BINDING: /^\$state\.([A-Za-z_][A-Za-z0-9_]*)$/,
  HANDLER_BINDING: /^\$handler\.([A-Za-z_][A-Za-z0-9_]*)$/,
  BOOLEAN_TRUE: /^true$/,
  BOOLEAN_FALSE: /^false$/,
  NUMBER: /^\d+(\.\d+)?$/,
}

function normalizeName(name: string): string {
  if (REGEX.COMPONENT_NAME.test(name)) return name
  if (HTML_TAGS.has(name)) return name
  if (REGEX.ALIAS_NAME.test(name) && ALIAS_MAP[name]) return ALIAS_MAP[name]
  return name // pass through unknown names gracefully
}

function normalizeTree(node: UINode): UINode {
  return { ...node, name: normalizeName(node.name), children: node.children?.map(normalizeTree) }
}

interface Collected { states: Set<string>; handlers: Set<string>; components: Set<string> }

function collect(node: UINode, acc: Collected): void {
  acc.components.add(node.name)
  for (const val of Object.values(node.props ?? {})) {
    const s = String(val)
    const sm = s.match(REGEX.STATE_BINDING)
    const hm = s.match(REGEX.HANDLER_BINDING)
    if (sm) acc.states.add(sm[1])
    if (hm) acc.handlers.add(hm[1])
  }
  node.children?.forEach(c => collect(c, acc))
}

function initialValue(name: string): string {
  if (/open|show|visible|active|checked|enabled/i.test(name)) return "false"
  if (/value|query|text|search|input|name|email|password/i.test(name)) return "''"
  if (/count|index|step|page|num|size/i.test(name)) return "0"
  return "undefined"
}

function resolveProps(props: Record<string, unknown>): string {
  return Object.entries(props).map(([key, val]) => {
    const s = String(val)
    const sm = s.match(REGEX.STATE_BINDING)
    if (sm) return `${key}={${sm[1]}}`
    const hm = s.match(REGEX.HANDLER_BINDING)
    if (hm) return `${key}={${hm[1]}}`
    if (REGEX.BOOLEAN_TRUE.test(s)) return key
    if (REGEX.BOOLEAN_FALSE.test(s)) return null
    if (REGEX.NUMBER.test(s)) return `${key}={${s}}`
    return `${key}="${s}"`
  }).filter(Boolean).join(" ")
}

function renderNode(node: UINode, depth: number): string {
  const indent = "  ".repeat(depth)
  const propsStr = node.props ? " " + resolveProps(node.props) : ""
  const tag = `${node.name}${propsStr}`
  if (!node.children?.length && !node.text) return `${indent}<${tag} />`
  if (node.text && !node.children?.length) return `${indent}<${tag}>${node.text}</${node.name}>`
  const childLines = (node.children ?? []).map(c => renderNode(c, depth + 1)).join("\n")
  return `${indent}<${tag}>\n${childLines}\n${indent}</${node.name}>`
}

function buildImports(components: Set<string>, needsReact: boolean): string {
  const grouped = new Map<string, string[]>()
  for (const name of components) {
    const src = IMPORT_MAP[name]
    if (!src) continue
    if (!grouped.has(src)) grouped.set(src, [])
    grouped.get(src)!.push(name)
  }
  const lines: string[] = []
  if (needsReact) lines.push("import React, { useState } from 'react'")
  const sorted = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b))
  for (const [src, names] of sorted) {
    lines.push(`import { ${names.sort().join(", ")} } from '${src}'`)
  }
  return lines.join("\n")
}

function buildPropsInterface(handlers: Set<string>, states: Set<string>): string {
  if (handlers.size === 0) return ""
  const entries: string[] = []
  for (const h of handlers) {
    if (/^set[A-Z]/.test(h)) {
      const stateName = h.charAt(3).toLowerCase() + h.slice(4)
      const init = initialValue(stateName)
      const type = init === "false" ? "boolean" : init === "''" ? "string" : init === "0" ? "number" : "unknown"
      entries.push(`  ${h}: (value: ${type}) => void`)
    } else {
      entries.push(`  ${h}: () => void`)
    }
  }
  return `interface Props {\n${entries.join("\n")}\n}`
}

function convertTreeToTypeScript(tree: UITreeRoot, componentName: string): string {
  if (tree.type !== "ui-tree" || !tree.component) throw new Error("SCHEMA_ERROR: Missing type or component")
  const normalized = normalizeTree(tree.component)
  const acc: Collected = { states: new Set(), handlers: new Set(), components: new Set() }
  collect(normalized, acc)
  const needsReact = acc.states.size > 0
  const importsBlock = buildImports(acc.components, needsReact)
  const propsInterface = buildPropsInterface(acc.handlers, acc.states)
  const hasProps = acc.handlers.size > 0
  const paramStr = hasProps ? `{ ${[...acc.handlers].join(", ")} }: Props` : ""
  const stateLines = [...acc.states].map(name => {
    const setter = "set" + name.charAt(0).toUpperCase() + name.slice(1)
    return `  const [${name}, ${setter}] = React.useState(${initialValue(name)})`
  }).join("\n")
  const jsxBody = renderNode(normalized, 2)
  const sections: string[] = ["'use client'", "", importsBlock]
  if (propsInterface) sections.push("", propsInterface)
  sections.push("", `export function ${componentName}(${paramStr}) {`, stateLines ? stateLines + "\n" : "", "  return (", jsxBody, "  )", "}")
  return sections.filter(s => s !== undefined).join("\n")
}

// ─── OPENROUTER CALL ──────────────────────────────────────────────────────────

async function callOpenRouter(model: string, systemPrompt: string, userPrompt: string): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured")

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://sycordpag6163.builtwithrocket.new",
      "X-Title": "Sycord JSON Generator",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenRouter error ${res.status}: ${err}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ""
}

// ─── ROUTE HANDLER ────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { prompt, model, componentName = "GeneratedComponent" } = await request.json()

  if (!prompt || !model) {
    return NextResponse.json({ message: "prompt and model are required" }, { status: 400 })
  }

  // ── STEP 1: Generate raw JSON (ui-tree) ──────────────────────────────────────
  const jsonSystemPrompt = `You are an expert shadcn/ui component architect.
Your task: generate a valid ui-tree JSON object strictly following this schema:
{
  "type": "ui-tree",
  "version": "2.x",
  "component": {
    "name": "<RootComponent>",
    "props": {},
    "children": [...]
  }
}

Rules:
- ONLY output raw JSON. No markdown, no code fences, no explanation.
- Use only shadcn/ui component names (Button, Card, CardHeader, CardTitle, CardContent, CardFooter, Input, Label, Badge, Dialog, etc.)
- Use $state.x for reactive state bindings (e.g. "$state.open")
- Use $handler.x for event handler bindings (e.g. "$handler.onSubmit")
- "true"/"false" as string values for boolean props
- Numeric values as strings (e.g. "700")
- Nest children arrays for compound components
- Every compound component must include its required sub-components`

  let rawJson = ""
  let parsedTree: UITreeRoot | null = null

  try {
    rawJson = await callOpenRouter(model, jsonSystemPrompt, `Generate a shadcn/ui component tree for: ${prompt}`)
    // Strip markdown fences if model wraps output
    rawJson = rawJson.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim()
    parsedTree = JSON.parse(rawJson)
  } catch (err) {
    return NextResponse.json({
      step: "json",
      error: `Step 1 failed: ${err instanceof Error ? err.message : String(err)}`,
      rawJson,
    }, { status: 422 })
  }

  // ── STEP 2: Convert JSON → TypeScript ────────────────────────────────────────
  let tsCode = ""
  try {
    tsCode = convertTreeToTypeScript(parsedTree!, componentName)
  } catch (err) {
    return NextResponse.json({
      step: "typescript",
      error: `Step 2 failed: ${err instanceof Error ? err.message : String(err)}`,
      rawJson,
    }, { status: 422 })
  }

  // ── STEP 3: Generate Flask VM runner output ───────────────────────────────────
  const flaskSystemPrompt = `You are a build system targeting a Flask VM runner.
Given a TypeScript/React component, output a Flask-compatible Python route that:
1. Serves the component as a static HTML string (using Jinja2 template syntax)
2. Includes a /health endpoint
3. Uses Flask best practices
Output ONLY valid Python code. No markdown, no explanation.`

  let flaskOutput = ""
  try {
    flaskOutput = await callOpenRouter(
      model,
      flaskSystemPrompt,
      `Convert this TypeScript component to a Flask VM runner:\n\n${tsCode}`
    )
    flaskOutput = flaskOutput.replace(/^```(?:python)?\n?/i, "").replace(/\n?```$/i, "").trim()
  } catch (err) {
    return NextResponse.json({
      step: "flask",
      error: `Step 3 failed: ${err instanceof Error ? err.message : String(err)}`,
      rawJson,
      tsCode,
    }, { status: 422 })
  }

  return NextResponse.json({
    success: true,
    rawJson,
    tsCode,
    flaskOutput,
    componentName,
    model,
  })
}
