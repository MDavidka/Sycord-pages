"use client"

import { createElement } from "react"
import { RenderBlock } from "@/components/builder/blocks/registry"
import { resolveTheme, themeToCSS } from "@/lib/builder/theme-presets"
import type { BlockConfig, ThemeConfig } from "@/lib/builder/types"

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
}): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server")
  const resolved = resolveTheme(opts.theme)
  const vars = themeToCSS(resolved)

  const bodyMarkup = renderToStaticMarkup(
    createElement(
      "div",
      { className: "@container" },
      ...opts.blocks.map((block) =>
        createElement("div", { key: block.id, className: "scroll-revealed" }, createElement(RenderBlock, { block })),
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

/** Convert a page path (e.g. "/", "/about") to a stored filename. */
export function pagePathToFilename(path: string): string {
  const clean = (path || "/").replace(/^\//, "").replace(/\/+$/, "")
  if (!clean) return "index.html"
  return `${clean.replace(/\//g, "-")}.html`
}
