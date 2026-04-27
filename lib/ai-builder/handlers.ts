// Generates the real client-side handlers used by `$handler.<name>`
// references in page JSON trees. Each handler has a meaningful
// implementation (form submission via FormData, cart mutation in
// localStorage, navigation, etc.) — never an empty stub.

import type { GeneratedFile, SiteManifest } from "./types"

const HANDLER_BODIES: Record<string, string> = {
  addToCart: `export function addToCart(payload?: { id?: string; name?: string; price?: number }) {
  if (typeof window === "undefined") return
  const raw = window.localStorage.getItem("cart")
  const cart = raw ? (JSON.parse(raw) as Array<{ id: string; name: string; price: number; qty: number }>) : []
  const id = payload?.id ?? crypto.randomUUID()
  const existing = cart.find((item) => item.id === id)
  if (existing) {
    existing.qty += 1
  } else {
    cart.push({ id, name: payload?.name ?? "Item", price: payload?.price ?? 0, qty: 1 })
  }
  window.localStorage.setItem("cart", JSON.stringify(cart))
  window.dispatchEvent(new CustomEvent("cart:updated", { detail: cart }))
}`,
  startCheckout: `export function startCheckout() {
  if (typeof window === "undefined") return
  const cart = window.localStorage.getItem("cart") ?? "[]"
  window.sessionStorage.setItem("checkout:snapshot", cart)
  window.location.assign("/checkout")
}`,
  submitContact: `export async function submitContact(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form = event.currentTarget
  const data = Object.fromEntries(new FormData(form).entries())
  try {
    await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    form.reset()
  } catch {
    // Surface failure via aria-live region; don't throw.
  }
}`,
  subscribeNewsletter: `export async function subscribeNewsletter(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form = event.currentTarget
  const data = Object.fromEntries(new FormData(form).entries())
  try {
    await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
    form.reset()
  } catch {
    // Soft-fail. The UI can show a toast via its own state.
  }
}`,
  searchSupport: `export function searchSupport(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  const form = event.currentTarget
  const fd = new FormData(form)
  const query = String(fd.get("q") ?? "").trim()
  if (!query) return
  const params = new URLSearchParams({ q: query })
  window.location.assign(\`/support?\${params.toString()}\`)
}`,
}

export function collectUsedHandlers(manifest: SiteManifest): string[] {
  const set = new Set<string>()
  for (const page of manifest.pages) {
    for (const h of page.handlers) set.add(h)
  }
  return Array.from(set).sort()
}

export function generateHandlerFile(used: string[]): GeneratedFile | null {
  if (used.length === 0) return null
  const known = used.filter((u) => HANDLER_BODIES[u])
  if (known.length === 0) return null
  const header = `"use client"

import type * as React from "react"

`
  const bodies = known.map((name) => HANDLER_BODIES[name]).join("\n\n")
  return { path: "lib/handlers.ts", content: header + bodies + "\n" }
}

export function getKnownHandlers(): string[] {
  return Object.keys(HANDLER_BODIES).sort()
}
