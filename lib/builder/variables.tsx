"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

/**
 * Site variables let users define reusable values (e.g. company name, CTA URL)
 * and reference them inside text with the {{token}} syntax. The provider wraps
 * the canvas (and the exported page) so any block can resolve tokens.
 */
const VariablesContext = createContext<Record<string, string>>({})

export function VariablesProvider({ value, children }: { value: Record<string, string>; children?: ReactNode }) {
  return <VariablesContext.Provider value={value}>{children}</VariablesContext.Provider>
}

export function applyVariables(text: string, vars: Record<string, string>): string {
  if (!text || text.indexOf("{{") === -1) return text
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => (key in vars ? vars[key] : `{{${key}}}`))
}

/** Returns a resolver that replaces {{tokens}} using the current site variables. */
export function useVars(): (text: string) => string {
  const vars = useContext(VariablesContext)
  return useMemo(() => (text: string) => applyVariables(text, vars), [vars])
}

export function variablesToMap(list?: { key: string; value: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const v of list || []) if (v.key) map[v.key] = v.value
  return map
}

/** Convert a page path (e.g. "/", "/about") to a stored/deployed filename. */
export function pagePathToFilename(path: string): string {
  const clean = (path || "/").replace(/^\//, "").replace(/\/+$/, "")
  if (!clean) return "index.html"
  return `${clean.replace(/\//g, "-")}.html`
}
