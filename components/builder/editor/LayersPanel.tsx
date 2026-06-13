"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Layout, Copy, Trash2, GripVertical, Plus, Search } from "lucide-react"
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { blockMetadata, type BlockMeta } from "@/lib/builder/block-metadata"
import { blockIcons } from "./LeftSidebar"
import type { BlockType, BlockConfig } from "@/lib/builder/types"

const blockLabels: Record<BlockType, string> = {
  navbar: "Navbar", hero: "Hero", features: "Features", pricing: "Pricing",
  cta: "CTA", footer: "Footer", testimonials: "Testimonials", stats: "Stats",
  faq: "FAQ", team: "Team", contact: "Contact", newsletter: "Newsletter",
  logocloud: "Logo Cloud", divider: "Divider", banner: "Banner",
  content: "Content", image: "Image", video: "Video", gallery: "Gallery",
}

function SortableLayer({ block, isSelected, onSelect, onDuplicate, onRemove }: {
  block: BlockConfig
  isSelected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })
  const Icon = blockIcons[block.type] || Layout
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group px-2 py-2 rounded-lg text-[13px] flex items-center gap-2 transition-all cursor-pointer select-none ${
        isSelected ? "bg-accent text-foreground ring-1 ring-primary/40" : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      }`}
    >
      <div {...attributes} {...listeners} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground cursor-grab active:cursor-grabbing touch-none" aria-label={`Drag to reorder ${blockLabels[block.type]}`}>
        <GripVertical size={13} />
      </div>
      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 border ${isSelected ? "border-primary/30 bg-primary/10 text-foreground" : "border-border bg-muted/40 text-muted-foreground"}`}>
        <Icon size={14} />
      </div>
      <span className="font-medium flex-1 truncate">{blockLabels[block.type]}</span>
      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={(e) => { e.stopPropagation(); onDuplicate() }} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-accent hover:text-foreground transition-all" aria-label={`Duplicate ${blockLabels[block.type]}`}>
          <Copy size={12} />
        </button>
        <button onClick={(e) => { e.stopPropagation(); onRemove() }} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-all" aria-label={`Remove ${blockLabels[block.type]}`}>
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  )
}

function AddComponentPopover({ onAdd, onClose }: { onAdd: (type: BlockType) => void; onClose: () => void }) {
  const [search, setSearch] = useState("")
  const filtered = blockMetadata.filter((b) => b.label.toLowerCase().includes(search.toLowerCase()) || b.category.toLowerCase().includes(search.toLowerCase()))
  const grouped = filtered.reduce<Record<string, BlockMeta[]>>((acc, b) => {
    if (!acc[b.category]) acc[b.category] = []
    acc[b.category].push(b)
    return acc
  }, {})

  return (
    <div className="absolute bottom-[52px] left-2 right-2 frosted-glass rounded-xl p-1.5 shadow-xl z-10 max-h-[280px] overflow-y-auto custom-scrollbar">
      <input
        autoFocus
        type="text"
        placeholder="Search components..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="w-full px-2.5 py-2 rounded-lg border border-border bg-background text-foreground text-[12px] outline-none focus:ring-1 focus:ring-ring mb-1"
      />
      {Object.entries(grouped).map(([category, items]) => (
        <div key={category}>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 px-1.5 pt-2 pb-1">{category}</div>
          {items.map((meta) => {
            const Icon = blockIcons[meta.type] || Layout
            return (
              <button key={meta.type} onClick={() => { onAdd(meta.type); onClose() }} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors text-left">
                <div className="w-6 h-6 rounded-md border border-border bg-muted/40 flex items-center justify-center shrink-0">
                  <Icon size={13} />
                </div>
                <span>{meta.label}</span>
                <span className="ml-auto text-[10px] text-muted-foreground/60">{meta.variants.length}v</span>
              </button>
            )
          })}
        </div>
      ))}
      {filtered.length === 0 && (
        <div className="px-2 py-3 text-center text-[12px] text-muted-foreground flex items-center justify-center gap-1.5">
          <Search size={12} />
          No components match &ldquo;{search}&rdquo;
        </div>
      )}
    </div>
  )
}

export function LayersPanel() {
  const blocks = useConfigStore((s) => {
    const pages = s.config.pages
    if (!pages || pages.length === 0) return s.config.blocks
    const page = pages.find((p) => p.id === s.activePageId) ?? pages[0]
    return page.blocks
  })
  const { duplicateBlock, removeBlock, moveBlock, addBlock } = useConfigStore()
  const { selectedBlockId, selectBlock } = useEditorStore()
  const [showPopover, setShowPopover] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = blocks.findIndex((b) => b.id === active.id)
    const newIndex = blocks.findIndex((b) => b.id === over.id)
    if (oldIndex !== -1 && newIndex !== -1) moveBlock(oldIndex, newIndex)
  }

  function handleAddBlock(type: BlockType) {
    const meta = blockMetadata.find((b) => b.type === type)
    if (!meta) return
    const block: BlockConfig = { id: `block-${Date.now()}`, type, variant: meta.variants[0], props: { ...meta.defaultProps } }
    addBlock(block)
    selectBlock(block.id)
    toast(`${meta.label} added`)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden relative">
      <div className="px-3 pt-3 pb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">Layers</span>
        <span className="text-[11px] text-muted-foreground/60">{blocks.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {blocks.map((block) => (
              <SortableLayer
                key={block.id}
                block={block}
                isSelected={selectedBlockId === block.id}
                onSelect={() => selectBlock(block.id)}
                onDuplicate={() => { duplicateBlock(block.id); toast("Block duplicated") }}
                onRemove={() => {
                  if (selectedBlockId === block.id) selectBlock(null)
                  removeBlock(block.id)
                  toast("Block removed", {
                    action: { label: "Undo", onClick: () => { useConfigStore.getState().undo(); toast("Block restored") } },
                    duration: 3000,
                  })
                }}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="p-2 border-t border-border relative">
        <button
          onClick={() => setShowPopover(!showPopover)}
          className="w-full py-2 rounded-lg border border-dashed border-border text-muted-foreground text-xs flex items-center justify-center gap-1.5 transition-all hover:border-primary/50 hover:text-foreground hover:bg-accent/50"
        >
          <Plus size={14} />
          Add Component
        </button>
        {showPopover && <AddComponentPopover onAdd={handleAddBlock} onClose={() => setShowPopover(false)} />}
      </div>
    </div>
  )
}
