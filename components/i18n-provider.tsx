"use client"

import React, { createContext, useContext, ReactNode } from "react"

export const I18nContext = createContext<any>(null)

export const useI18n = () => {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider")
  }
  return context
}

interface I18nProviderProps {
  translations: any
  children: ReactNode
}

export function I18nProvider({ translations, children }: I18nProviderProps) {
  const t = (key: string) => {
    const keys = key.split(".")
    let value: any = translations
    for (const k of keys) {
      value = value?.[k]
      if (value === undefined) {
        return key // Return the key itself if not found
      }
    }
    return value
  }

  return <I18nContext.Provider value={{ t }}>{children}</I18nContext.Provider>
}
