import { z } from "zod"
import { COMPONENT_CATALOG_VERSION } from "../catalog/components"
import { catalogNodeSchema } from "../catalog/schemas"

const builderNodeSchema: z.ZodType<any> = catalogNodeSchema.extend({
  children: z.lazy(() => builderNodeSchema.array()).optional(),
})

export const builderDocumentSchema = z.object({
  id: z.string().min(1),
  version: z.number().int().positive(),
  pages: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        path: z.string().startsWith("/"),
        tree: builderNodeSchema,
      }),
    )
    .min(1),
  routes: z.array(z.object({ id: z.string(), pageId: z.string(), path: z.string().startsWith("/") })),
  theme: z.record(z.string(), z.unknown()),
  componentCatalogVersion: z.string().default(COMPONENT_CATALOG_VERSION),
  state: z.enum(["draft", "stable"]),
  history: z.array(z.object({ op: z.enum(["add", "replace", "remove"]), path: z.string(), value: z.unknown().optional() })),
})

export function validateBuilderDocument(input: unknown) {
  return builderDocumentSchema.safeParse(input)
}
