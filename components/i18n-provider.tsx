"use client"

import React, { createContext, ReactNode } from "react"

export const I18nContext = createContext<any>(null)

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
