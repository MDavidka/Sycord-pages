"use client"

import type { BlockConfig } from "@/lib/builder/types"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useVars, pagePathToFilename } from "@/lib/builder/variables"
import { useEditorStore } from "@/components/builder/store/editor-store"

type Align = "left" | "center" | "right"

function alignClass(align?: string): string {
  if (align === "center") return "justify-center text-center"
  if (align === "right") return "justify-end text-right"
  return "justify-start text-left"
}

function textAlignClass(align?: string): string {
  if (align === "center") return "text-center"
  if (align === "right") return "text-right"
  return "text-left"
}

/* -------------------------------------------------------------------------- */
/*  Button                                                                    */
/* -------------------------------------------------------------------------- */
export function ButtonBlock({ block }: { block: BlockConfig }) {
  const p = block.props as { text?: string; size?: string; align?: Align; url?: string; fullWidth?: boolean; actionType?: string; pagePath?: string }
  const variant = (block.variant || "default") as
    | "default" | "secondary" | "outline" | "ghost" | "link" | "destructive"
  const size = (p.size || "default") as "default" | "sm" | "lg"
  const resolve = useVars()
  const previewMode = useEditorStore((s) => s.previewMode)
  const href = p.actionType === "page" ? pagePathToFilename(p.pagePath || "/") : p.url || "#"

  return (
    <div className={`px-6 py-4 flex ${alignClass(p.align)}`}>
      <Button variant={variant} size={size} className={p.fullWidth ? "w-full" : ""} asChild>
        <a href={href} onClick={(e) => { if (!previewMode) e.preventDefault() }}>{resolve(p.text || "Button")}</a>
      </Button>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Heading                                                                   */
/* -------------------------------------------------------------------------- */
export function HeadingBlock({ block }: { block: BlockConfig }) {
  const p = block.props as { text?: string; align?: Align }
  const resolve = useVars()
  const level = (block.variant || "h2") as "h1" | "h2" | "h3" | "h4"
  const sizes: Record<string, string> = {
    h1: "text-4xl @md:text-5xl font-bold tracking-tight",
    h2: "text-3xl @md:text-4xl font-bold tracking-tight",
    h3: "text-2xl font-semibold tracking-tight",
    h4: "text-xl font-semibold",
  }
  const Tag = level

  return (
    <div className="px-6 py-3">
      <Tag className={`${sizes[level]} ${textAlignClass(p.align)} text-foreground`}>{resolve(p.text || "Heading")}</Tag>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Text                                                                      */
/* -------------------------------------------------------------------------- */
export function TextBlock({ block }: { block: BlockConfig }) {
  const p = block.props as { text?: string; align?: Align }
  const resolve = useVars()
  const variant = block.variant || "base"
  const styles: Record<string, string> = {
    base: "text-[15px] leading-relaxed text-foreground/90",
    lead: "text-lg @md:text-xl leading-relaxed text-foreground/90",
    muted: "text-[15px] leading-relaxed text-muted-foreground",
    small: "text-[13px] leading-relaxed text-muted-foreground",
  }
  return (
    <div className="px-6 py-3">
      <p className={`${styles[variant] || styles.base} ${textAlignClass(p.align)} max-w-2xl ${p.align === "center" ? "mx-auto" : p.align === "right" ? "ml-auto" : ""}`}>
        {resolve(p.text || "Text")}
      </p>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Badge                                                                     */
/* -------------------------------------------------------------------------- */
export function BadgeBlock({ block }: { block: BlockConfig }) {
  const p = block.props as { text?: string; align?: Align }
  const variant = (block.variant || "default") as "default" | "secondary" | "outline" | "destructive"
  return (
    <div className={`px-6 py-3 flex ${alignClass(p.align)}`}>
      <Badge variant={variant}>{p.text || "Badge"}</Badge>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Card                                                                      */
/* -------------------------------------------------------------------------- */
export function CardElementBlock({ block }: { block: BlockConfig }) {
  const p = block.props as { title?: string; description?: string; body?: string; buttonText?: string }
  const ghost = block.variant === "ghost"
  return (
    <div className="px-6 py-4">
      <Card className={ghost ? "border-none shadow-none bg-transparent" : ""}>
        <CardHeader>
          {p.title && <CardTitle>{p.title}</CardTitle>}
          {p.description && <CardDescription>{p.description}</CardDescription>}
        </CardHeader>
        {p.body && (
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{p.body}</p>
          </CardContent>
        )}
        {p.buttonText && (
          <CardFooter>
            <Button size="sm">{p.buttonText}</Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
