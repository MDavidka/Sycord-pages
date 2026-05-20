"use client"

import React from "react"
import { useBuilderState } from "./builder-state"
import { renderPageTree } from "@/lib/ai-ui-builder/runtime/render-node"
import { PreviewIframe } from "./preview-iframe"

const DEVICES = [
  { name: "Desktop", width: 1280 },
  { name: "Tablet", width: 768 },
  { name: "Mobile", width: 375 },
]

export function SpatialCanvas() {
  const { document } = useBuilderState()
  const page = document.pages[0]
  if (!page) {
    return <div className="text-sm text-muted-foreground">No pages to render.</div>
  }
  const content = renderPageTree(page.tree)

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Canvas</div>
      <div className="flex gap-6 overflow-x-auto pb-4">
        {DEVICES.map((device) => (
          <div key={device.name} className="flex shrink-0 flex-col gap-2">
            <div className="text-xs text-muted-foreground">{device.name} · {device.width}px</div>
            <div style={{ width: device.width }} className="h-[520px]">
              <PreviewIframe title={`${device.name} preview`}>
                <div className="min-h-full p-6">{content}</div>
              </PreviewIframe>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
