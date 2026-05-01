// Theme presets for generated sites. Each preset defines a complete
// shadcn-compatible palette in HSL components ("h s% l%") plus typography
// and a default background treatment. Presets get picked deterministically
// from the user's prompt so a "restaurant" prompt looks different from a
// "saas" prompt out of the box, even with the same renderers.

import type { ColorTokens, ThemePreset, ThemeTokens } from "./types"

interface PaletteSpec {
  primary: string
  primaryForeground: string
  accent: string
  accentForeground: string
  ring?: string
}

interface PresetConfig {
  light: PaletteSpec
  dark: PaletteSpec
  fontSans: string
  fontDisplay?: string
  radius: string
  background: ThemeTokens["background"]
}

// Neutral baselines (mostly identical across presets) so the brand color is
// the only thing changing palette-to-palette.
function lightNeutral(p: PaletteSpec): ColorTokens {
  return {
    background: "0 0% 100%",
    foreground: "240 10% 8%",
    card: "0 0% 100%",
    cardForeground: "240 10% 8%",
    popover: "0 0% 100%",
    popoverForeground: "240 10% 8%",
    primary: p.primary,
    primaryForeground: p.primaryForeground,
    secondary: "240 5% 96%",
    secondaryForeground: "240 6% 14%",
    muted: "240 5% 96%",
    mutedForeground: "240 4% 46%",
    accent: p.accent,
    accentForeground: p.accentForeground,
    destructive: "0 84% 60%",
    destructiveForeground: "0 0% 98%",
    border: "240 6% 90%",
    input: "240 6% 90%",
    ring: p.ring ?? p.primary,
  }
}

function darkNeutral(p: PaletteSpec): ColorTokens {
  return {
    background: "240 10% 6%",
    foreground: "0 0% 98%",
    card: "240 8% 9%",
    cardForeground: "0 0% 98%",
    popover: "240 8% 9%",
    popoverForeground: "0 0% 98%",
    primary: p.primary,
    primaryForeground: p.primaryForeground,
    secondary: "240 5% 14%",
    secondaryForeground: "0 0% 98%",
    muted: "240 5% 14%",
    mutedForeground: "240 5% 65%",
    accent: p.accent,
    accentForeground: p.accentForeground,
    destructive: "0 72% 51%",
    destructiveForeground: "0 0% 98%",
    border: "240 5% 18%",
    input: "240 5% 18%",
    ring: p.ring ?? p.primary,
  }
}

