"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useDraggable } from "@dnd-kit/core"
import {
  Search, Layout, Type, Grid3X3, DollarSign, Megaphone, PanelBottom, MessageSquare,
  BarChart3, HelpCircle, Users, Mail, Newspaper, Image, Plus, Minus, Flag, FileText,
  ImageIcon, Play, GalleryHorizontalEnd, GripVertical,
} from "lucide-react"
import { LayersPanel } from "./LayersPanel"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { blockMetadata, type BlockMeta } from "@/lib/builder/block-metadata"
import type { BlockType, BlockConfig } from "@/lib/builder/types"

export const blockIcons: Record<BlockType, typeof Layout> = {
  navbar: Layout, hero: Type, features: Grid3X3, pricing: DollarSign,
  cta: Megaphone, footer: PanelBottom, testimonials: MessageSquare,
  stats: BarChart3, faq: HelpCircle, team: Users, contact: Mail,
  newsletter: Newspaper, logocloud: Image, divider: Minus, banner: Flag,
  content: FileText, image: ImageIcon, video: Play, gallery: GalleryHorizontalEnd,
}

/** A draggable palette item — drag it onto the canvas to insert a block. */
function DraggablePaletteItem({ meta, onAdd }: { meta: BlockMeta; onAdd: (type: BlockType) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${meta.type}`,
    data: { paletteType: meta.type },
  })
  const Icon = blockIcons[meta.type] || Layout

  return (
    <div
      ref={setNodeRef}
      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12px] text-text-1 hover:bg-bg-3 hover:text-text-0 transition-colors text-left group ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <span
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-text-3 group-hover:text-text-2 touch-none"
        title="Drag onto the canvas"
        aria-label={`Drag ${meta.label} onto canvas`}
      >
        <GripVertical size={12} />
      </span>
      <button onClick={() => onAdd(meta.type)} className="flex items-center gap-2 flex-1 text-left">
        <div className="w-[22px] h-[22px] rounded border border-border-default bg-bg-3 flex items-center justify-center text-[10px] shrink-0">
          <Icon size={12} />
        </div>
        <span className="flex-1">{meta.label}</span>
        <Plus size={11} className="text-text-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  )
}

function ComponentsPanel() {
  const [search, setSearch] = useState("")
  const addBlock = useConfigStore((s) => s.addBlock)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  const filtered = blockMetadata.filter(
    (b) => b.label.toLowerCase().includes(search.toLowerCase()) || b.category.toLowerCase().includes(search.toLowerCase()),
  )

  const grouped = filtered.reduce<Record<string, BlockMeta[]>>((acc, b) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {})

  function handleAdd(type: BlockType) {
    const meta = blockMetadata.find((b) => b.type === type)
    if (!meta) return
    const block: BlockConfig = { id: `block-${Date.now()}`, type, variant: meta.variants[0], props: { ...meta.defaultProps } }
    addBlock(block)
    selectBlock(block.id)
    toast(`${meta.label} added`)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="px-3 pt-2.5 pb-1.5">
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-3" />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-2 py-1.5 rounded-md border border-border-default bg-bg-2 text-text-0 text-[11px] outline-none focus:border-green placeholder:text-text-3"
            style={{ paddingLeft: "1.625rem" }}
          />
        </div>
        <p className="text-[10px] text-text-3 mt-1.5 px-0.5">Drag onto the canvas or click to append.</p>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <div className="text-[9px] font-semibold uppercase tracking-wider text-text-3 px-1.5 pt-2.5 pb-1">{category}</div>
            {items.map((meta) => (
              <DraggablePaletteItem key={meta.type} meta={meta} onAdd={handleAdd} />
            ))}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-2 py-6 text-center text-[11px] text-text-3">No components match &ldquo;{search}&rdquo;</div>
        )}
      </div>
    </div>
  )
}

type Tab = "layers" | "components"

export function LeftSidebar() {
  const [tab, setTab] = useState<Tab>("components")

  return (
    <div className="hidden md:flex w-[280px] bg-bg-1 border-r border-border-default flex-col shrink-0">
      <div className="flex border-b border-border-default shrink-0">
        <button
          onClick={() => setTab("layers")}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${tab === "layers" ? "text-text-0 border-b border-green" : "text-text-3 hover:text-text-1"}`}
        >
          Layers
        </button>
        <button
          onClick={() => setTab("components")}
          className={`flex-1 py-2 text-[11px] font-medium transition-colors ${tab === "components" ? "text-text-0 border-b border-green" : "text-text-3 hover:text-text-1"}`}
        >
          Components
        </button>
      </div>
      {tab === "layers" ? <LayersPanel /> : <ComponentsPanel />}
    </div>
  )
}
