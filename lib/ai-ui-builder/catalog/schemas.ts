import { z } from "zod"
import { BUILDER_COMPONENTS } from "./components"

export const actionRefSchema = z.object({
  type: z.enum(["href", "submit", "patch"]),
  payload: z.string().min(1),
})

const baseNodeSchema = z.object({
  id: z.string().min(1),
  children: z.array(z.any()).optional(),
})

export const buttonSchema = baseNodeSchema.extend({
  component: z.literal("Button"),
  props: z
    .object({
      label: z.string().min(1),
      variant: z.enum(["default", "outline", "ghost", "link"]).optional(),
      disabled: z.boolean().optional(),
      action: actionRefSchema.optional(),
    })
    .passthrough()
    .optional(),
})

export const textLikeSchema = baseNodeSchema.extend({
  component: z.enum(["Text", "Heading"]),
  text: z.string().optional(),
  props: z.object({ size: z.string().optional() }).passthrough().optional(),
})

export const containerLikeSchema = baseNodeSchema.extend({
  component: z.enum(["Page", "Section", "Container", "Grid", "Stack", "Card", "Accordion", "Tabs"]),
  props: z.record(z.string(), z.unknown()).optional(),
})

export const leafNodeSchema = baseNodeSchema.extend({
  component: z.enum(["Input", "Avatar", "Badge", "Image", "LineGraph"]),
  props: z.record(z.string(), z.unknown()).optional(),
})

export const componentNameSchema = z.enum(BUILDER_COMPONENTS)

export const catalogNodeSchema = z.union([buttonSchema, textLikeSchema, containerLikeSchema, leafNodeSchema])
