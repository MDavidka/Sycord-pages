"use client"

import { type ReactNode, useRef, useEffect, useState } from "react"
import { Copy, Trash2, ChevronUp, ChevronDown, Settings2, Pencil } from "lucide-react"
import { toast } from "sonner"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { useScrollReveal } from "@/components/builder/hooks/use-scroll-reveal"
import { blockMetadata } from "@/lib/builder/block-metadata"
import type { BlockConfig } from "@/lib/builder/types"

interface Props {
  block: BlockConfig
  isSelected: boolean
  onSelect: () => void
  children: ReactNode
}

export function BlockWrapper({ block, isSelected, onSelect, children }: Props) {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const { duplicateBlock, removeBlock, moveBlock, updateBlock } = useConfigStore()
  const { selectedBlockId, selectBlock, requestEdit } = useEditorStore()
  const previewMode = useEditorStore((s) => s.previewMode)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { ref: revealRef, isRevealed } = useScrollReveal(!previewMode)
  const [manageOpen, setManageOpen] = useState(false)

  const index = blocks.findIndex((b) => b.id === block.id)
  const isFirst = index === 0
  const isLast = index === blocks.length - 1
  const variants = blockMetadata.find((b) => b.type === block.type)?.variants ?? []

  function deleteBlock() {
    if (selectedBlockId === block.id) selectBlock(null)
    removeBlock(block.id)
    toast("Block removed", {
      action: { label: "Undo", onClick: () => { useConfigStore.getState().undo(); toast("Block restored") } },
      duration: 3000,
    })
  }

  useEffect(() => {
    if (isSelected && scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" })
    }
  }, [isSelected])

  if (previewMode) {
    return (
      <div ref={revealRef} className={isRevealed ? "scroll-revealed" : ""}>
        {children}
      </div>
    )
  }

  return (
    <div
      ref={(el) => {
        ;(scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el
        ;(revealRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      }}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
      className={`scroll-revealed relative cursor-pointer group transition-[opacity,transform] duration-500 ${
        isRevealed ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      } ${
        isSelected
          ? "outline outline-2 outline-white/80 -outline-offset-2 rounded-sm animate-select-pulse"
          : "hover:outline hover:outline-1 hover:outline-white/25 hover:-outline-offset-1"
      }`}
      role="button"
      aria-label={`${block.type} block${isSelected ? ", selected" : ""}`}
      aria-selected={isSelected}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onSelect()
        }
      }}
      style={{ transitionTimingFunction: "cubic-bezier(0.16, 1, 0.3, 1)" }}
    >
      <span
        className={`absolute top-1.5 left-1.5 text-[10px] font-semibold uppercase tracking-wider text-black bg-white px-1.5 py-0.5 rounded-md transition-opacity z-10 ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        {block.type}
      </span>

      <div
        className={`absolute top-1.5 right-1.5 flex gap-0.5 z-10 transition-opacity ${
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        }`}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onSelect(); setManageOpen((o) => !o) }}
          className="w-6 h-6 rounded-md bg-white text-black flex items-center justify-center hover:bg-white/90 transition-colors"
          title="Manage block"
          aria-label={`Manage ${block.type} block`}
          aria-expanded={manageOpen}
        >
          <Settings2 size={12} />
        </button>
        {!isFirst && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              moveBlock(index, index - 1)
            }}
            className="w-6 h-6 rounded-md bg-black/55 backdrop-blur-sm flex items-center justify-center text-white/75 hover:text-white hover:bg-black/70 transition-colors"
            title="Move up"
            aria-label={`Move ${block.type} block up`}
          >
            <ChevronUp size={12} />
          </button>
        )}
        {!isLast && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              moveBlock(index, index + 1)
            }}
            className="w-6 h-6 rounded-md bg-black/55 backdrop-blur-sm flex items-center justify-center text-white/75 hover:text-white hover:bg-black/70 transition-colors"
            title="Move down"
            aria-label={`Move ${block.type} block down`}
          >
            <ChevronDown size={12} />
          </button>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation()
            duplicateBlock(block.id)
          }}
          className="w-6 h-6 rounded-md frosted-glass flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          title="Duplicate"
          aria-label={`Duplicate ${block.type} block`}
        >
          <Copy size={12} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            deleteBlock()
          }}
          className="w-6 h-6 rounded-md bg-black/55 backdrop-blur-sm flex items-center justify-center text-white/75 hover:text-red-400 hover:bg-black/70 transition-colors"
          title="Delete"
          aria-label={`Delete ${block.type} block`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {/* Manage menu — one button to manage everything about this block */}
      {manageOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={(e) => { e.stopPropagation(); setManageOpen(false) }} />
          <div
            className="absolute top-9 right-1.5 z-30 w-44 rounded-lg border border-white/10 bg-[#1b1b1d] text-white shadow-2xl p-1 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <button onClick={() => { requestEdit(block.id); setManageOpen(false) }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-white/85 hover:bg-white/10 transition-colors">
              <Pencil size={12} /> Edit properties
            </button>
            <button onClick={() => { duplicateBlock(block.id); setManageOpen(false); toast("Block duplicated") }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-white/85 hover:bg-white/10 transition-colors">
              <Copy size={12} /> Duplicate
            </button>
            <button disabled={isFirst} onClick={() => { moveBlock(index, index - 1); setManageOpen(false) }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-white/85 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronUp size={12} /> Move up
            </button>
            <button disabled={isLast} onClick={() => { moveBlock(index, index + 1); setManageOpen(false) }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-white/85 hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <ChevronDown size={12} /> Move down
            </button>
            {variants.length > 1 && (
              <div className="mt-1 pt-1 border-t border-white/10">
                <div className="px-2.5 py-1 text-[10px] uppercase tracking-wider text-white/40">Variant</div>
                <div className="max-h-32 overflow-y-auto">
                  {variants.map((v) => (
                    <button key={v} onClick={() => { updateBlock(block.id, { variant: v }) }} className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-[12px] transition-colors ${block.variant === v ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10"}`}>
                      <span className="capitalize">{v}</span>
                      {block.variant === v && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-1 pt-1 border-t border-white/10">
              <button onClick={() => { deleteBlock(); setManageOpen(false) }} className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-red-400 hover:bg-red-500/15 transition-colors">
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        </>
      )}

      {children}
    </div>
  )
}
