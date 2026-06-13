"use client"

import { useEffect, useRef } from "react"

const DEFAULT_FONTS = new Set(["DM Sans", "JetBrains Mono", "Space Grotesk", "Inter"])
const loadedFonts = new Set<string>()

function fontToGoogleUrl(fontName: string): string {
  const family = fontName.replace(/ /g, "+")
  return `https://fonts.googleapis.com/css2?family=${family}:wght@300;400;500;600;700&display=swap`
}

export function useGoogleFonts(fonts: string[]) {
  const prevRef = useRef<string[]>([])

  useEffect(() => {
    if (typeof document === "undefined") return
    const unique = [...new Set(fonts)].filter((f) => f && !DEFAULT_FONTS.has(f) && !loadedFonts.has(f))
    if (unique.length === 0) return

    for (const font of unique) {
      if (document.querySelector(`link[data-builder-font="${font}"]`)) {
        loadedFonts.add(font)
        continue
      }
      const link = document.createElement("link")
      link.rel = "stylesheet"
      link.href = fontToGoogleUrl(font)
      link.setAttribute("data-builder-font", font)
      document.head.appendChild(link)
      loadedFonts.add(font)
      document.fonts?.load(`16px "${font}"`).catch(() => {})
    }

    prevRef.current = fonts
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fonts.join(",")])
}
