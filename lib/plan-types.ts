// Shared type for the architect plan entries. Pulled out of the architect
// route so the manifest + style + logic stages can consume the same shape
// without duplicating fields.

export interface PlanEntry {
  path: string
  title: string
  description?: string
  features?: string[]
}
