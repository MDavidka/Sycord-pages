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
  theme: "luxury" | "tech" | "organic" | "playful" | "classic"
  currency: "USD" | "EUR" | "GBP" | "HUF"
  layout: "grid" | "list" | "masonry"
  productsPerPage: number
  showPrices: boolean
  primaryColor: string
  secondaryColor: string
  headerStyle: "simple" | "centered" | "split" | "luxe" | "hero"
  footerText: string
  contactEmail: string
  socialLinks: {
    facebook?: string
    instagram?: string
    twitter?: string
  }
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
}
