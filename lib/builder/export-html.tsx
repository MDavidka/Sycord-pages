"use client"

import { createElement } from "react"
import { RenderBlock } from "@/components/builder/blocks/registry"
import { resolveTheme, themeToCSS, readableForeground } from "@/lib/builder/theme-presets"
import { VariablesProvider } from "@/lib/builder/variables"
import type { BlockConfig, ThemeConfig } from "@/lib/builder/types"

/**
 * shadcn/ui utilities (bg-primary, border-border, bg-muted, ring-ring …) resolve
 * to `--color-<token>` theme entries. The editor gets these from globals.css, but
 * a standalone exported page must declare them itself or every shadcn component
 * renders unstyled. This maps the site theme onto those Tailwind v4 color tokens.
 */
function shadcnColorAliases(t: ThemeConfig): Record<string, string> {
  const fg = readableForeground(t.accent)
  return {
    "--color-background": t.bg1,
    "--color-foreground": t.text0,
    "--color-card": t.bg2,
    "--color-card-foreground": t.text0,
    "--color-popover": t.bg2,
    "--color-popover-foreground": t.text0,
    "--color-primary": t.accent,
    "--color-primary-foreground": fg,
    "--color-secondary": t.bg3,
    "--color-secondary-foreground": t.text0,
    "--color-muted": t.bg2,
    "--color-muted-foreground": t.text2,
    "--color-accent": t.bg3,
    "--color-accent-foreground": t.text0,
    "--color-destructive": "#ef4444",
    "--color-destructive-foreground": "#fafafa",
    "--color-border": t.borderDefault,
    "--color-input": t.borderDefault,
    "--color-ring": t.accent,
    "--color-chart-1": t.accent,
    "--color-chart-2": t.accentDim,
    "--color-chart-3": t.text2,
    "--color-chart-4": t.bg4,
    "--color-chart-5": t.bg5,
    "--radius": `${t.radius}px`,
  }
}

/** Static CSS (utilities + reveal + keyframes) the rendered blocks depend on. */
const RUNTIME_CSS = `
.reveal-fade-up,.reveal-scale,.reveal-slide-left,.reveal-slide-right{opacity:1;transform:none}
.accent-glow-sm{box-shadow:0 0 16px rgba(var(--color-accent-rgb,34,197,94),.1)}
.accent-glow-md{box-shadow:0 0 16px rgba(var(--color-accent-rgb,34,197,94),.15)}
.accent-glow-lg{box-shadow:0 0 20px rgba(var(--color-accent-rgb,34,197,94),.25)}
.accent-glow-xl{box-shadow:0 0 24px rgba(var(--color-accent-rgb,34,197,94),.3)}
.accent-glow-ring{box-shadow:0 0 32px rgba(var(--color-accent-rgb,34,197,94),.1)}
.card-lift{transition:transform .25s cubic-bezier(.16,1,.3,1),box-shadow .25s,border-color .2s}
html{scroll-behavior:smooth}
body{margin:0;background:var(--color-bg-1);color:var(--color-text-0);font-family:var(--font-sans,system-ui,sans-serif);-webkit-font-smoothing:antialiased}
`

function googleFontsHref(fonts: string[]): string {
  const families = [...new Set(fonts)].filter(Boolean).map((f) => `family=${f.replace(/ /g, "+")}:wght@300;400;500;600;700;800`).join("&")
  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

/** Render one page's blocks to a complete, self-contained, deployable HTML doc. */
export async function buildPageHtml(opts: {
  siteName: string
  pageName: string
  blocks: BlockConfig[]
  theme?: Partial<ThemeConfig>
  variables?: Record<string, string>
}): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const resolved = resolveTheme(opts.theme)
  const vars = { ...themeToCSS(resolved), ...shadcnColorAliases(resolved) }

  const bodyMarkup = renderToStaticMarkup(
    createElement(
      VariablesProvider,
      { value: opts.variables || {} },
      createElement(
        "div",
        { className: "@container" },
        ...opts.blocks.map((block) =>
          createElement("div", { key: block.id, className: "scroll-revealed" }, createElement(RenderBlock, { block })),
        ),
      ),
    ),
  )

  const themeVars = Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join("\n")

  const fontsHref = googleFontsHref([resolved.fontSans, resolved.fontDisplay, resolved.fontMono])
  const title = `${opts.siteName}${opts.pageName && opts.pageName !== "Home" ? ` — ${opts.pageName}` : ""}`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="${fontsHref}" />
<script src="https://unpkg.com/@tailwindcss/browser@4"></script>
<style type="text/tailwindcss">
@import "tailwindcss";
@theme {
${themeVars}
}
</style>
<style>
:root {
${themeVars}
}
${RUNTIME_CSS}
</style>
</head>
<body class="@container">
${bodyMarkup}
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

export { pagePathToFilename } from "@/lib/builder/variables"
