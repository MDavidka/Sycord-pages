// Client-safe Syra model profile metadata (no server imports).
//
// These mirror the model profiles the Syte runtime accepts on agent_change:
//   syra-nano (fast) · syra-base (balanced) · syra-havy (capable)

export type SyraModelProfile = "syra-nano" | "syra-base" | "syra-havy"

export interface SyraModelProfileChoice {
  id: SyraModelProfile
  label: string
  subtitle: string
}

export const SYRA_MODEL_CHOICES: SyraModelProfileChoice[] = [
  { id: "syra-nano", label: "syra-nano", subtitle: "Fast" },
  { id: "syra-base", label: "syra-base", subtitle: "Balanced" },
  { id: "syra-havy", label: "syra-havy", subtitle: "Capable" },
]

export const DEFAULT_SYRA_PROFILE: SyraModelProfile = "syra-base"
