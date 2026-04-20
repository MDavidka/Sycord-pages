import { z } from "zod"

export function createStyleJsonSchema(allowedComponents: string[]) {
  const StyleNodeSchema: z.ZodType<any> = z.lazy(() =>
    z.object({
      id: z.string().regex(/^[a-z]+_[0-9]{3}$/),
      component: z.string().refine((value) => allowedComponents.includes(value), {
        message: "Unknown component",
      }),
      label: z.string().optional(),
      variant: z.string().optional(),
      className: z.string().optional(),
      onClick: z
        .string()
        .regex(/^handle[A-Z][a-zA-Z]+_[0-9]{3}$/)
        .optional(),
      children: z.array(StyleNodeSchema).optional(),
    })
  )

  return z.object({
    root: StyleNodeSchema,
  })
}

export const FunctionJsonSchema = z.object({
  state: z.array(z.string()),
  handlers: z.record(z.string(), z.string()),
  render_injections: z.record(z.string(), z.record(z.string(), z.string())),
})
