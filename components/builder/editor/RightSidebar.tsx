"use client"

import { useState, useEffect } from "react"
import { MousePointer2 } from "lucide-react"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { useConfigStore } from "@/components/builder/store/config-store"
import { PropertiesPanel } from "./PropertiesPanel"
import { DesignPanel } from "./DesignPanel"

type Tab = "properties" | "design"

/** Shared inner content used by both the desktop sidebar and the mobile sheet. */
export function RightSidebarContent({ defaultTab = "properties" }: { defaultTab?: Tab }) {
  const selectedBlockId = useEditorStore((s) => s.selectedBlockId)
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId)
  const [tab, setTab] = useState<Tab>(defaultTab)

  useEffect(() => {
    if (selectedBlock) setTab("properties")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBlock?.id])

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex border-b border-border shrink-0">
        <button onClick={() => setTab("properties")} className={`flex-1 py-2.5 text-[11.5px] font-medium transition-colors ${tab === "properties" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
          Properties
        </button>
        <button onClick={() => setTab("design")} className={`flex-1 py-2.5 text-[11.5px] font-medium transition-colors ${tab === "design" ? "text-foreground border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}>
          Design
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {tab === "design" ? (
          <DesignPanel />
        ) : selectedBlock ? (
          <>
            <PropertiesPanel block={selectedBlock} />
            <div className="px-3.5 py-2.5 font-mono text-[10.5px] text-muted-foreground/60 break-all border-t border-border">
              config.blocks[{blocks.indexOf(selectedBlock)}]
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 gap-3">
            <div className="w-10 h-10 rounded-xl bg-muted/50 border border-border flex items-center justify-center">
              <MousePointer2 size={16} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-foreground text-[12.5px] font-medium">Click a block to edit</p>
              <p className="text-muted-foreground text-[11px] mt-1">Select any block on the canvas to see its properties here</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export function RightSidebar() {
  return (
    <div className="hidden md:flex w-[280px] bg-card border-l border-border flex-col shrink-0">
      <RightSidebarContent />
    </div>
  )
}
