// Shared type for the architect plan entries. Pulled out of the architect
// route so the manifest + style + logic stages can consume the same shape
// without duplicating fields.

export type PlanContentType =
  | "marketing"
  | "commerce"
  | "dashboard"
  | "docs"
  | "portfolio"
  | "support"
  | "blog"

export interface PlanEntry {
  /** Route path beginning with "/". First entry is always "/". */
  path: string
  /** Short page title — used as the React component name and SiteNav label. */
  title: string
  /**
   * 3–5 sentence description of the page's purpose, target visitor and
   * concrete sections it must render. The Style stage uses this verbatim.
   */
  description?: string
  /** At least 4 concrete user-facing features / sections / interactions. */
  features?: string[]
  /** The page's primary action ("happy path"), e.g. "Shop now". */
  primaryAction?: string
  /** Optional secondary action, e.g. "View deals". */
  secondaryAction?: string
  /** Who the visitor is at this point, e.g. "first-time visitor". */
  audience?: string
  /** What flavour of content this page renders. */
  contentType?: PlanContentType
}