const PRESETS: Record<ThemePreset, PresetConfig> = {
  saas: {
    light: { primary: "232 80% 56%", primaryForeground: "0 0% 100%", accent: "210 100% 96%", accentForeground: "232 80% 30%" },
    dark: { primary: "232 90% 70%", primaryForeground: "240 10% 6%", accent: "232 60% 16%", accentForeground: "232 90% 90%" },
    fontSans: '"Inter", "Geist", system-ui, sans-serif',
    fontDisplay: '"Inter", "Geist", system-ui, sans-serif',
    radius: "0.75rem",
    background: "grid",
  },
  agency: {
    light: { primary: "20 90% 55%", primaryForeground: "0 0% 100%", accent: "20 90% 96%", accentForeground: "20 80% 35%" },
    dark: { primary: "20 95% 60%", primaryForeground: "240 10% 6%", accent: "20 80% 18%", accentForeground: "20 95% 92%" },
    fontSans: '"Inter", system-ui, sans-serif',
    fontDisplay: '"Inter", system-ui, sans-serif',
    radius: "0.5rem",
    background: "noise",
  },
  ecommerce: {
    light: { primary: "346 78% 50%", primaryForeground: "0 0% 100%", accent: "30 100% 96%", accentForeground: "346 78% 35%" },
    dark: { primary: "346 85% 60%", primaryForeground: "0 0% 100%", accent: "346 50% 20%", accentForeground: "346 85% 92%" },
    fontSans: '"Inter", system-ui, sans-serif',
    fontDisplay: '"Inter", system-ui, sans-serif',
    radius: "1rem",
    background: "soft",
  },
  portfolio: {
    light: { primary: "240 10% 8%", primaryForeground: "0 0% 100%", accent: "0 0% 96%", accentForeground: "240 10% 8%" },
    dark: { primary: "0 0% 98%", primaryForeground: "240 10% 6%", accent: "240 5% 18%", accentForeground: "0 0% 98%" },
    fontSans: '"Inter", system-ui, sans-serif',
    fontDisplay: '"Geist", "Inter", system-ui, sans-serif',
    radius: "0.5rem",
    background: "plain",
  },
  restaurant: {
    light: { primary: "12 76% 36%", primaryForeground: "30 50% 96%", accent: "30 60% 92%", accentForeground: "12 76% 30%" },
    dark: { primary: "12 80% 60%", primaryForeground: "30 50% 10%", accent: "12 50% 18%", accentForeground: "30 60% 92%" },
    fontSans: '"Inter", system-ui, sans-serif',
    fontDisplay: '"Playfair Display", "Cormorant Garamond", Georgia, serif',
    radius: "0.25rem",
    background: "soft",
  },
  nonprofit: {
    light: { primary: "192 80% 35%", primaryForeground: "0 0% 100%", accent: "192 60% 94%", accentForeground: "192 80% 25%" },
    dark: { primary: "192 80% 55%", primaryForeground: "192 50% 10%", accent: "192 50% 18%", accentForeground: "192 80% 92%" },
    fontSans: '"Inter", system-ui, sans-serif',
    fontDisplay: '"Inter", system-ui, sans-serif',
    radius: "1rem",
    background: "radial",
  },
  event: {
    light: { primary: "286 90% 55%", primaryForeground: "0 0% 100%", accent: "286 100% 96%", accentForeground: "286 90% 35%" },
    dark: { primary: "286 95% 70%", primaryForeground: "286 50% 10%", accent: "286 60% 20%", accentForeground: "286 95% 92%" },
    fontSans: '"Inter", system-ui, sans-serif',
    fontDisplay: '"Inter", system-ui, sans-serif',
    radius: "1.25rem",
    background: "radial",
  },
  creator: {
    light: { primary: "263 80% 55%", primaryForeground: "0 0% 100%", accent: "263 100% 96%", accentForeground: "263 80% 35%" },
    dark: { primary: "263 85% 70%", primaryForeground: "263 50% 10%", accent: "263 60% 20%", accentForeground: "263 90% 92%" },
    fontSans: '"Inter", system-ui, sans-serif',
    fontDisplay: '"Inter", system-ui, sans-serif',
    radius: "1rem",
    background: "radial",
  },
  "local-business": {
    light: { primary: "152 60% 36%", primaryForeground: "0 0% 100%", accent: "152 50% 94%", accentForeground: "152 60% 25%" },
    dark: { primary: "152 65% 50%", primaryForeground: "152 30% 10%", accent: "152 40% 18%", accentForeground: "152 70% 92%" },
    fontSans: '"Inter", system-ui, sans-serif',
    fontDisplay: '"Inter", system-ui, sans-serif',
    radius: "0.5rem",
    background: "grid",
  },
}

export function buildTheme(preset: ThemePreset): ThemeTokens {
  const cfg = PRESETS[preset] ?? PRESETS.saas
  return {
    preset,
    light: lightNeutral(cfg.light),
    dark: darkNeutral(cfg.dark),
    radius: cfg.radius,
    fontSans: cfg.fontSans,
    fontDisplay: cfg.fontDisplay,
    background: cfg.background,
  }
}

// Heuristic preset detection used as a fallback when the AI doesn't return
// (or returns a malformed) themePreset. Keeps the deterministic pipeline
// alive even with a flaky planner model.
export function detectPresetFromPrompt(prompt: string): ThemePreset {
  const p = prompt.toLowerCase()
  const rules: Array<{ preset: ThemePreset; keywords: string[] }> = [
    { preset: "restaurant", keywords: ["restaurant", "menu", "cafe", "bistro", "bakery", "diner", "pizzeria", "food", "dining"] },
    { preset: "ecommerce", keywords: ["shop", "store", "ecommerce", "e-commerce", "storefront", "merch", "candle", "boutique", "product"] },
    { preset: "portfolio", keywords: ["portfolio", "designer", "freelance", "illustrator", "photographer", "3d", "studio of"] },
    { preset: "nonprofit", keywords: ["nonprofit", "non-profit", "charity", "donation", "ocean", "cleanup", "ngo", "fundraiser", "cause"] },
    { preset: "event", keywords: ["event", "conference", "summit", "wedding", "festival", "meetup"] },
    { preset: "creator", keywords: ["creator", "newsletter", "podcast", "youtube", "twitch", "course", "coach"] },
    { preset: "agency", keywords: ["agency", "studio", "branding", "consulting", "marketing"] },
    { preset: "local-business", keywords: ["plumber", "salon", "barber", "gym", "yoga", "clinic", "law firm", "bakery", "auto", "dentist"] },
    { preset: "saas", keywords: ["saas", "software", "platform", "ai", "automation", "scheduling", "dashboard", "tool"] },
  ]
  for (const rule of rules) {
    if (rule.keywords.some((kw) => p.includes(kw))) return rule.preset
  }
  return "saas"
}

export const THEME_PRESETS: ThemePreset[] = [
  "saas",
  "agency",
  "ecommerce",
  "portfolio",
  "restaurant",
  "nonprofit",
  "event",
  "creator",
  "local-business",
]
