// ── Step 10: Logic / Actions Generation ─────────────────────────────
// Generate handler files for forms, cart, newsletter, etc.
// Deterministic templates first, AI only if handler purpose unclear.

import type { ProjectManifest, GeneratedFile } from "./types"

const HANDLER_TEMPLATES: Record<string, { path: string; content: string }> = {
  addToCart: {
    path: "lib/actions/cart-actions.ts",
    content: `"use client"

export interface CartItem {
  id: string
  name: string
  price: number
  quantity: number
  image?: string
}

const CART_KEY = "site-cart"

export function getCart(): CartItem[] {
  if (typeof window === "undefined") return []
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || "[]")
  } catch {
    return []
  }
}

export function addToCart(item: Omit<CartItem, "quantity">): CartItem[] {
  const cart = getCart()
  const existing = cart.find(i => i.id === item.id)
  if (existing) {
    existing.quantity += 1
  } else {
    cart.push({ ...item, quantity: 1 })
  }
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  return cart
}

export function removeFromCart(id: string): CartItem[] {
  const cart = getCart().filter(i => i.id !== id)
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  return cart
}

export function updateQuantity(id: string, quantity: number): CartItem[] {
  const cart = getCart().map(i => i.id === id ? { ...i, quantity: Math.max(0, quantity) } : i).filter(i => i.quantity > 0)
  localStorage.setItem(CART_KEY, JSON.stringify(cart))
  return cart
}

export function clearCart(): CartItem[] {
  localStorage.removeItem(CART_KEY)
  return []
}

export function cartTotal(cart: CartItem[]): number {
  return cart.reduce((sum, i) => sum + i.price * i.quantity, 0)
}
`,
  },
  submitContact: {
    path: "lib/actions/contact-actions.ts",
    content: `"use server"

export interface ContactFormData {
  name: string
  email: string
  message: string
}

export interface ContactResult {
  success: boolean
  message: string
}

export async function submitContactForm(data: ContactFormData): Promise<ContactResult> {
  // Validate
  if (!data.name || !data.email || !data.message) {
    return { success: false, message: "Please fill in all fields." }
  }
  if (!data.email.includes("@")) {
    return { success: false, message: "Please enter a valid email address." }
  }

  // In a real app this would send to an API or database.
  // Simulate success with a small delay.
  await new Promise(r => setTimeout(r, 500))

  return { success: true, message: "Thank you! We'll get back to you soon." }
}
`,
  },
  subscribeNewsletter: {
    path: "lib/actions/newsletter-actions.ts",
    content: `"use server"

export interface NewsletterResult {
  success: boolean
  message: string
}

export async function subscribeNewsletter(email: string): Promise<NewsletterResult> {
  if (!email || !email.includes("@")) {
    return { success: false, message: "Please enter a valid email address." }
  }

  // Simulate subscription
  await new Promise(r => setTimeout(r, 300))

  return { success: true, message: "You're subscribed! Check your inbox for a confirmation." }
}
`,
  },
  searchSupport: {
    path: "lib/actions/search-actions.ts",
    content: `"use client"

export function searchFaq(query: string, items: { question: string; answer: string }[]): { question: string; answer: string }[] {
  if (!query.trim()) return items
  const lower = query.toLowerCase()
  return items.filter(
    item => item.question.toLowerCase().includes(lower) || item.answer.toLowerCase().includes(lower)
  )
}
`,
  },
  submitTradeIn: {
    path: "lib/actions/trade-in-actions.ts",
    content: `"use server"

export interface TradeInData {
  deviceModel: string
  condition: string
  name: string
  email: string
}

export interface TradeInResult {
  success: boolean
  estimatedValue?: number
  message: string
}

export async function submitTradeIn(data: TradeInData): Promise<TradeInResult> {
  if (!data.deviceModel || !data.condition || !data.name || !data.email) {
    return { success: false, message: "Please fill in all fields." }
  }

  await new Promise(r => setTimeout(r, 500))

  const valueMap: Record<string, number> = {
    excellent: 350,
    good: 250,
    fair: 150,
    poor: 50,
  }
  const estimated = valueMap[data.condition.toLowerCase()] || 100

  return {
    success: true,
    estimatedValue: estimated,
    message: \`Your \${data.deviceModel} in \${data.condition} condition is estimated at $\${estimated}.\`,
  }
}
`,
  },
  startCheckout: {
    path: "lib/actions/checkout-actions.ts",
    content: `"use client"

export function startCheckout(): void {
  // In a real app this would navigate to a checkout page or open a payment modal
  window.location.href = "/cart"
}
`,
  },
}

export function runLogicGenerationStep(
  manifest: ProjectManifest,
  allHandlers: string[],
): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const generatedPaths = new Set<string>()

  for (const handler of allHandlers) {
    const template = HANDLER_TEMPLATES[handler]
    if (template && !generatedPaths.has(template.path)) {
      generatedPaths.add(template.path)
      files.push({
        path: template.path,
        content: template.content,
        kind: "logic",
        status: "ok",
      })
    }
  }

  // Always generate cart actions for commerce sites
  if (manifest.brief.siteType === "commerce" && !generatedPaths.has("lib/actions/cart-actions.ts")) {
    const t = HANDLER_TEMPLATES.addToCart
    files.push({ path: t.path, content: t.content, kind: "logic", status: "ok" })
  }

  // Always generate contact actions if there's a contact/support page
  const hasContact = manifest.pages.some(p =>
    p.pageRole === "form" || p.pageRole === "support" || p.route.includes("contact") || p.route.includes("support")
  )
  if (hasContact && !generatedPaths.has("lib/actions/contact-actions.ts")) {
    const t = HANDLER_TEMPLATES.submitContact
    files.push({ path: t.path, content: t.content, kind: "logic", status: "ok" })
  }

  return files
}
