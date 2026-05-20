"use client"

import React from "react"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import { PromptPanel } from "./prompt-panel"
import { SpatialCanvas } from "./spatial-canvas"
import { FramePreview } from "./frame-preview"
import { ComponentTree } from "./component-tree"
import { PropertyInspector } from "./property-inspector"
import { CodeDiffPanel } from "./code-diff-panel"

export function BuilderShell() {
  return (
    <div className="h-screen w-full overflow-hidden bg-background text-foreground">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={22} minSize={18}>
          <div className="h-full overflow-auto border-r p-4 space-y-6">
            <PromptPanel />
            <ComponentTree />
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={56} minSize={40}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={60} minSize={40}>
              <div className="h-full overflow-auto p-4">
                <SpatialCanvas />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={40} minSize={30}>
              <div className="h-full overflow-auto p-4 border-t">
                <FramePreview />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={22} minSize={18}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={55} minSize={30}>
              <div className="h-full overflow-auto p-4 border-l">
                <PropertyInspector />
              </div>
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={45} minSize={30}>
              <div className="h-full overflow-auto p-4 border-l border-t">
                <CodeDiffPanel />
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
