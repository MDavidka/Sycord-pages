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
  theme: "modern" | "minimal" | "bold" | "elegant" | "dark"
  currency: "USD" | "EUR" | "GBP" | "HUF"
  layout: "grid" | "list" | "masonry"
  productsPerPage: number
  showPrices: boolean
  primaryColor: string
  secondaryColor: string
  headerStyle: "simple" | "centered" | "split"
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
  modern: {
    name: "Modern",
    primary: "#3b82f6",
    secondary: "#8b5cf6",
  },
  minimal: {
    name: "Minimal",
    primary: "#000000",
    secondary: "#6b7280",
  },
  bold: {
    name: "Bold",
    primary: "#ef4444",
    secondary: "#f59e0b",
  },
  elegant: {
    name: "Elegant",
    primary: "#8b5cf6",
    secondary: "#ec4899",
  },
  dark: {
    name: "Dark",
    primary: "#10b981",
    secondary: "#06b6d4",
  },
}
