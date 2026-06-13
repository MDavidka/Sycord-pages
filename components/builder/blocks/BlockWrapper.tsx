"use client"

import { type ReactNode, useRef, useEffect } from "react"
import { Copy, Trash2, ChevronUp, ChevronDown } from "lucide-react"
import { toast } from "sonner"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { useScrollReveal } from "@/components/builder/hooks/use-scroll-reveal"
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
  const { duplicateBlock, removeBlock, moveBlock } = useConfigStore()
  const { selectedBlockId, selectBlock } = useEditorStore()
  const previewMode = useEditorStore((s) => s.previewMode)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { ref: revealRef, isRevealed } = useScrollReveal(!previewMode)

  const index = blocks.findIndex((b) => b.id === block.id)
  const isFirst = index === 0
  const isLast = index === blocks.length - 1

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
            if (selectedBlockId === block.id) selectBlock(null)
            removeBlock(block.id)
            toast("Block removed", {
              action: {
                label: "Undo",
                onClick: () => {
                  useConfigStore.getState().undo()
                  toast("Block restored")
                },
              },
              duration: 3000,
            })
          }}
          className="w-6 h-6 rounded-md bg-black/55 backdrop-blur-sm flex items-center justify-center text-white/75 hover:text-red-400 hover:bg-black/70 transition-colors"
          title="Delete"
          aria-label={`Delete ${block.type} block`}
        >
          <Trash2 size={12} />
        </button>
      </div>

      {children}
    </div>
  )
}
