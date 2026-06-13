"use client"

import { useMemo } from "react"
import { useDroppable } from "@dnd-kit/core"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { CanvasEmpty } from "./CanvasEmpty"
import { BlockWrapper } from "@/components/builder/blocks/BlockWrapper"
import { RenderBlock } from "@/components/builder/blocks/registry"
import { resolveTheme, themeToCSS } from "@/lib/builder/theme-presets"
import { useGoogleFonts } from "@/components/builder/hooks/use-google-fonts"

/**
 * A thin drop indicator between blocks. This is the drag-and-drop drop option:
 * components dragged from the palette can be dropped at any insertion point on
 * the canvas. Each zone is a @dnd-kit droppable keyed by its insertion index.
 */
function CanvasDropZone({ index, dndActive }: { index: number; dndActive: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `canvas-drop-${index}`, data: { index } })
  if (!dndActive) return null
  return (
    <div ref={setNodeRef} className="relative h-0" aria-hidden>
      <div
        className={`absolute left-0 right-0 -top-1 flex items-center justify-center transition-all duration-150 ${
          isOver ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="h-1 w-full bg-primary rounded-full shadow-[0_0_10px_1px_rgba(255,255,255,0.4)]" />
      </div>
    </div>
  )
}

export function Canvas({ dndActive = false }: { dndActive?: boolean }) {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const theme = useConfigStore((s) => s.config.theme)
  const { selectedBlockId, selectBlock, viewport } = useEditorStore()

  const resolved = useMemo(() => resolveTheme(theme), [theme])
  const cssVars = useMemo(() => themeToCSS(resolved), [resolved])
  useGoogleFonts([resolved.fontSans, resolved.fontDisplay, resolved.fontMono])

  // Drop zone for the empty canvas / appending at the end.
  const { setNodeRef: setEndRef, isOver: endOver } = useDroppable({ id: "canvas-drop-end", data: { index: blocks.length } })

  const maxWidth = viewport === "desktop" ? "100%" : viewport === "tablet" ? "768px" : "375px"

  if (blocks.length === 0) {
    return (
      <div className="flex-1 flex items-start justify-center p-4 md:p-6 overflow-auto custom-scrollbar relative">
        <div
          ref={setEndRef}
          className={`w-full max-w-[880px] rounded-2xl border-2 border-dashed transition-colors ${
            endOver ? "border-primary bg-accent" : "border-border"
          }`}
        >
          <CanvasEmpty />
        </div>
      </div>
    )
  }

  const canvasContent = (
    <div
      className="@container border rounded-2xl min-h-[400px] relative z-[1] overflow-hidden transition-all duration-300 shadow-sm"
      style={{ width: "100%", maxWidth, ...cssVars, color: "var(--color-text-0)", backgroundColor: "var(--color-bg-1)", borderColor: "var(--color-border-default)" } as React.CSSProperties}
      onClick={(e) => {
        if (e.target === e.currentTarget) selectBlock(null)
      }}
      role="region"
      aria-label={`Site preview, ${blocks.length} blocks, ${viewport} viewport`}
    >
      <CanvasDropZone index={0} dndActive={dndActive} />
      {blocks.map((block, i) => (
        <div key={block.id}>
          <BlockWrapper block={block} isSelected={selectedBlockId === block.id} onSelect={() => selectBlock(block.id)}>
            <RenderBlock block={block} />
          </BlockWrapper>
          <CanvasDropZone index={i + 1} dndActive={dndActive} />
        </div>
      ))}
      {/* End drop area when dragging */}
      <div ref={setEndRef} className={`transition-all ${dndActive ? (endOver ? "bg-primary/10 h-10" : "h-6") : "h-0"}`} />
    </div>
  )

  return (
    <div className="flex-1 flex items-start justify-center p-4 md:p-6 overflow-auto custom-scrollbar relative">
      <div
        className="absolute inset-0 opacity-50 pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)", backgroundSize: "22px 22px" }}
      />

      {viewport === "tablet" ? (
        <div className="relative z-[1]">
          <div className="border-[12px] border-muted rounded-[1.75rem] bg-muted shadow-2xl">
            <div className="rounded-xl overflow-hidden">{canvasContent}</div>
          </div>
        </div>
      ) : viewport === "mobile" ? (
        <div className="relative z-[1]">
          <div className="border-[10px] border-muted rounded-[2.25rem] bg-muted shadow-2xl">
            <div className="flex justify-center -mt-[4px] mb-1">
              <div className="w-24 h-5 bg-muted rounded-b-2xl" />
            </div>
            <div className="rounded-[1.5rem] overflow-hidden">{canvasContent}</div>
            <div className="flex justify-center mt-2 pb-1">
              <div className="w-28 h-1 bg-accent rounded-full" />
            </div>
          </div>
        </div>
      ) : (
        <div className="relative z-[1] w-full max-w-[980px]">{canvasContent}</div>
      )}
    </div>
  )
}
