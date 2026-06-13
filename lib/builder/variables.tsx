"use client"

import { createContext, useContext, useMemo, type ReactNode } from "react"

/**
 * Builder runtime shared by the editor canvas, the deployed site renderer and
 * the static export. It exposes site variables plus optional behaviours so the
 * same block components work everywhere:
 *  - resolve(text): replace {{token}} variables
 *  - navigate(path): used by button "go to page" actions
 *  - updateVar(key, op, amount): used by button "update variable" actions
 *  - interactive: whether click actions should run (false while editing layout)
 */
export type VarOp = "set" | "add" | "sub"

export interface BuilderRuntime {
  vars: Record<string, string>
  interactive: boolean
  navigate?: (path: string) => void
  updateVar?: (key: string, op: VarOp, amount: number) => void
}

const RuntimeContext = createContext<BuilderRuntime>({ vars: {}, interactive: false })

export function RuntimeProvider({ value, children }: { value: BuilderRuntime; children?: ReactNode }) {
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
}

export function useRuntime(): BuilderRuntime {
  return useContext(RuntimeContext)
}

export function applyVariables(text: string, vars: Record<string, string>): string {
  if (!text || text.indexOf("{{") === -1) return text
  return text.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, key: string) => (key in vars ? vars[key] : `{{${key}}}`))
}

/** Returns a resolver that replaces {{tokens}} using the current site variables. */
export function useVars(): (text: string) => string {
  const { vars } = useRuntime()
  return useMemo(() => (text: string) => applyVariables(text, vars), [vars])
}

/** Backwards-compatible provider that only carries variables (used by export). */
export function VariablesProvider({ value, children }: { value: Record<string, string>; children?: ReactNode }) {
  return <RuntimeProvider value={{ vars: value, interactive: false }}>{children}</RuntimeProvider>
}

export function variablesToMap(list?: { key: string; value: string }[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const v of list || []) if (v.key) map[v.key] = v.value
  return map
}

export function computeVar(current: string | undefined, op: VarOp, amount: number): string {
  const cur = parseFloat(current ?? "0")
  const base = Number.isFinite(cur) ? cur : 0
  const next = op === "add" ? base + amount : op === "sub" ? base - amount : amount
  return String(next)
}

/** Convert a page path (e.g. "/", "/about") to a stored/deployed filename. */
export function pagePathToFilename(path: string): string {
  const clean = (path || "/").replace(/^\//, "").replace(/\/+$/, "")
  if (!clean) return "index.html"
  return `${clean.replace(/\//g, "-")}.html`
}
