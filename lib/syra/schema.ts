// Syra Zod Schema — validates the ManifestAST against the spec.
// Every AI-generated JSON passes through this before touching the file system.

import { z } from "zod"
import { byPrimitive } from "./registry"
import type { ManifestAST, ManifestComponent } from "./types"

const componentSchema: z.ZodType<ManifestComponent> = z.object({
  id: z.string().min(1).max(64),
  shadcnPrimitive: z.string().refine((t) => byPrimitive.has(t), { message: "Unknown shadcn primitive" }),
  purpose: z.string().max(200).optional(),
  styles: z.object({ customTailwindClasses: z.string().max(500).optional() }).optional(),
  props: z.record(z.string(), z.unknown()).optional(),
  children: z.array(z.lazy(() => componentSchema)).nullable().optional(),
})

const sectionSchema = z.object({
  sectionId: z.string().min(1).max(64),
  semanticType: z.enum(["hero", "features", "pricing", "testimonials", "cta", "faq", "footer", "stats", "contact", "logos", "gallery", "team", "blog", "process", "generic"]),
  displayName: z.string().min(1).max(120),
  layoutContainer: z.enum(["container-grid", "container-flex", "full-width"]),
  gridCols: z.number().int().min(1).max(6).nullable(),
  components: z.array(componentSchema).min(1).max(100),
})

const pageSchema = z.object({
  pageId: z.string().min(1).max(64),
  slug: z.string().min(1).max(100),
  title: z.string().min(1).max(120),
  metaDescription: z.string().min(1).max(300),
  layout: z.object({
    rootType: z.literal("flex-col"),
    headerEnabled: z.boolean(),
    footerEnabled: z.boolean(),
    sections: z.array(sectionSchema).min(1).max(30),
  }),
})

export const ManifestASTSchema = z.object({
  $schema: z.string().optional(),
  siteMetadata: z.object({
    projectId: z.string(),
    siteName: z.string(),
    globalTheme: z.object({
      variant: z.enum(["dark", "light"]),
      primaryColor: z.string(),
      borderRadius: z.string(),
    }),
  }),
  routingGraph: z.array(z.object({
    sourcePageId: z.string(),
    targetPageId: z.string(),
    triggerElementId: z.string(),
    actionType: z.literal("PUSH_ROUTE"),
  })).optional().default([]),
  pages: z.array(pageSchema).min(1).max(20),
})

export interface ValidationResult {
  ok: boolean
  data: ManifestAST | null
  errors: string[]
}

export function validate(raw: unknown): ValidationResult {
  const r = ManifestASTSchema.safeParse(raw)
  if (r.success) return { ok: true, data: r.data, errors: [] }
  return { ok: false, data: null, errors: r.error.issues.map((i: z.ZodIssue) => `${i.path.join(".")}: ${i.message}`) }
}
