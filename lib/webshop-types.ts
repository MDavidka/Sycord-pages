export interface Product {
  id: string
  name: string
  description: string
  price: number
  image: string
  category: string
  inStock: boolean
}

export interface WebshopSettings {
  projectId: string
  headerComponent: "minimal" | "bold" | "gradient" | "centered" | "sidebar"
  heroComponent: "none" | "simple" | "gradient" | "video-bg" | "carousel"
  productComponent: "card" | "minimal" | "luxury" | "compact" | "showcase"
  extraSegments: {
    giveaway?: {
      enabled: boolean
      title: string
      description: string
      buttonText: string
    }
    announcement?: {
      enabled: boolean
      message: string
      bgColor: string
    }
    newsletter?: {
      enabled: boolean
      placeholder: string
    }
  }
  currency: "USD" | "EUR" | "GBP" | "HUF"
  layout: "grid" | "list"
  productsPerPage: number
  showPrices: boolean
  primaryColor: string
  contactEmail: string
  socialLinks: {
    facebook?: string
    instagram?: string
    twitter?: string
  }
  theme?: keyof typeof themes
}

export const headerComponents = {
  minimal: {
    name: "Minimal",
    description: "Clean and simple",
  },
  bold: {
    name: "Bold",
    description: "Strong, attention-grabbing",
  },
  gradient: {
    name: "Gradient",
    description: "Colorful gradient header",
  },
  centered: {
    name: "Centered",
    description: "Centered text focus",
  },
  sidebar: {
    name: "Sidebar",
    description: "Side navigation menu",
  },
}

export const heroComponents = {
  none: {
    name: "None",
    description: "No hero section",
  },
  simple: {
    name: "Simple",
    description: "Basic text and CTA",
  },
  gradient: {
    name: "Gradient",
    description: "Colorful gradient background",
  },
  "video-bg": {
    name: "Video Background",
    description: "Dynamic video backdrop",
  },
  carousel: {
    name: "Carousel",
    description: "Rotating images/text",
  },
}

export const productComponents = {
  card: {
    name: "Card",
    description: "Classic card layout",
  },
  minimal: {
    name: "Minimal",
    description: "Minimal information",
  },
  luxury: {
    name: "Luxury",
    description: "Premium high-end feel",
  },
  compact: {
    name: "Compact",
    description: "Space-efficient layout",
  },
  showcase: {
    name: "Showcase",
    description: "Large focus on images",
  },
}

export const currencySymbols = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  HUF: "Ft",
}

export const themes = {
  luxury: {
    name: "Luxury",
    primary: "#1a1a1a",
    secondary: "#d4af37",
    accent: "#f5f5f5",
    description: "Sophisticated luxury with gold accents",
  },
  tech: {
    name: "Tech",
    primary: "#0f172a",
    secondary: "#3b82f6",
    accent: "#e0f2fe",
    description: "Modern tech aesthetic with vibrant blue",
  },
  organic: {
    name: "Organic",
    primary: "#7c2d12",
    secondary: "#84cc16",
    accent: "#fef3c7",
    description: "Warm earth tones with natural vibes",
  },
  playful: {
    name: "Playful",
    primary: "#e91e63",
    secondary: "#ff6b6b",
    accent: "#fff0f5",
    description: "Vibrant and energetic with bold colors",
  },
  classic: {
    name: "Classic",
    primary: "#374151",
    secondary: "#111827",
    accent: "#f9fafb",
    description: "Timeless elegant minimalist design",
  },
  modern: {
    name: "Modern",
    primary: "#2563eb",
    secondary: "#1e40af",
    accent: "#f0f9ff",
    description: "Clean, professional, and contemporary",
  },
  sunset: {
    name: "Sunset",
    primary: "#ea580c",
    secondary: "#dc2626",
    accent: "#fef2f2",
    description: "Warm, vibrant, and energetic",
  },
  "dark-minimal": {
    name: "Dark Minimal",
    primary: "#e5e7eb",
    secondary: "#374151",
    accent: "#111827",
    description: "Sophisticated dark elegance",
  },
  nature: {
    name: "Nature",
    primary: "#059669",
    secondary: "#047857",
    accent: "#f0fdf4",
    description: "Organic, sustainable, peaceful",
  },
  neon: {
    name: "Neon",
    primary: "#ec4899",
    secondary: "#06b6d4",
    accent: "#0f172a",
    description: "Bold, futuristic, cutting-edge",
  },
}

