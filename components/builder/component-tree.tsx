"use client"

import React from "react"
import { useBuilderState } from "./builder-state"
import type { ComponentNode } from "@/lib/ai-ui-builder/catalog/components"
import { cn } from "@/lib/utils"

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: ComponentNode
  depth: number
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-muted",
          selectedId === node.id && "bg-muted font-semibold",
        )}
        style={{ paddingLeft: depth * 12 + 8 }}
      >
        <span className="text-muted-foreground">{node.component}</span>
        <span className="truncate text-foreground/80">{node.id}</span>
      </button>
      {node.children?.map((child) => (
        <TreeNode key={child.id} node={child} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />
      ))}
    </div>
  )
}

export function ComponentTree() {
  const { document, selectedNodeId, selectNode } = useBuilderState()
  const page = document.pages[0]
  if (!page) {
    return <div className="text-sm text-muted-foreground">No components yet.</div>
  }
  return (
    <div className="space-y-2">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Component Tree</div>
      <div className="rounded-lg border bg-background p-2">
        <TreeNode node={page.tree} depth={0} selectedId={selectedNodeId} onSelect={selectNode} />
      </div>
    </div>
  )
}
