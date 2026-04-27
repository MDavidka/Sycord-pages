"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Monitor, Tablet, Smartphone, RotateCcw, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GeneratedFile } from "@/lib/builder/types"

type DeviceMode = "desktop" | "tablet" | "mobile"

interface PreviewCanvasProps {
  files: GeneratedFile[]
  currentRoute: string
  onRouteChange: (route: string) => void
  routes: string[]
}

const DEVICE_WIDTHS: Record<DeviceMode, string> = {
  desktop: "100%",
  tablet: "768px",
  mobile: "375px",
}

function buildPreviewHtml(files: GeneratedFile[], route: string): string {
  const globalsCss = files.find(f => f.path === "app/globals.css")?.content ?? ""
  const pageFile = route === "/"
    ? files.find(f => f.path === "app/page.tsx")
    : files.find(f => f.path === `app/${route.replace(/^\//, "")}/page.tsx`)

  const pageContent = pageFile?.content ?? "<p>No page content available</p>"

  // Extract JSX body from the page component (rough extraction)
  let bodyHtml = ""
  const returnMatch = pageContent.match(/return\s*\(\s*([\s\S]*)\s*\)\s*\}?\s*$/)
  if (returnMatch) {
    bodyHtml = returnMatch[1]
      // Convert className to class
      .replace(/className="/g, 'class="')
      // Remove JSX self-closing tags that aren't valid HTML
      .replace(/<([A-Z]\w+)([^>]*)\s*\/>/g, '<div$2></div>')
      // Convert component tags to divs for preview
      .replace(/<(FadeIn|Stagger|StaggerItem|MotionCard)([^>]*)>/g, '<div$2>')
      .replace(/<\/(FadeIn|Stagger|StaggerItem|MotionCard)>/g, '</div>')
      .replace(/<(Card|CardHeader|CardTitle|CardDescription|CardContent|CardFooter)([^>]*)>/g, '<div$2>')
      .replace(/<\/(Card|CardHeader|CardTitle|CardDescription|CardContent|CardFooter)>/g, '</div>')
      .replace(/<Badge([^>]*)>/g, '<span$1>')
      .replace(/<\/Badge>/g, '</span>')
      .replace(/<Button([^>]*)>/g, '<button$1>')
      .replace(/<\/Button>/g, '</button>')
      .replace(/<Separator[^>]*\/>/g, '<hr />')
      .replace(/<Input([^>]*)\/>/g, '<input$1 />')
      .replace(/<Textarea([^>]*)\/>/g, '<textarea$1></textarea>')
      // Remove import-like JSX expressions
      .replace(/\{[^}]*\}/g, '')
  } else {
    bodyHtml = `<div class="p-8 text-center text-gray-500">
      <p>Preview for route: ${route}</p>
      <p class="mt-2 text-sm">Full preview available after export.</p>
    </div>`
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>${globalsCss.replace(/@tailwind[^;]+;/g, '').replace(/@layer base \{[\s\S]*?\}/g, '')}</style>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; margin: 0; }
    button { cursor: pointer; padding: 0.5rem 1rem; border-radius: 0.375rem; border: 1px solid #e5e7eb; background: #f9fafb; font-size: 0.875rem; }
    button:hover { background: #f3f4f6; }
    input, textarea { padding: 0.5rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 0.375rem; font-size: 0.875rem; width: 100%; }
    hr { border: none; border-top: 1px solid #e5e7eb; margin: 1rem 0; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`
}

export function PreviewCanvas({ files, currentRoute, onRouteChange, routes }: PreviewCanvasProps) {
  const [device, setDevice] = useState<DeviceMode>("desktop")
  const [key, setKey] = useState(0)

  const previewHtml = buildPreviewHtml(files, currentRoute)
  const srcDoc = previewHtml

  return (
    <div className="flex flex-col h-full bg-muted/30">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1.5 border-b border-border bg-background shrink-0 overflow-x-auto">
        {/* Route switcher */}
        <select
          value={currentRoute}
          onChange={(e) => onRouteChange(e.target.value)}
          className="h-7 text-xs bg-muted border border-border rounded-md px-2 min-w-0 max-w-[120px] sm:max-w-[180px]"
        >
          {routes.map(r => (
            <option key={r} value={r}>{r === "/" ? "Home" : r}</option>
          ))}
        </select>

        <div className="w-px h-5 bg-border shrink-0" />

        {/* Device switcher */}
        <div className="flex items-center gap-0.5">
          {([
            { mode: "desktop" as const, icon: Monitor, label: "Desktop" },
            { mode: "tablet" as const, icon: Tablet, label: "Tablet" },
            { mode: "mobile" as const, icon: Smartphone, label: "Mobile" },
          ]).map(({ mode, icon: Icon, label }) => (
            <Button
              key={mode}
              variant={device === mode ? "secondary" : "ghost"}
              size="icon"
              className="h-7 w-7"
              onClick={() => setDevice(mode)}
              title={label}
            >
              <Icon className="h-3.5 w-3.5" />
            </Button>
          ))}
        </div>

        <div className="w-px h-5 bg-border shrink-0" />

        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setKey(k => k + 1)}
          title="Refresh preview"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Preview area */}
      <div className="flex-1 flex items-start justify-center p-2 sm:p-4 overflow-auto">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground text-sm">
            <Monitor className="h-10 w-10 mb-3 opacity-30" />
            <p>Live preview will appear here</p>
            <p className="text-xs mt-1">Submit a prompt to generate your website</p>
          </div>
        ) : (
          <div
            className={cn(
              "bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300",
              device !== "desktop" && "border border-border"
            )}
            style={{
              width: DEVICE_WIDTHS[device],
              maxWidth: "100%",
              height: device === "mobile" ? "667px" : device === "tablet" ? "1024px" : "100%",
              minHeight: "400px",
            }}
          >
            <iframe
              key={key}
              srcDoc={srcDoc}
              title="Website Preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts"
            />
          </div>
        )}
      </div>
    </div>
  )
}
