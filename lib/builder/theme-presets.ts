import type { ThemeConfig } from "@/lib/builder/types"

export const defaultTheme: ThemeConfig = {
  bg0: "#09090b",
  bg1: "#0f0f12",
  bg2: "#18181b",
  bg3: "#1e1e23",
  bg4: "#27272a",
  bg5: "#303036",
  text0: "#fafafa",
  text1: "#a1a1aa",
  text2: "#71717a",
  text3: "#52525b",
  accent: "#22c55e",
  accentDim: "#16a34a",
  borderDefault: "#2a2a2f",
  borderSubtle: "#1f1f24",
  borderHover: "#3a3a3f",
  fontSans: "DM Sans",
  fontDisplay: "Space Grotesk",
  fontMono: "JetBrains Mono",
  radius: 8,
  radiusLg: 12,
}

/**
 * Theme used for a brand-new, blank project. The visible canvas surface is
 * #101010 as requested; surrounding surfaces are neutral dark greys so dropped
 * components read well immediately.
 */
export const blankTheme: ThemeConfig = {
  ...defaultTheme,
  bg0: "#0a0a0a",
  bg1: "#101010",
  bg2: "#161616",
  bg3: "#1f1f1f",
  bg4: "#272727",
  bg5: "#323232",
  text0: "#fafafa",
  text1: "#a1a1aa",
  text2: "#71717a",
  text3: "#52525b",
  accent: "#22c55e",
  accentDim: "#16a34a",
  borderDefault: "#262626",
  borderSubtle: "#1a1a1a",
  borderHover: "#363636",
  fontSans: "Inter",
  fontDisplay: "Inter",
}

export interface ThemePreset {
  id: string
  name: string
  theme: ThemeConfig
}

export const themePresets: ThemePreset[] = [
  { id: "default", name: "Dark Minimal", theme: { ...defaultTheme } },
  {
    id: "ivory",
    name: "Ivory",
    theme: {
      ...defaultTheme,
      bg0: "#fdfcfa", bg1: "#f5f3ef", bg2: "#edebe5", bg3: "#e0ddd6", bg4: "#ccc8bf", bg5: "#b0ab9f",
      text0: "#1c1917", text1: "#44403c", text2: "#78716c", text3: "#a8a29e",
      accent: "#4f46e5", accentDim: "#4338ca",
      borderDefault: "#e5e2db", borderSubtle: "#f0ede7", borderHover: "#d5d0c8",
      fontSans: "Plus Jakarta Sans", fontDisplay: "Sora", radius: 10, radiusLg: 16,
    },
  },
  {
    id: "clean",
    name: "Clean",
    theme: {
      ...defaultTheme,
      bg0: "#ffffff", bg1: "#f8f9fa", bg2: "#f1f3f5", bg3: "#e9ecef", bg4: "#dee2e6", bg5: "#ced4da",
      text0: "#212529", text1: "#495057", text2: "#868e96", text3: "#adb5bd",
      accent: "#228be6", accentDim: "#1c7ed6",
      borderDefault: "#e9ecef", borderSubtle: "#f1f3f5", borderHover: "#dee2e6",
      fontSans: "Inter", fontDisplay: "Inter", radius: 8, radiusLg: 12,
    },
  },
  {
    id: "sand",
    name: "Sand",
    theme: {
      ...defaultTheme,
      bg0: "#faf8f5", bg1: "#f2efe8", bg2: "#e8e4db", bg3: "#ddd8cd", bg4: "#c8c2b5", bg5: "#b3ab9c",
      text0: "#2c2418", text1: "#5c5347", text2: "#8a8074", text3: "#b0a798",
      accent: "#d97706", accentDim: "#b45309",
      borderDefault: "#e2ddd4", borderSubtle: "#ebe8e1", borderHover: "#d5cfc4",
      fontSans: "Nunito Sans", fontDisplay: "Outfit", radius: 10, radiusLg: 14,
    },
  },
  {
    id: "amber",
    name: "Amber",
    theme: {
      ...defaultTheme,
      bg0: "#171210", bg1: "#1e1816", bg2: "#26201c", bg3: "#302925", bg4: "#3d3530", bg5: "#504640",
      text0: "#faf6f0", text1: "#d4c8b8", text2: "#a89a88", text3: "#7d7062",
      accent: "#e8a838", accentDim: "#cc8f20",
      borderDefault: "#352e28", borderSubtle: "#28211b", borderHover: "#443c35",
      fontSans: "Outfit", fontDisplay: "Outfit", radius: 6, radiusLg: 10,
    },
  },
  {
    id: "ocean",
    name: "Ocean",
    theme: {
      ...defaultTheme,
      bg0: "#0a1628", bg1: "#101e32", bg2: "#162740", bg3: "#1d3050", bg4: "#264060", bg5: "#305575",
      text0: "#eef4ff", text1: "#b0c8e8", text2: "#7a9cc0", text3: "#506d90",
      accent: "#3b82f6", accentDim: "#2563eb",
      borderDefault: "#1e3250", borderSubtle: "#162640", borderHover: "#2a4468",
      fontSans: "Inter", fontDisplay: "Sora",
    },
  },
  {
    id: "rose",
    name: "Rosé",
    theme: {
      ...defaultTheme,
      bg0: "#16101a", bg1: "#1e1620", bg2: "#261e28", bg3: "#302632", bg4: "#3e3340", bg5: "#504250",
      text0: "#faf4f8", text1: "#d0bcc8", text2: "#a08898", text3: "#786575",
      accent: "#f472b6", accentDim: "#ec4899",
      borderDefault: "#30252e", borderSubtle: "#241c25", borderHover: "#402e3a",
      fontSans: "DM Sans", fontDisplay: "Raleway", radius: 12, radiusLg: 18,
    },
  },
  {
    id: "purple-haze",
    name: "Purple Haze",
    theme: {
      ...defaultTheme,
      bg0: "#100c1a", bg1: "#16111f", bg2: "#1e1828", bg3: "#262033", bg4: "#302a40", bg5: "#3e3650",
      text0: "#f5f0ff", text1: "#c4b5fd", text2: "#8b7cbf", text3: "#6b5c8f",
      accent: "#8b5cf6", accentDim: "#7c3aed",
      borderDefault: "#2a2240", borderSubtle: "#1e1832", borderHover: "#38304f",
      fontSans: "Manrope", fontDisplay: "Sora", radius: 10, radiusLg: 14,
    },
  },
  {
    id: "slate",
    name: "Slate",
    theme: {
      ...defaultTheme,
      bg0: "#0f1114", bg1: "#161a1e", bg2: "#1e2228", bg3: "#252a32", bg4: "#2e353e", bg5: "#3a4250",
      text0: "#f0f4f8", text1: "#94a3b8", text2: "#64748b", text3: "#475569",
      accent: "#06b6d4", accentDim: "#0891b2",
      borderDefault: "#252a32", borderSubtle: "#1c2028", borderHover: "#323a45",
      fontSans: "Work Sans", fontDisplay: "Space Grotesk", radius: 6, radiusLg: 10,
    },
  },
  {
    id: "forest",
    name: "Forest",
    theme: {
      ...defaultTheme,
      bg0: "#0a120c", bg1: "#101a13", bg2: "#16221a", bg3: "#1e2c22", bg4: "#26382a", bg5: "#304434",
      text0: "#eef8f0", text1: "#a0c8a8", text2: "#6ea078", text3: "#4e7858",
      accent: "#10b981", accentDim: "#059669",
      borderDefault: "#1e3022", borderSubtle: "#162418", borderHover: "#2c4230",
      fontSans: "Plus Jakarta Sans", fontDisplay: "DM Sans", radius: 8, radiusLg: 14,
    },
  },
]

