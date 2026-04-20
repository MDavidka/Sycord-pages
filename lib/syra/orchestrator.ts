import { StyleJson, StyleNode, FunctionJson } from "./zod-schemas"

// ---------------------------------------------------------------------------
// A — Import Scanner
// ---------------------------------------------------------------------------

/**
 * Maps every whitelisted component name to its de-duplicated import line.
 * All members of the same file share an identical import string so that
 * buildImports() can de-duplicate with a Set.
 */
const importMap: Record<string, string> = {
  Alert:            `import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"`,
  AlertTitle:       `import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"`,
  AlertDescription: `import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"`,

  AlertDialog:            `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,
  AlertDialogTrigger:     `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,
  AlertDialogContent:     `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,
  AlertDialogHeader:      `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,
  AlertDialogTitle:       `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,
  AlertDialogDescription: `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,
  AlertDialogFooter:      `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,
  AlertDialogAction:      `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,
  AlertDialogCancel:      `import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from "@/components/ui/alert-dialog"`,

  Avatar:         `import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"`,
  AvatarImage:    `import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"`,
  AvatarFallback: `import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"`,

  Badge: `import { Badge } from "@/components/ui/badge"`,

  Button: `import { Button } from "@/components/ui/button"`,

  Card:            `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"`,
  CardHeader:      `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"`,
  CardTitle:       `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"`,
  CardDescription: `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"`,
  CardContent:     `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"`,
  CardFooter:      `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"`,
  CardAction:      `import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, CardAction } from "@/components/ui/card"`,

  Dialog:            `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"`,
  DialogContent:     `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"`,
  DialogHeader:      `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"`,
  DialogTitle:       `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"`,
  DialogDescription: `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"`,
  DialogFooter:      `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"`,
  DialogTrigger:     `import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"`,

  DropdownMenu:          `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"`,
  DropdownMenuTrigger:   `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"`,
  DropdownMenuContent:   `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"`,
  DropdownMenuItem:      `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"`,
  DropdownMenuLabel:     `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"`,
  DropdownMenuSeparator: `import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"`,

  Input: `import { Input } from "@/components/ui/input"`,
  Label: `import { Label } from "@/components/ui/label"`,

  Progress: `import { Progress } from "@/components/ui/progress"`,

  Sheet:            `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet"`,
  SheetContent:     `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet"`,
  SheetHeader:      `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet"`,
  SheetTitle:       `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet"`,
  SheetDescription: `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet"`,
  SheetFooter:      `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet"`,
  SheetTrigger:     `import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter, SheetTrigger } from "@/components/ui/sheet"`,

  Skeleton: `import { Skeleton } from "@/components/ui/skeleton"`,
  Switch:   `import { Switch } from "@/components/ui/switch"`,
  Textarea: `import { Textarea } from "@/components/ui/textarea"`,
}

// ---------------------------------------------------------------------------
// Helpers used by both orchestrator steps and API routes
// ---------------------------------------------------------------------------

/** Walk the Style JSON tree and collect every unique component name used. */
export function extractUsedComponents(node: StyleNode): string[] {
  const used = new Set<string>()
  function walk(n: StyleNode) {
    used.add(n.component)
    n.children?.forEach(walk)
  }
  walk(node)
  return [...used]
}

// ---------------------------------------------------------------------------
// B — State block
// ---------------------------------------------------------------------------
export function buildStateBlock(state: string[]): string {
  return state.join("\n  ")
}

// ---------------------------------------------------------------------------
// C — Handler block
// ---------------------------------------------------------------------------
export function buildHandlerBlock(handlers: Record<string, string>): string {
  return Object.values(handlers).join("\n  ")
}

// ---------------------------------------------------------------------------
// A (continued) — Build import lines from used component list
// ---------------------------------------------------------------------------
export function buildImports(usedComponents: string[]): string {
  const lines = new Set<string>()
  usedComponents.forEach((c) => {
    if (importMap[c]) lines.add(importMap[c])
  })
  lines.add(`import { useState } from "react"`)
  return [...lines].join("\n")
}

