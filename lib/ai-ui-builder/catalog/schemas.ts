import { z } from "zod"
import type { ComponentNode } from "./components"
import type { ActionKind } from "./actions"

const classNameSchema = z.string().max(500)

const actionRefSchema = z
  .object({
    kind: z.enum(["navigate", "submit", "open-modal", "custom"] satisfies ActionKind[]),
    target: z.string().optional(),
    label: z.string().optional(),
    payload: z.record(z.unknown()).optional(),
  })
  .strict()

const baseNode = {
  id: z.string().min(1),
  text: z.string().optional(),
}

const createNodeSchema = <T extends z.ZodTypeAny>(
  component: string,
  propsSchema: T,
) =>
  z
    .object({
      ...baseNode,
      component: z.literal(component),
      props: propsSchema.optional(),
      children: z.array(componentNodeSchema).optional(),
    })
    .strict()

const pagePropsSchema = z.object({ className: classNameSchema.optional(), class: classNameSchema.optional() }).strict()
const sectionPropsSchema = z.object({ className: classNameSchema.optional(), class: classNameSchema.optional(), anchor: z.string().optional(), id: z.string().optional() }).strict()
const containerPropsSchema = z.object({ className: classNameSchema.optional(), class: classNameSchema.optional() }).strict()
const gridPropsSchema = z
  .object({ className: classNameSchema.optional(), class: classNameSchema.optional(), columns: z.number().int().min(1).max(6).optional() })
  .strict()
const stackPropsSchema = z
  .object({ className: classNameSchema.optional(), class: classNameSchema.optional(), gap: z.number().int().min(0).max(16).optional() })
  .strict()
const buttonPropsSchema = z
  .object({
    className: classNameSchema.optional(),
    class: classNameSchema.optional(),
    label: z.string().optional(),
    variant: z.enum(["default", "outline", "ghost", "link", "secondary"]).optional(),
    size: z.enum(["sm", "md", "lg", "icon"]).optional(),
    disabled: z.boolean().optional(),
    action: actionRefSchema.optional(),
  })
  .strict()
const cardPropsSchema = z.object({ className: classNameSchema.optional(), class: classNameSchema.optional() }).strict()
const badgePropsSchema = z.object({ className: classNameSchema.optional(), class: classNameSchema.optional(), variant: z.string().optional() }).strict()
const accordionPropsSchema = z
  .object({
    className: classNameSchema.optional(),
    class: classNameSchema.optional(),
    type: z.enum(["single", "multiple"]).optional(),
    defaultValue: z.string().optional(),
    collapsible: z.boolean().optional(),
  })
  .strict()
const accordionItemPropsSchema = z.object({ className: classNameSchema.optional(), class: classNameSchema.optional(), value: z.string().optional() }).strict()
const tabsPropsSchema = z
  .object({ className: classNameSchema.optional(), class: classNameSchema.optional(), defaultValue: z.string().optional(), value: z.string().optional() })
  .strict()
const tabsItemPropsSchema = z.object({ className: classNameSchema.optional(), class: classNameSchema.optional(), value: z.string().optional() }).strict()
const inputPropsSchema = z
  .object({
    className: classNameSchema.optional(),
    class: classNameSchema.optional(),
    type: z.string().optional(),
    placeholder: z.string().optional(),
    value: z.string().optional(),
    defaultValue: z.string().optional(),
    disabled: z.boolean().optional(),
    required: z.boolean().optional(),
  })
  .strict()
const textareaPropsSchema = z
  .object({
    className: classNameSchema.optional(),
    class: classNameSchema.optional(),
    placeholder: z.string().optional(),
    value: z.string().optional(),
    defaultValue: z.string().optional(),
    rows: z.number().int().min(1).max(20).optional(),
  })
  .strict()
const labelPropsSchema = z.object({ className: classNameSchema.optional(), class: classNameSchema.optional(), htmlFor: z.string().optional() }).strict()
const avatarPropsSchema = z
  .object({ className: classNameSchema.optional(), class: classNameSchema.optional(), src: z.string().optional(), alt: z.string().optional(), fallback: z.string().optional() })
  .strict()
