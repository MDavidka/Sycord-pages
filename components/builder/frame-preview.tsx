"use client"

import React from "react"
import { useBuilderState } from "./builder-state"
import { renderPageTree } from "@/lib/ai-ui-builder/runtime/render-node"
import { PreviewIframe } from "./preview-iframe"

export function FramePreview() {
  const { document } = useBuilderState()
  const page = document.pages[0]
  if (!page) {
    return <div className="text-sm text-muted-foreground">No preview available.</div>
  }
  const content = renderPageTree(page.tree)

  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview</div>
      <div className="h-[480px]">
        <PreviewIframe title="Live preview" className="h-full">
          <div className="min-h-full p-6">{content}</div>
        </PreviewIframe>
      </div>
    </div>
  )
}
