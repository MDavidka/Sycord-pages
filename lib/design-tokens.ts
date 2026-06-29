export const TYPOGRAPHY_SCALE = {
  h1: { size: 'clamp(2.5rem, 8vw, 4rem)', lineHeight: '1.05', weight: 800, tracking: '-0.03em' },
  h2: { size: 'clamp(2rem, 5vw, 2.5rem)', lineHeight: '1.1', weight: 700, tracking: '-0.02em' },
  h3: { size: '1.5rem', lineHeight: '1.2', weight: 600, tracking: '-0.01em' },
  body: { size: '1rem', lineHeight: '1.6', weight: 400, tracking: '0' },
  caption: { size: '0.875rem', lineHeight: '1.4', weight: 500, tracking: '0' },
  label: { size: '0.75rem', lineHeight: '1.3', weight: 600, tracking: '0.05em' },
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
    bg: 'bg-[#0f1115]',
    card: 'bg-[#181a1f] border-amber-500/10 shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm',
    button: 'bg-amber-500 hover:bg-amber-600 text-[#0f1115] font-semibold transition-all duration-300 shadow-[0_0_20px_rgba(245,158,11,0.2)]',
    heading: 'text-amber-50 tracking-tight',
    body: 'text-slate-400',
    accent: 'text-amber-500',
  },
  modern: {
    bg: 'bg-white',
    card: 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_10px_40px_-10px_rgba(0,0,0,0.02)] hover:shadow-[0_1px_3px_rgba(0,0,0,0.1),0_20px_50px_-10px_rgba(0,0,0,0.05)] transition-all duration-500',
    button: 'bg-slate-900 hover:bg-slate-800 text-white font-medium shadow-lg shadow-slate-900/10',
    heading: 'text-slate-900',
    body: 'text-slate-600',
    accent: 'text-indigo-600',
  },
  'dark-minimal': {
    bg: 'bg-[#0a0a0a]',
    card: 'bg-[#111111] border-[#1f1f1f] shadow-none hover:border-[#2f2f2f] transition-colors duration-300',
    button: 'bg-white hover:bg-white/90 text-black font-semibold',
    heading: 'text-white',
    body: 'text-[#888888]',
    accent: 'text-white',
  },
  tech: {
    bg: 'bg-[#020617]',
    card: 'bg-[#0f172a]/50 border-blue-500/20 backdrop-blur-md shadow-[0_0_50px_-12px_rgba(59,130,246,0.15)]',
    button: 'bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-[0_0_20px_rgba(37,99,235,0.3)]',
    heading: 'text-blue-50',
    body: 'text-slate-400',
    accent: 'text-blue-400',
  },
  classic: {
    bg: 'bg-[#fafafa]',
    card: 'bg-white border-gray-200 shadow-sm hover:shadow-md transition-shadow',
    button: 'bg-gray-900 hover:bg-black text-white font-medium',
    heading: 'text-gray-900 font-serif',
    body: 'text-gray-700',
    accent: 'text-gray-900',
  },
  nature: {
    bg: 'bg-[#fcfdfa]',
    card: 'bg-white border-emerald-100 shadow-sm hover:border-emerald-200',
    button: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    heading: 'text-emerald-950',
    body: 'text-emerald-900/70',
    accent: 'text-emerald-600',
  },
  sunset: {
    bg: 'bg-[#fffaf0]',
    card: 'bg-white border-orange-100 shadow-sm',
    button: 'bg-orange-500 hover:bg-orange-600 text-white',
    heading: 'text-orange-950',
    body: 'text-orange-900/70',
    accent: 'text-orange-600',
  },
  neon: {
    bg: 'bg-black',
    card: 'bg-[#0a0a0a] border-purple-500/30 shadow-[0_0_30px_-10px_rgba(168,85,247,0.2)] hover:border-purple-500/60',
    button: 'bg-gradient-to-r from-purple-600 to-blue-600 hover:opacity-90 text-white font-bold tracking-wider uppercase text-xs',
    heading: 'text-white',
    body: 'text-slate-400',
    accent: 'text-purple-400',
  },
  organic: {
    bg: 'bg-[#faf9f6]',
    card: 'bg-[#f5f2ed] border-stone-200 rounded-3xl',
    button: 'bg-stone-800 text-white rounded-full',
    heading: 'text-stone-900',
    body: 'text-stone-600',
    accent: 'text-stone-700',
  },
  playful: {
    bg: 'bg-[#fff5f5]',
    card: 'bg-white border-pink-200 rounded-[2rem] shadow-xl shadow-pink-500/5',
    button: 'bg-pink-500 hover:bg-pink-600 text-white rounded-full font-bold',
    heading: 'text-pink-900',
    body: 'text-pink-700',
    accent: 'text-pink-500',
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
