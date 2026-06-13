"use client"

import { useMemo, useState } from "react"
import { RenderBlock } from "@/components/builder/blocks/registry"
import { resolveTheme, themeToCSS } from "@/lib/builder/theme-presets"
import { RuntimeProvider, variablesToMap, computeVar } from "@/lib/builder/variables"
import { useGoogleFonts } from "@/components/builder/hooks/use-google-fonts"
import type { SiteConfig } from "@/lib/builder/types"

/**
 * Renders a published site from its builder config using the real block
 * components — identical to the editor preview, fully interactive (shadcn
 * components, navigation and variable actions all work).
 */
export default function SitePageView({ config, initialPath }: { config: SiteConfig; initialPath?: string }) {
  const pages = config.pages && config.pages.length > 0 ? config.pages : [{ id: "page-home", name: "Home", path: "/", blocks: config.blocks }]
  const [currentPath, setCurrentPath] = useState(() => {
    const wanted = initialPath || "/"
    return pages.find((p) => p.path === wanted) ? wanted : pages[0].path
  })
  const [overrides, setOverrides] = useState<Record<string, string>>({})

  const resolved = useMemo(() => resolveTheme(config.theme), [config.theme])
  const cssVars = useMemo(() => themeToCSS(resolved), [resolved])
  const baseVars = useMemo(() => variablesToMap(config.variables), [config.variables])
  const varsMap = useMemo(() => ({ ...baseVars, ...overrides }), [baseVars, overrides])
  useGoogleFonts([resolved.fontSans, resolved.fontDisplay, resolved.fontMono])

  const page = pages.find((p) => p.path === currentPath) ?? pages[0]

  const runtime = useMemo(
    () => ({
      vars: varsMap,
      interactive: true,
      navigate: (path: string) => {
        if (pages.find((p) => p.path === path)) {
          setCurrentPath(path)
          if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" })
        } else if (typeof window !== "undefined") {
          window.location.href = path
        }
      },
      updateVar: (key: string, op: "set" | "add" | "sub", amount: number) =>
        setOverrides((prev) => ({ ...prev, [key]: computeVar(prev[key] ?? baseVars[key], op, amount) })),
    }),
    [varsMap, pages, baseVars],
  )

  return (
    <div
      className="@container min-h-screen"
      style={{ ...cssVars, backgroundColor: "var(--color-bg-1)", color: "var(--color-text-0)", fontFamily: "var(--font-sans)" } as React.CSSProperties}
    >
      <RuntimeProvider value={runtime}>
        {page.blocks.map((block) => (
          <div key={block.id} className="scroll-revealed">
            <RenderBlock block={block} />
          </div>
        ))}
      </RuntimeProvider>
    </div>
  )
}
