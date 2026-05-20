"use client"

import React from "react"
import { useBuilderState } from "./builder-state"

export function CodeDiffPanel() {
  const { document, patchHistory } = useBuilderState()
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document JSON</div>
      <pre className="max-h-[260px] overflow-auto rounded-lg border bg-muted/20 p-3 text-[11px] text-muted-foreground">
        {JSON.stringify(document, null, 2)}
      </pre>
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Patch History</div>
      <pre className="max-h-[160px] overflow-auto rounded-lg border bg-muted/20 p-3 text-[11px] text-muted-foreground">
        {JSON.stringify(patchHistory, null, 2)}
      </pre>
    </div>
  )
}
