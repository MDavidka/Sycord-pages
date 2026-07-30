export const TYPOGRAPHY_SCALE = {
  h1: { size: '48px', lineHeight: '1.1', weight: 700, tracking: '-0.02em' },
  h2: { size: '32px', lineHeight: '1.2', weight: 600, tracking: '-0.01em' },
  h3: { size: '22px', lineHeight: '1.3', weight: 600, tracking: '0' },
  body: { size: '16px', lineHeight: '1.6', weight: 400, tracking: '0' },
  caption: { size: '13px', lineHeight: '1.4', weight: 500, tracking: '0' },
  label: { size: '12px', lineHeight: '1.3', weight: 600, tracking: '0.02em' },
} as const

export const SPACING_SCALE = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  base: '16px',
  lg: '20px',
  xl: '24px',
  '2xl': '32px',
  '3xl': '40px',
  '4xl': '48px',
  '5xl': '64px',
  '6xl': '80px',
  '7xl': '96px',
} as const

export const MOTION_TIMING = {
  fast: '150ms',
  normal: '200ms',
  medium: '300ms',
  slow: '400ms',
  easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
  easeOut: 'cubic-bezier(0, 0, 0.2, 1)',
  easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
} as const

export const SEMANTIC_COLORS = {
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
} as const

export const THEME_TOKENS = {
  luxury: {
    bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    card: 'bg-slate-800/80 backdrop-blur border border-amber-500/20 shadow-xl',
    button: 'bg-amber-600 hover:bg-amber-700 text-white font-medium',
    heading: 'text-amber-100',
    body: 'text-slate-300',
    accent: 'text-amber-400',
  },
  modern: {
    bg: 'bg-gradient-to-br from-blue-50 via-white to-blue-50',
    card: 'bg-white border border-blue-100 shadow-md hover:shadow-xl hover:border-blue-200',
    button: 'bg-blue-600 hover:bg-blue-700 text-white font-medium',
    heading: 'text-gray-900',
    body: 'text-gray-600',
    accent: 'text-blue-600',
  },
  'dark-minimal': {
    bg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900',
    card: 'bg-slate-800 border border-slate-700 shadow-xl hover:shadow-2xl',
    button: 'bg-slate-100 hover:bg-white text-slate-900 font-medium',
    heading: 'text-slate-100',
    body: 'text-slate-400',
    accent: 'text-slate-300',
  },
  tech: {
    bg: 'bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950',
    card: 'bg-slate-900/80 backdrop-blur border border-blue-500/30 shadow-lg',
    button: 'bg-blue-600 hover:bg-blue-700 text-white font-medium',
    heading: 'text-slate-100',
    body: 'text-slate-400',
    accent: 'text-blue-400',
  },
  classic: {
    bg: 'bg-gradient-to-br from-gray-50 to-gray-100',
    card: 'bg-white border border-gray-200 shadow-md hover:shadow-lg',
    button: 'bg-gray-800 hover:bg-gray-900 text-white font-medium',
    heading: 'text-gray-900',
    body: 'text-gray-600',
    accent: 'text-gray-700',
  },
  nature: {
    bg: 'bg-gradient-to-br from-green-50 via-emerald-50 to-green-50',
    card: 'bg-white border-2 border-green-200 shadow-lg hover:shadow-green-200/50',
    button: 'bg-green-600 hover:bg-green-700 text-white font-medium',
    heading: 'text-gray-900',
    body: 'text-gray-600',
    accent: 'text-green-600',
  },
  sunset: {
    bg: 'bg-gradient-to-br from-orange-50 via-red-50 to-orange-50',
    card: 'bg-white border-2 border-orange-200 shadow-lg hover:shadow-orange-300/50',
    button: 'bg-orange-600 hover:bg-orange-700 text-white font-medium',
    heading: 'text-gray-900',
    body: 'text-gray-600',
    accent: 'text-orange-600',
  },
  neon: {
    bg: 'bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950',
    card: 'bg-slate-900 border-2 border-purple-500/50 shadow-lg hover:shadow-pink-500/30',
    button: 'bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 text-white font-bold',
    heading: 'text-slate-100',
    body: 'text-slate-400',
    accent: 'text-pink-400',
  },
  organic: {
    bg: 'bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50',
    card: 'bg-white border-2 border-orange-200 shadow-lg hover:shadow-orange-200/50',
    button: 'bg-lime-600 hover:bg-lime-700 text-white font-medium',
    heading: 'text-orange-900',
    body: 'text-orange-700/80',
    accent: 'text-orange-700',
  },
  playful: {
    bg: 'bg-gradient-to-br from-pink-50 via-red-50 to-pink-50',
    card: 'bg-white border-2 border-pink-300 shadow-lg hover:shadow-pink-300/50',
    button: 'bg-red-500 hover:bg-red-600 text-white font-medium',
    heading: 'text-pink-900',
    body: 'text-pink-700/80',
    accent: 'text-pink-600',
  },
} as const

export type ThemeName = keyof typeof THEME_TOKENS

export function getThemeTokens(theme: ThemeName | string) {
  return THEME_TOKENS[theme as ThemeName] ?? THEME_TOKENS.modern
}

export function getTailwindTypography(sizeKey: keyof typeof TYPOGRAPHY_SCALE) {
  const t = TYPOGRAPHY_SCALE[sizeKey]
  return {
    fontSize: t.size,
    lineHeight: t.lineHeight,
    fontWeight: String(t.weight),
    letterSpacing: t.tracking,
  }
}
