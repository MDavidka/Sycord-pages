"use client"

import React, { useMemo, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import { IframePortal } from "./iframe-portal"

export function PreviewIframe({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [ready, setReady] = useState(false)
  const srcDoc = useMemo(
    () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; background: #fff; color: #0f172a; }
      * { box-sizing: border-box; }
    </style>
  </head>
  <body></body>
</html>`,
    [],
  )

  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-xl border bg-background", className)}>
      <iframe
        ref={iframeRef}
        title={title}
        sandbox="allow-same-origin"
        className="h-full w-full"
        srcDoc={srcDoc}
        onLoad={() => setReady(true)}
      />
      {ready && <IframePortal iframe={iframeRef.current}>{children}</IframePortal>}
    </div>
  )
}