export const themeConfigs = {
  luxury: {
    bg: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
    header: "bg-slate-900/95 backdrop-blur-xl border-b border-amber-500/20",
    card: "bg-slate-800 border border-amber-500/30 shadow-2xl hover:shadow-amber-500/20",
    button: "bg-amber-600 hover:bg-amber-700 text-white",
    text: "text-slate-100",
    accent: "text-amber-400",
  },
  tech: {
    bg: "bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950",
    header: "bg-slate-950/95 backdrop-blur-xl border-b border-blue-500/30",
    card: "bg-slate-900 border border-blue-500/50 shadow-lg hover:shadow-blue-500/20",
    button: "bg-blue-600 hover:bg-blue-700 text-white",
    text: "text-slate-100",
    accent: "text-blue-400",
  },
  organic: {
    bg: "bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50",
    header: "bg-orange-700/95 backdrop-blur-xl border-b border-lime-600/30",
    card: "bg-white border-2 border-orange-200 shadow-lg hover:shadow-orange-200/50",
    button: "bg-lime-600 hover:bg-lime-700 text-white",
    text: "text-orange-900",
    accent: "text-orange-700",
  },
  playful: {
    bg: "bg-gradient-to-br from-pink-50 via-red-50 to-pink-50",
    header: "bg-pink-600/95 backdrop-blur-xl border-b border-pink-400/50",
    card: "bg-white border-2 border-pink-300 shadow-lg hover:shadow-pink-300/50",
    button: "bg-red-500 hover:bg-red-600 text-white",
    text: "text-pink-900",
    accent: "text-pink-600",
  },
  classic: {
    bg: "bg-gradient-to-br from-gray-50 to-gray-100",
    header: "bg-gray-900/95 backdrop-blur-xl border-b border-gray-300/50",
    card: "bg-white border border-gray-200 shadow-md hover:shadow-lg",
    button: "bg-gray-800 hover:bg-gray-900 text-white",
    text: "text-gray-900",
    accent: "text-gray-700",
  },
  modern: {
    bg: "bg-gradient-to-br from-blue-50 via-white to-blue-50",
    header: "bg-white/80 backdrop-blur-xl border-b border-blue-100",
    card: "bg-white border border-blue-100 shadow-md hover:shadow-xl hover:border-blue-200",
    button: "bg-blue-600 hover:bg-blue-700 text-white",
    text: "text-gray-900",
    accent: "text-blue-600",
    headerBg: "bg-gradient-to-r from-blue-600 to-blue-500",
  },
  sunset: {
    bg: "bg-gradient-to-br from-orange-50 via-red-50 to-orange-50",
    header: "bg-white/80 backdrop-blur-xl border-b border-orange-200",
    card: "bg-white border-2 border-orange-200 shadow-lg hover:shadow-orange-300/50 hover:border-orange-300",
    button: "bg-orange-600 hover:bg-orange-700 text-white",
    text: "text-gray-900",
    accent: "text-orange-600",
    headerBg: "bg-gradient-to-r from-orange-500 via-red-500 to-orange-500",
  },
  "dark-minimal": {
    bg: "bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900",
    header: "bg-slate-950/80 backdrop-blur-xl border-b border-slate-700",
    card: "bg-slate-800 border border-slate-700 shadow-xl hover:shadow-2xl hover:bg-slate-700",
    button: "bg-slate-100 hover:bg-white text-slate-900",
    text: "text-slate-100",
    accent: "text-slate-300",
    headerBg: "bg-gradient-to-r from-slate-900 to-slate-800",
  },
  nature: {
    bg: "bg-gradient-to-br from-green-50 via-emerald-50 to-green-50",
    header: "bg-white/80 backdrop-blur-xl border-b border-green-200",
    card: "bg-white border-2 border-green-200 shadow-lg hover:shadow-green-200/50 hover:border-green-300",
    button: "bg-green-600 hover:bg-green-700 text-white",
    text: "text-gray-900",
    accent: "text-green-600",
    headerBg: "bg-gradient-to-r from-green-500 to-emerald-600",
  },
  neon: {
    bg: "bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950",
    header: "bg-slate-900/80 backdrop-blur-xl border-b border-pink-500/30",
    card: "bg-slate-900 border-2 border-purple-500/50 shadow-lg hover:shadow-pink-500/30 hover:border-pink-500/80",
    button: "bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600 text-white font-bold",
    text: "text-slate-100",
    accent: "text-pink-400",
    headerBg: "bg-gradient-to-r from-pink-600 via-purple-600 to-cyan-600",
  },
}
