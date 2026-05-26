"use client"

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels"

export function BuilderShell() {
  return (
    <PanelGroup direction="horizontal" className="min-h-screen">
      <Panel defaultSize={20} className="p-4 border-r">Prompt + Tree</Panel>
      <PanelResizeHandle className="w-1 bg-border" />
      <Panel defaultSize={55} className="p-4 border-r">Canvas (1280 / 768 / 375)</Panel>
      <PanelResizeHandle className="w-1 bg-border" />
      <Panel defaultSize={25} className="p-4">Inspector + Diff</Panel>
    </PanelGroup>
  )
}
