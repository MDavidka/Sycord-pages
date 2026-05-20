export type ActionKind = "navigate" | "submit" | "open-modal" | "custom"

export interface ActionRef {
  kind: ActionKind
  target?: string
  label?: string
  payload?: Record<string, unknown>
}
