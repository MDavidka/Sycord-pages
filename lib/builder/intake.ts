// ── Step 1: Intake ──────────────────────────────────────────────────
// Deterministic analysis of the user prompt. No AI call needed.

import type { IntakeBrief, SiteType } from "./types"

const SITE_TYPE_KEYWORDS: Record<SiteType, string[]> = {
  commerce: ["shop", "store", "ecommerce", "product", "cart", "buy", "sell", "deal", "trade", "phone", "clothing", "merch", "catalog", "marketplace"],
  saas: ["saas", "platform", "analytics", "dashboard", "api", "subscription", "pricing", "features", "integration", "software", "tool", "app"],
  portfolio: ["portfolio", "studio", "design", "photography", "art", "creative", "showcase", "case study", "project", "gallery", "interior"],
  dashboard: ["dashboard", "admin", "manage", "orders", "users", "analytics", "settings", "metrics", "data", "panel", "crm"],
  blog: ["blog", "article", "post", "writing", "journal", "news", "magazine"],
  docs: ["docs", "documentation", "guide", "tutorial", "reference", "api docs", "knowledge base"],
  support: ["support", "help", "faq", "helpdesk", "ticket", "customer service"],
  agency: ["agency", "consulting", "services", "marketing", "digital", "branding", "web agency"],
  general: [],
}

const FEATURE_KEYWORDS: Record<string, string[]> = {
  catalog: ["catalog", "product", "listing", "inventory", "browse", "phone", "item"],
  cart: ["cart", "basket", "checkout", "order", "buy", "purchase"],
  deals: ["deal", "offer", "discount", "sale", "promo", "coupon", "banner"],
  "trade-in": ["trade", "trade-in", "exchange", "recycle", "return"],
  newsletter: ["newsletter", "subscribe", "email", "mailing"],
  faq: ["faq", "question", "answer", "support", "help"],
  pricing: ["pricing", "plan", "tier", "subscription", "cost"],
  forms: ["form", "contact", "feedback", "inquiry", "submit"],
  testimonials: ["testimonial", "review", "customer", "client", "quote"],
  search: ["search", "filter", "find", "query"],
  auth: ["login", "signup", "register", "account", "auth"],
  table: ["table", "data", "list", "grid", "record"],
}

const PAGE_KEYWORDS: Record<string, string[]> = {
  home: ["home", "landing", "main"],
  about: ["about", "story", "team", "who"],
  contact: ["contact", "reach", "email", "get in touch"],
  pricing: ["pricing", "plan", "cost"],
  features: ["features", "capabilities", "what we do"],
  blog: ["blog", "articles", "news", "posts"],
  docs: ["docs", "documentation", "guide"],
  support: ["support", "help", "faq"],
  phones: ["phone", "device", "mobile", "smartphone"],
  deals: ["deal", "offers", "sale", "discount"],
  "trade-in": ["trade", "trade-in", "exchange"],
  cart: ["cart", "checkout", "basket", "order"],
  projects: ["project", "work", "portfolio", "showcase"],
  "case-studies": ["case study", "case studies", "client work"],
  customers: ["customer", "client", "testimonial"],
  settings: ["settings", "preferences", "configuration"],
  analytics: ["analytics", "reports", "metrics", "stats"],
  orders: ["orders", "transactions", "purchases"],
  users: ["users", "members", "accounts"],
  services: ["services", "solutions", "offerings"],
}

const STYLE_KEYWORDS: Record<string, string[]> = {
  premium: ["premium", "luxury", "elegant", "high-end", "exclusive"],
  dark: ["dark", "night", "shadow"],
  minimal: ["minimal", "clean", "simple", "modern"],
  playful: ["playful", "fun", "colorful", "vibrant", "bold"],
  editorial: ["editorial", "magazine", "newspaper", "article"],
  professional: ["professional", "corporate", "business"],
  modern: ["modern", "contemporary", "sleek", "cutting-edge"],
}

function detectSiteType(prompt: string): SiteType {
  const lower = prompt.toLowerCase()
  let best: SiteType = "general"
  let bestScore = 0

  for (const [type, keywords] of Object.entries(SITE_TYPE_KEYWORDS) as [SiteType, string[]][]) {
    const score = keywords.reduce((s, kw) => s + (lower.includes(kw) ? 1 : 0), 0)
    if (score > bestScore) {
      bestScore = score
      best = type
    }
  }
  return best
}

function detectPages(prompt: string): string[] {
  const lower = prompt.toLowerCase()
  const pages: string[] = ["home"]

  for (const [page, keywords] of Object.entries(PAGE_KEYWORDS)) {
    if (page === "home") continue
    if (keywords.some(kw => lower.includes(kw))) {
      pages.push(page)
    }
  }
  return [...new Set(pages)]
}

function detectFeatures(prompt: string): string[] {
  const lower = prompt.toLowerCase()
  const features: string[] = []
  for (const [feature, keywords] of Object.entries(FEATURE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      features.push(feature)
    }
  }
  return features
}

function detectStyleHints(prompt: string): string[] {
  const lower = prompt.toLowerCase()
  const hints: string[] = []
  for (const [style, keywords] of Object.entries(STYLE_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      hints.push(style)
    }
  }
  if (hints.length === 0) hints.push("modern")
  return hints
}

function detectAudience(prompt: string): string {
  const lower = prompt.toLowerCase()
  if (lower.includes("startup")) return "startups"
  if (lower.includes("enterprise")) return "enterprise"
  if (lower.includes("shopper") || lower.includes("buyer") || lower.includes("customer")) return "shoppers"
  if (lower.includes("creator") || lower.includes("artist") || lower.includes("designer")) return "creators"
  if (lower.includes("developer") || lower.includes("engineer")) return "developers"
  if (lower.includes("agenc")) return "agencies"
  return "general"
}

export function runIntakeStep(rawPrompt: string): IntakeBrief {
  const trimmed = rawPrompt.trim()
  return {
    rawPrompt: trimmed,
    siteType: detectSiteType(trimmed),
    keywords: trimmed.toLowerCase().split(/\W+/).filter(w => w.length > 2),
    requestedPages: detectPages(trimmed),
    requestedFeatures: detectFeatures(trimmed),
    styleHints: detectStyleHints(trimmed),
    audience: detectAudience(trimmed),
  }
}