// ---------------------------------------------------------------------------
// D — Recursive JSX walker
// ---------------------------------------------------------------------------

function buildPropString(
  node: StyleNode,
  inj: Record<string, string>,
): string {
  const skip = new Set(["id", "component", "children", "label"])
  const merged: Record<string, unknown> = { ...(node as Record<string, unknown>), ...inj }

  const parts = Object.entries(merged)
    .filter(([k]) => !skip.has(k))
    .map(([k, v]) => {
      const val = String(v)
      // onClick always references a handler by name
      if (k === "onClick") return `onClick={${val}}`
      // "{expr}" → dynamic prop
      if (val.startsWith("{") && val.endsWith("}")) {
        return `${k}={${val.slice(1, -1)}}`
      }
      return `${k}="${val}"`
    })

  return parts.length ? ` ${parts.join(" ")}` : ""
}

export function renderNode(
  node: StyleNode,
  injections: Record<string, Record<string, string>>,
  depth = 0,
): string {
  const inj    = injections[node.id] ?? {}
  const props  = buildPropString(node, inj)
  const tag    = node.component
  const pad    = "  ".repeat(depth)
  const padIn  = "  ".repeat(depth + 1)

  // Leaf node
  if (!node.children || node.children.length === 0) {
    const content = inj.children ?? node.label ?? ""
    if (!content) return `${pad}<${tag}${props} />`
    return `${pad}<${tag}${props}>${content}</${tag}>`
  }

  const childrenJsx = node.children
    .map((child) => renderNode(child, injections, depth + 1))
    .join("\n")

  return `${pad}<${tag}${props}>\n${childrenJsx}\n${pad}</${tag}>`
}

// ---------------------------------------------------------------------------
// E — TSX file assembler
// ---------------------------------------------------------------------------
export function assemble(styleJson: StyleJson, functionJson: FunctionJson): string {
  const usedComponents = extractUsedComponents(styleJson.root)
  const imports  = buildImports(usedComponents)
  const stateStr   = functionJson.state.length
    ? "\n  " + buildStateBlock(functionJson.state)
    : ""
  const handleStr  = Object.keys(functionJson.handlers).length
    ? "\n  " + buildHandlerBlock(functionJson.handlers)
    : ""
  const jsx = renderNode(styleJson.root, functionJson.render_injections, 2)

  return [
    `"use client"`,
    ``,
    imports,
    ``,
    `export default function App() {${stateStr}${handleStr}`,
    ``,
    `  return (`,
    jsx,
    `  )`,
    `}`,
    ``,
  ].join("\n")
}

// ---------------------------------------------------------------------------
// Stage 5 — Build Gate (lightweight static validation)
// ---------------------------------------------------------------------------
export function validateTsx(tsx: string): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // 1. Every JSX tag starting with an uppercase letter must appear in an import
  const jsxTags = [...tsx.matchAll(/<([A-Z][a-zA-Z]*)/g)].map((m) => m[1])
  for (const tag of new Set(jsxTags)) {
    // Look for the identifier in any import line
    if (!new RegExp(`\\b${tag}\\b`).test(tsx.split("export default")[0])) {
      errors.push(`Component <${tag}> is used but not imported`)
    }
  }

  // 2. Balanced curly braces (ignoring template literals for now)
  let braces = 0
  let parens = 0
  for (const ch of tsx) {
    if (ch === "{") braces++
    if (ch === "}") braces--
    if (ch === "(") parens++
    if (ch === ")") parens--
  }
  if (braces !== 0)
    errors.push(
      `Unbalanced curly braces: ${braces > 0 ? `${braces} unclosed` : `${Math.abs(braces)} extra closing`}`,
    )
  if (parens !== 0)
    errors.push(
      `Unbalanced parentheses: ${parens > 0 ? `${parens} unclosed` : `${Math.abs(parens)} extra closing`}`,
    )

  // 3. Must have export default function
  if (!tsx.includes("export default function")) {
    errors.push("Missing export default function")
  }

  return { valid: errors.length === 0, errors }
}
