// Syra Zod Schema — zero-trust validation layer.

import { z } from "zod"
import { registryByName } from "./registry"
import type { ManifestElement, ManifestSection, ManifestPage, SiteManifest } from "./types"

const allowedTypes = registryByName.has.bind(registryByName)

// ── Element Schema ────────────────────────────────────────────

const elementSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.string().min(1).max(40).refine(
    (t) => registryByName.has(t),
    { message: "Unknown component type — must be in registry" }
  ),
  variant: z.enum(["default", "secondary", "destructive", "outline", "ghost", "link", "primary", "muted", "accent"]).optional(),
  size: z.enum(["sm", "default", "lg", "icon", "xs", "xl"]).optional(),
  className: z.string().max(500).optional(),
  content: z.string().max(1000).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  isClient: z.boolean().optional(),
  logicSwitch: z.string().max(40).optional(),
  children: z.array(z.lazy(() => ManifestElementSchema)).optional(),
})

export const ManifestElementSchema: z.ZodType<ManifestElement> = elementSchema.refine(
  (el) => {
    if (el.content) {
      if (/<script/i.test(el.content)) return false
      if (/on\w+\s*=/.test(el.content)) return false
      if (/javascript:/i.test(el.content)) return false
    }
    if (el.className) {
      if (/javascript:/i.test(el.className)) return false
    }
    return true
  },
  { message: "Element contains unsafe HTML or script injection" }
)

// ── Section Schema ────────────────────────────────────────────

export const ManifestSectionSchema = z.object({
  id: z.string().min(1).max(64),
  section: z.enum(["hero", "features", "pricing", "cta", "faq", "footer", "stats", "testimonials", "contact", "logos", "gallery", "team", "blog", "process", "generic"]),
  layout: z.enum(["centered", "split", "grid-2col", "grid-3col", "grid-4col", "asymmetric", "alternating", "bento", "marquee"]).optional(),
  bg: z.enum(["default", "muted", "card", "primary/5", "accent/5"]).optional(),
  padding: z.enum(["sm", "md", "lg", "xl"]).optional(),
  elements: z.array(ManifestElementSchema).min(1).max(100),
})

// ── Page Schema ───────────────────────────────────────────────

export const ManifestPageSchema = z.object({
  path: z.string().min(1).max(100).refine((p) => p.startsWith("/"), "Path must start with /"),
  title: z.string().min(1).max(120),
  metaTitle: z.string().min(1).max(120),
  metaDescription: z.string().min(1).max(300),
  sections: z.array(ManifestSectionSchema).min(1).max(30),
})

// ── Site Manifest Schema ──────────────────────────────────────

export const SiteManifestSchema = z.object({
  projectName: z.string().min(1).max(100),
  tagline: z.string().min(1).max(200),
  theme: z.enum(["saas", "agency", "ecommerce", "portfolio", "dark", "minimal"]),
  colorScheme: z.enum(["neutral", "vibrant", "dark", "soft", "high-contrast"]),
  density: z.enum(["minimal", "balanced", "dense"]),
  pages: z.array(ManifestPageSchema).min(1).max(20),
})

// ── Helper: Validate with fallback ────────────────────────────

export interface ValidationResult<T> {
  ok: boolean
  data: T | null
  errors: string[]
}

export function validateManifest(raw: unknown): ValidationResult<SiteManifest> {
  const result = SiteManifestSchema.safeParse(raw)
  if (result.success) {
    return { ok: true, data: result.data, errors: [] }
  }
  const errors = result.error.issues.map(
    (issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`
  )
  return { ok: false, data: null, errors }
}

export function validateElement(raw: unknown): ValidationResult<ManifestElement> {
  const result = ManifestElementSchema.safeParse(raw)
  if (result.success) {
    return { ok: true, data: result.data, errors: [] }
  }
  const errors = result.error.issues.map(
    (issue: z.ZodIssue) => `${issue.path.join(".")}: ${issue.message}`
  )
  return { ok: false, data: null, errors }
}

// ── Self-Healing: Fallback element with safe defaults ─────────

export function fallbackElement(type: string, id: string): ManifestElement {
  return {
    id,
    type: registryByName.has(type) ? type : "badge",
    variant: "default",
    content: "Content",
  }
}

export function healElement(raw: unknown): ManifestElement {
  const result = ManifestElementSchema.safeParse(raw)
  if (result.success) return result.data

  const r = raw as Record<string, unknown> | null
  const id = typeof r?.id === "string" ? r.id : `el_${Math.random().toString(36).slice(2, 8)}`
  const type = typeof r?.type === "string" ? r.type : "badge"

  const healed: Record<string, unknown> = {
    id,
    type: registryByName.has(type) ? type : "badge",
    variant: (typeof r?.variant === "string" && ["default", "secondary", "destructive", "outline", "ghost", "link"].includes(r.variant)) ? r.variant : "default",
    size: (typeof r?.size === "string" && ["sm", "default", "lg", "icon"].includes(r.size)) ? r.size : undefined,
    content: typeof r?.content === "string" ? r.content.replace(/<[^>]*>/g, "") : undefined,
  }

  // Recurse children
  if (Array.isArray(r?.children)) {
    healed.children = r.children.map((c: unknown) => healElement(c))
  }

  const finalResult = ManifestElementSchema.safeParse(healed)
  return finalResult.success ? finalResult.data : fallbackElement(type, id)
}
