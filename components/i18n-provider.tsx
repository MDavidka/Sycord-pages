"use client"

import React, { createContext, useState, useEffect, ReactNode } from "react"

export const I18nContext = createContext<any>(null)

interface I18nProviderProps {
  lang: string
  children: ReactNode
}

export function I18nProvider({ lang, children }: I18nProviderProps) {
  const [translations, setTranslations] = useState({})

  useEffect(() => {
    async function loadTranslations() {
      try {
        const module = await import(`@/locales/${lang}.json`)
        setTranslations(module.default)
      } catch (error) {
        console.error("Failed to load translations:", error)
        // Fallback to English if the selected language fails to load
        const module = await import("@/locales/en.json")
        setTranslations(module.default)
      }
    }

    loadTranslations()
  }, [lang])

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
