// Credit system for AI generation
//
// Two tiers:
//   - "best" : higher-quality models (Gemini Pro, DeepSeek V3, etc.)
//             costs BEST_COST_PER_FILE credits per generated file
//   - "fast" : faster / lighter models (Gemini Flash, NVIDIA uploaded text model)
//             costs FAST_COST_PER_FILE credits per generated file
//
// Balance is tracked per-user in the `users.credits` field (MongoDB).
// New users are seeded lazily on first read with DEFAULT_CREDITS_FREE (or the
// premium allowance when `isPremium` is true).

export type ModelTier = "best" | "fast"

export const BEST_COST_PER_FILE = 0.8
export const FAST_COST_PER_FILE = 0.1

// Default balance seeded for new / un-initialised users.
export const DEFAULT_CREDITS_FREE = 10
export const DEFAULT_CREDITS_PREMIUM = 200

// Model-name patterns that mark a model as "fast" tier. The explicit
// `model.fast === true` property still takes priority; this pattern is
// only consulted when a model doesn't declare its tier.
const FAST_MODEL_PATTERN = /flash|lite|mini|nvidia/

/**
 * Classify a model id/name into a tier.
 *
 * Priority: an explicit `fast: true` on the model wins. Otherwise we inspect
 * the id/name for well-known "lightweight" markers. If nothing matches we
 * default to the higher-quality "best" tier.
 */
export function tierOf(model: { id?: string; name?: string; fast?: boolean }): ModelTier {
  if (model.fast) return "fast"
  const hay = `${model.id ?? ""} ${model.name ?? ""}`.toLowerCase()
  if (FAST_MODEL_PATTERN.test(hay)) return "fast"
  return "best"
}

/** Cost per generated file for the given tier. */
export function costPerFile(tier: ModelTier): number {
  return tier === "best" ? BEST_COST_PER_FILE : FAST_COST_PER_FILE
}

/** Seed balance for a user based on premium status. */
export function seedBalance(isPremium: boolean): number {
  return isPremium ? DEFAULT_CREDITS_PREMIUM : DEFAULT_CREDITS_FREE
}

/** Format a credit amount for UI (no trailing zeros, 2-decimal max). */
export function formatCredits(n: number): string {
  if (!Number.isFinite(n)) return "0"
  const rounded = Math.round(n * 100) / 100
  return rounded.toString()
}
