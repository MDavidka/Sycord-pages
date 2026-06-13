"use client"

import { Plus } from "lucide-react"
import { toast } from "sonner"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { blockMetadata } from "@/lib/builder/block-metadata"
import type { BlockConfig } from "@/lib/builder/types"

export function CanvasEmpty() {
  const addBlock = useConfigStore((s) => s.addBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  function handleAddBlock() {
    const heroMeta = blockMetadata.find((b) => b.type === "hero")!
    const block: BlockConfig = {
      id: `block-${Date.now()}`,
      type: heroMeta.type,
      variant: heroMeta.variants[0],
      props: { ...heroMeta.defaultProps },
    }
    addBlock(block)
    selectBlock(block.id)
    toast("Hero block added")
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-10 relative z-[1] min-h-[360px]">
      <h3 className="text-lg font-semibold text-text-1">Start building</h3>
      <p className="text-[13px] text-text-3 max-w-[360px] leading-relaxed">
        Drag a component from the left panel onto the canvas, click to add one, or describe your site to the AI agent.
      </p>
      <button
        onClick={handleAddBlock}
        className="px-3.5 py-1.5 rounded-md bg-green text-black text-[12.5px] font-semibold border border-green hover:bg-green-dim transition-colors flex items-center gap-1.5"
      >
        <Plus size={14} />
        Add Hero Block
      </button>
    </div>
  )
}
