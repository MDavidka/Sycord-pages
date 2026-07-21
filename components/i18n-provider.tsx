"use client"

import { createContext, type ReactNode } from "react"

export type I18nContextValue = {
  locale: string
  t: (key: string, fallback?: string) => string
  setLocale?: (locale: string) => void
}

export const I18nContext = createContext<I18nContextValue | null>(null)

const defaultValue: I18nContextValue = {
  locale: "en",
  t: (key, fallback) => fallback ?? key,
}

export function I18nProvider({
  children,
  value,
}: {
  children: ReactNode
  value?: Partial<I18nContextValue>
}) {
  return (
    <I18nContext.Provider value={{ ...defaultValue, ...value }}>
      {children}
    </I18nContext.Provider>
  )
}
