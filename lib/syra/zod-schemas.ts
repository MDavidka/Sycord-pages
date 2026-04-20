import { z } from "zod"
import { allowedComponentNames } from "./manifest"

// ---------------------------------------------------------------------------
// Style JSON – produced by Stage 1 Architect AI
// ---------------------------------------------------------------------------

const NodeSchema: z.ZodType<any> = z.lazy(() =>
  z
    .object({
      id: z
        .string()
        .regex(
          /^[a-z]+_[0-9]{3}$/,
          "Node id must match pattern: lowercase_000  (e.g. card_001)",
        ),
      component: z.enum(allowedComponentNames),
      label:     z.string().optional(),
      variant:   z.string().optional(),
      className: z.string().optional(),
      onClick:   z
        .string()
        .regex(
          /^handle[A-Z][a-zA-Z]+_[0-9]{3}$/,
          "onClick must match pattern: handleXxx_000  (e.g. handleClick_001)",
        )
        .optional(),
      children:  z.array(NodeSchema).optional(),
    })
    .passthrough(), // allow extra props (e.g. placeholder, disabled, value…)
)

export const StyleJsonSchema = z.object({ root: NodeSchema })

// ---------------------------------------------------------------------------
// Function JSON – produced by Stage 3 Developer AI
// ---------------------------------------------------------------------------

export const FunctionJsonSchema = z.object({
  /** useState hook declaration strings, e.g. "const [count, setCount] = useState(0)" */
  state: z.array(z.string()),

  /** onClick handler ID → full arrow-function string */
  handlers: z.record(z.string(), z.string()),

  /** node ID → prop overrides.  Use "{expr}" to inject dynamic JSX. */
  render_injections: z.record(z.string(), z.record(z.string(), z.string())),
})

// ---------------------------------------------------------------------------
// TypeScript types
// ---------------------------------------------------------------------------

export interface StyleNode {
  id: string
  component: string
  label?: string
  variant?: string
  className?: string
  onClick?: string
  children?: StyleNode[]
  [key: string]: unknown
}

export interface StyleJson {
  root: StyleNode
}

export type FunctionJson = z.infer<typeof FunctionJsonSchema>
