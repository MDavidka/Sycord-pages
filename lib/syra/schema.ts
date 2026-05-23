// Syra Zod Schema — Strict AST validation with self-healing.
// The manifest is parsed through Zod immediately after AI generation.
// Invalid payloads trigger fallback defaults, not crashes.

import { z } from "zod"
import { getEntry, registryByName } from "./registry"
import type { ManifestElement, ManifestSection, ManifestPage, ManifestAST } from "./types"

const elementSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(40).refine(
    (t) => registryByName.has(t) || registryByName.has(t.toLowerCase()),
    (t) => ({ message: `Unknown component type "${t}"` })
  ),
  variant: z.enum(["default", "secondary", "destructive", "outline", "ghost", "link"]).optional(),
  size: z.enum(["sm", "default", "lg", "icon"]).optional(),
  className: z.string().max(500).optional(),
  content: z.string().max(1000).optional(),
  children: z.array(z.lazy(() => ManifestElementSchema)).optional(),
})

export const ManifestElementSchema: z.ZodType<ManifestElement> = elementSchema.refine(
  (el) => {
    if (el.content && /<script|<iframe|on\w+\s*=/i.test(el.content)) return false
    if (el.className && /javascript:/i.test(el.className)) return false
    return true
  },
  { message: "Unsafe content detected" }
)

export const ManifestSectionSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(["hero", "features", "pricing", "cta", "faq", "footer", "stats", "testimonials", "contact", "logos", "gallery", "team", "blog", "process", "generic"]),
  layout: z.enum(["centered", "split", "grid-2", "grid-3", "grid-4", "asymmetric", "bento", "alternating"]).optional(),
  bg: z.enum(["default", "muted", "card", "primary/5", "accent/5"]).optional(),
  padding: z.enum(["sm", "md", "lg", "xl"]).optional(),
  elements: z.array(ManifestElementSchema).min(1).max(100),
})

export const ManifestPageSchema = z.object({
  path: z.string().refine((p) => p.startsWith("/"), "Path must start with /"),
  title: z.string().min(1).max(120),
  metaTitle: z.string().min(1).max(120),
  metaDescription: z.string().min(1).max(300),
  sections: z.array(ManifestSectionSchema).min(1).max(30),
})

export const ManifestASTSchema = z.object({
  projectName: z.string().min(1).max(100),
  tagline: z.string().min(1).max(200),
  theme: z.enum(["saas", "agency", "ecommerce", "portfolio", "dark", "minimal"]),
  colorScheme: z.enum(["neutral", "vibrant", "dark", "soft", "high-contrast"]),
  density: z.enum(["minimal", "balanced", "dense"]),
  pages: z.array(ManifestPageSchema).min(1).max(20),
})

export interface ValidationResult<T> {
  ok: boolean
  data: T | null
  errors: string[]
}

export function validateManifest(raw: unknown): ValidationResult<ManifestAST> {
  const result = ManifestASTSchema.safeParse(raw)
  if (result.success) return { ok: true, data: result.data, errors: [] }
  return {
    ok: false,
    data: null,
    errors: result.error.issues.map((i: z.ZodIssue) => `${i.path.join(".")}: ${i.message}`),
  }
}

// Self-healing: heal invalid elements/applications to safe defaults
export function healElement(raw: unknown, id: string): ManifestElement {
  const r = raw as Record<string, unknown> | null
  const type = typeof r?.type === "string" && getEntry(r.type) ? r.type : "badge"
  return {
    id: id || `el_${Date.now().toString(36)}`,
    type,
    variant: (typeof r?.variant === "string" && ["default", "secondary", "destructive", "outline", "ghost", "link"].includes(r.variant)) ? r.variant as ManifestElement["variant"] : undefined,
    size: (typeof r?.size === "string" && ["sm", "default", "lg", "icon"].includes(r.size)) ? r.size as ManifestElement["size"] : undefined,
    className: typeof r?.className === "string" ? r.className : undefined,
    content: typeof r?.content === "string" ? r.content.replace(/<[^>]*>/g, "") : undefined,
    children: Array.isArray(r?.children) ? r.children.map((c: unknown, i: number) => healElement(c, `${id}-ch-${i}`)) : undefined,
  }
}

export function healSection(raw: unknown): ManifestSection {
  const r = raw as Record<string, unknown> | null
  const elements = Array.isArray(r?.elements) ? r.elements.map((el: unknown, i: number) => healElement(el, `el-${i}`)) : [{ id: "el-0", type: "badge", content: "Content" }]
  return {
    id: typeof r?.id === "string" ? r.id : `section-${Date.now().toString(36)}`,
    type: (typeof r?.type === "string" && ["hero", "features", "pricing", "cta", "faq", "footer", "stats", "testimonials", "contact", "logos", "gallery", "team", "blog", "process", "generic"].includes(r.type)) ? r.type as ManifestSection["type"] : "generic",
    layout: typeof r?.layout === "string" ? r.layout as ManifestSection["layout"] : undefined,
    bg: typeof r?.bg === "string" ? r.bg as ManifestSection["bg"] : undefined,
    padding: typeof r?.padding === "string" ? r.padding as ManifestSection["padding"] : undefined,
    elements,
  }
}