const separatorPropsSchema = z
  .object({ className: classNameSchema.optional(), class: classNameSchema.optional(), orientation: z.enum(["horizontal", "vertical"]).optional() })
  .strict()
const imagePropsSchema = z
  .object({
    className: classNameSchema.optional(),
    class: classNameSchema.optional(),
    src: z.string().optional(),
    alt: z.string().optional(),
    width: z.number().int().min(1).optional(),
    height: z.number().int().min(1).optional(),
  })
  .strict()
const linkPropsSchema = z
  .object({
    className: classNameSchema.optional(),
    class: classNameSchema.optional(),
    href: z.string().optional(),
    target: z.string().optional(),
    rel: z.string().optional(),
  })
  .strict()
const headingPropsSchema = z
  .object({ className: classNameSchema.optional(), class: classNameSchema.optional(), level: z.number().int().min(1).max(6).optional() })
  .strict()
const statPropsSchema = z
  .object({
    className: classNameSchema.optional(),
    class: classNameSchema.optional(),
    value: z.string().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  })
  .strict()
const pricingCardPropsSchema = z
  .object({ className: classNameSchema.optional(), class: classNameSchema.optional(), title: z.string().optional(), cta: z.string().optional() })
  .strict()
const featureCardPropsSchema = z
  .object({ className: classNameSchema.optional(), class: classNameSchema.optional(), title: z.string().optional(), description: z.string().optional() })
  .strict()
const lineGraphPropsSchema = z
  .object({
    className: classNameSchema.optional(),
    class: classNameSchema.optional(),
    data: z
      .array(
        z.object({
          name: z.string(),
          value: z.number(),
        }),
      )
      .optional(),
    xKey: z.string().optional(),
    yKey: z.string().optional(),
    color: z.string().optional(),
  })
  .strict()

const componentNodeSchema: z.ZodType<ComponentNode> = z.lazy(() =>
  z.discriminatedUnion("component", [
    createNodeSchema("Page", pagePropsSchema),
    createNodeSchema("Section", sectionPropsSchema),
    createNodeSchema("Container", containerPropsSchema),
    createNodeSchema("Grid", gridPropsSchema),
    createNodeSchema("Stack", stackPropsSchema),
    createNodeSchema("Button", buttonPropsSchema),
    createNodeSchema("Card", cardPropsSchema),
    createNodeSchema("CardHeader", cardPropsSchema),
    createNodeSchema("CardTitle", cardPropsSchema),
    createNodeSchema("CardDescription", cardPropsSchema),
    createNodeSchema("CardContent", cardPropsSchema),
    createNodeSchema("CardFooter", cardPropsSchema),
    createNodeSchema("Badge", badgePropsSchema),
    createNodeSchema("Accordion", accordionPropsSchema),
    createNodeSchema("AccordionItem", accordionItemPropsSchema),
    createNodeSchema("AccordionTrigger", cardPropsSchema),
    createNodeSchema("AccordionContent", cardPropsSchema),
    createNodeSchema("Tabs", tabsPropsSchema),
    createNodeSchema("TabsList", cardPropsSchema),
    createNodeSchema("TabsTrigger", tabsItemPropsSchema),
    createNodeSchema("TabsContent", tabsItemPropsSchema),
    createNodeSchema("Input", inputPropsSchema),
    createNodeSchema("Textarea", textareaPropsSchema),
    createNodeSchema("Label", labelPropsSchema),
    createNodeSchema("Avatar", avatarPropsSchema),
    createNodeSchema("Separator", separatorPropsSchema),
    createNodeSchema("Image", imagePropsSchema),
    createNodeSchema("Link", linkPropsSchema),
    createNodeSchema("Heading", headingPropsSchema),
    createNodeSchema("Text", cardPropsSchema),
    createNodeSchema("Stat", statPropsSchema),
    createNodeSchema("PricingCard", pricingCardPropsSchema),
    createNodeSchema("FeatureCard", featureCardPropsSchema),
    createNodeSchema("LineGraph", lineGraphPropsSchema),
  ]),
)

export { actionRefSchema, componentNodeSchema }
