"use client"

import React, { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useBuilderState } from "./builder-state"
import type { ComponentNode } from "@/lib/ai-ui-builder/catalog/components"

function findNodeWithPath(
  node: ComponentNode,
  targetId: string,
  basePath: string,
): { node: ComponentNode; path: string } | null {
  if (node.id === targetId) return { node, path: basePath }
  for (let i = 0; i < (node.children?.length ?? 0); i += 1) {
    const child = node.children?.[i]
    if (!child) continue
    const result = findNodeWithPath(child, targetId, `${basePath}/children/${i}`)
    if (result) return result
  }
  return null
}

export function PropertyInspector() {
  const { document, selectedNodeId, applyPatches, applyPatch } = useBuilderState()
  const [localText, setLocalText] = useState("")
  const [localClassName, setLocalClassName] = useState("")
  const [localVariant, setLocalVariant] = useState("")

  const selection = useMemo(() => {
    if (!selectedNodeId) return null
    const pageIndex = 0
    const page = document.pages[pageIndex]
    const found = findNodeWithPath(page.tree, selectedNodeId, `/pages/${pageIndex}/tree`)
    return found
  }, [document.pages, selectedNodeId])

  React.useEffect(() => {
    if (!selection) return
    setLocalText(selection.node.text ?? "")
    setLocalClassName(String(selection.node.props?.className ?? ""))
    setLocalVariant(String(selection.node.props?.variant ?? ""))
  }, [selection])

  if (!selection) {
    return (
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inspector</div>
        <div className="rounded-lg border bg-muted/20 p-4 text-sm text-muted-foreground">
          Select a component to edit its properties.
        </div>
      </div>
    )
  }

  const { node, path } = selection

  const updateProp = (key: string, value: string) => {
    const patches = []
    if (!node.props) {
      patches.push({ op: "add", path: `${path}/props`, value: {} })
    }
    const op = node.props && key in node.props ? "replace" : "add"
    patches.push({ op, path: `${path}/props/${key}`, value })
    applyPatches(patches)
  }

  const updateText = (value: string) => {
    applyPatch({ op: "replace", path: `${path}/text`, value })
  }

  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Inspector</div>
      <div className="rounded-lg border bg-background p-4 space-y-3">
        <div className="text-xs text-muted-foreground">Component</div>
        <div className="text-sm font-semibold">{node.component}</div>
        <div className="text-xs text-muted-foreground">ID</div>
        <div className="text-xs">{node.id}</div>
        <div className="space-y-1">
          <Label className="text-xs">Text</Label>
          <Input
            value={localText}
            onChange={(event) => setLocalText(event.target.value)}
            onBlur={(event) => updateText(event.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Class name</Label>
          <Input
            value={localClassName}
            onChange={(event) => setLocalClassName(event.target.value)}
            onBlur={(event) => updateProp("className", event.target.value)}
          />
        </div>
        {node.component === "Button" && (
          <div className="space-y-1">
            <Label className="text-xs">Variant</Label>
            <Input
              value={localVariant}
              onChange={(event) => setLocalVariant(event.target.value)}
              onBlur={(event) => updateProp("variant", event.target.value)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