export function resolveTheme(partial?: Partial<ThemeConfig>): ThemeConfig {
  if (!partial) return defaultTheme
  return { ...defaultTheme, ...partial }
}

export function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

/** Pick black or white for legible text on top of the given background colour. */
export function readableForeground(hex: string): string {
  const h = hex.replace("#", "")
  if (h.length < 6) return "#ffffff"
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const toLinear = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4))
  const luminance = 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
  return luminance > 0.45 ? "#0a0a0a" : "#ffffff"
}

export function themeToCSS(theme: ThemeConfig): Record<string, string> {
  const rgb = hexToRgb(theme.accent)
  const accentFg = readableForeground(theme.accent)
  return {
    // ---- OpenPage block tokens (existing section blocks rely on these) ----
    "--color-bg-0": theme.bg0,
    "--color-bg-1": theme.bg1,
    "--color-bg-2": theme.bg2,
    "--color-bg-3": theme.bg3,
    "--color-bg-4": theme.bg4,
    "--color-bg-5": theme.bg5,
    "--color-text-0": theme.text0,
    "--color-text-1": theme.text1,
    "--color-text-2": theme.text2,
    "--color-text-3": theme.text3,
    "--color-green": theme.accent,
    "--color-green-dim": theme.accentDim,
    "--color-green-glow": `rgba(${rgb}, 0.12)`,
    "--color-green-glow2": `rgba(${rgb}, 0.06)`,
    "--color-border-default": theme.borderDefault,
    "--color-border-subtle": theme.borderSubtle,
    "--color-border-hover": theme.borderHover,
    "--color-accent-rgb": rgb,
    "--font-sans": `"${theme.fontSans}", -apple-system, system-ui, sans-serif`,
    "--font-display": `"${theme.fontDisplay}", system-ui, sans-serif`,
    "--font-mono": `"${theme.fontMono}", ui-monospace, monospace`,
    "--radius-default": `${theme.radius}px`,
    "--radius-lg": `${theme.radiusLg}px`,
    // ---- shadcn/ui semantic tokens (mini components adopt the site theme) ----
    "--background": theme.bg1,
    "--foreground": theme.text0,
    "--card": theme.bg2,
    "--card-foreground": theme.text0,
    "--popover": theme.bg2,
    "--popover-foreground": theme.text0,
    "--primary": theme.accent,
    "--primary-foreground": accentFg,
    "--secondary": theme.bg3,
    "--secondary-foreground": theme.text0,
    "--muted": theme.bg2,
    "--muted-foreground": theme.text2,
    "--accent": theme.bg3,
    "--accent-foreground": theme.text0,
    "--border": theme.borderDefault,
    "--input": theme.borderDefault,
    "--ring": theme.accent,
    "--radius": `${theme.radius}px`,
  }
}

export const googleFontOptions = [
  "DM Sans",
  "Inter",
  "Space Grotesk",
  "Poppins",
  "Manrope",
  "Outfit",
  "Plus Jakarta Sans",
  "Sora",
  "Nunito Sans",
  "Work Sans",
  "Rubik",
  "Raleway",
  "JetBrains Mono",
  "Fira Code",
  "Source Code Pro",
]
