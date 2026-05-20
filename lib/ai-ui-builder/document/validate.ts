import { z } from "zod"
import { componentNodeSchema } from "../catalog/schemas"
import { builderPatchSchema } from "./patches"
import type { BuilderDocument } from "./types"

const builderRouteSchema = z
  .object({
    path: z.string().min(1),
    pageId: z.string().min(1),
  })
  .strict()

const builderPageSchema = z
  .object({
    id: z.string().min(1),
    path: z.string().min(1),
    title: z.string().min(1),
    metaTitle: z.string().min(1),
    metaDescription: z.string().min(1),
    tree: componentNodeSchema,
  })
  .strict()

const builderThemeSchema = z
  .object({
    preset: z.string().min(1),
    tokens: z.record(z.unknown()),
  })
  .strict()

const builderDocumentSchema = z
  .object({
    id: z.string().min(1),
    version: z.number().int().min(1),
    componentCatalogVersion: z.string().min(1),
    pages: z.array(builderPageSchema).min(1),
    routes: z.array(builderRouteSchema),
    theme: builderThemeSchema,
    state: z.record(z.unknown()),
    history: z.array(builderPatchSchema),
  })
  .strict()

export interface DocumentValidation {
  ok: boolean
  errors: string[]
}

export function validateBuilderDocument(document: BuilderDocument): DocumentValidation {
  const result = builderDocumentSchema.safeParse(document)
  if (result.success) return { ok: true, errors: [] }
  return { ok: false, errors: result.error.errors.map((err) => `${err.path.join(".")}: ${err.message}`) }
}
