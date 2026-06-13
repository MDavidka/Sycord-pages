"use client"

import { useState } from "react"
import { ChevronDown, ChevronRight, Code } from "lucide-react"
import type { BlockConfig, BlockType } from "@/lib/builder/types"
import { useConfigStore } from "@/components/builder/store/config-store"
import { blockMetadata } from "@/lib/builder/block-metadata"

interface FieldDef {
  key: string
  label: string
  type: "text" | "textarea" | "select" | "array-strings" | "array-items"
  options?: string[]
}

const blockFields: Partial<Record<BlockType, { sections: { title: string; fields: FieldDef[] }[] }>> = {
  navbar: {
    sections: [
      { title: "Content", fields: [
        { key: "logo", label: "Logo Text", type: "text" },
        { key: "logoImage", label: "Logo Image URL", type: "text" },
        { key: "ctaText", label: "CTA Button", type: "text" },
        { key: "links", label: "Nav Links", type: "array-strings" },
      ] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["default", "centered"] }] },
    ],
  },
  hero: {
    sections: [
      { title: "Content", fields: [
        { key: "badge", label: "Badge", type: "text" },
        { key: "headline", label: "Headline", type: "text" },
        { key: "subheadline", label: "Subheadline", type: "textarea" },
        { key: "primaryCta", label: "Primary CTA", type: "text" },
        { key: "primaryCtaUrl", label: "Primary CTA URL", type: "text" },
        { key: "secondaryCta", label: "Secondary CTA", type: "text" },
        { key: "secondaryCtaUrl", label: "Secondary CTA URL", type: "text" },
        { key: "heroImage", label: "Hero Image URL", type: "text" },
      ] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["centered", "split", "gradient", "minimal"] }] },
    ],
  },
  features: {
    sections: [
      { title: "Content", fields: [
        { key: "label", label: "Section Label", type: "text" },
        { key: "title", label: "Title", type: "text" },
        { key: "subtitle", label: "Subtitle", type: "text" },
      ] },
      { title: "Items", fields: [{ key: "items", label: "Feature Cards", type: "array-items" }] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["grid", "list", "alternating"] }] },
    ],
  },
  pricing: {
    sections: [
      { title: "Content", fields: [{ key: "title", label: "Title", type: "text" }, { key: "subtitle", label: "Subtitle", type: "text" }] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["simple", "comparison"] }] },
    ],
  },
  cta: {
    sections: [
      { title: "Content", fields: [
        { key: "headline", label: "Headline", type: "text" },
        { key: "subheadline", label: "Subheadline", type: "text" },
        { key: "buttonText", label: "Button Text", type: "text" },
        { key: "buttonUrl", label: "Button URL", type: "text" },
      ] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["simple", "split"] }] },
    ],
  },
  footer: {
    sections: [
      { title: "Content", fields: [
        { key: "logo", label: "Logo Text", type: "text" },
        { key: "logoImage", label: "Logo Image URL", type: "text" },
        { key: "copyright", label: "Copyright", type: "text" },
        { key: "links", label: "Links", type: "array-strings" },
      ] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["simple", "multi-column", "minimal"] }] },
    ],
  },
  testimonials: {
    sections: [
      { title: "Content", fields: [
        { key: "title", label: "Title", type: "text" },
        { key: "subtitle", label: "Subtitle", type: "text" },
        { key: "items", label: "Testimonials", type: "array-items" },
      ] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["cards", "carousel", "spotlight"] }] },
    ],
  },
  stats: {
    sections: [
      { title: "Content", fields: [{ key: "title", label: "Title", type: "text" }, { key: "items", label: "Stats", type: "array-items" }] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["grid", "bar", "counter"] }] },
    ],
  },
  faq: {
    sections: [
      { title: "Content", fields: [
        { key: "title", label: "Title", type: "text" },
        { key: "subtitle", label: "Subtitle", type: "text" },
        { key: "items", label: "Questions", type: "array-items" },
      ] },
    ],
  },
  team: {
    sections: [
      { title: "Content", fields: [
        { key: "title", label: "Title", type: "text" },
        { key: "subtitle", label: "Subtitle", type: "text" },
        { key: "members", label: "Members", type: "array-items" },
      ] },
    ],
  },
  contact: {
    sections: [{ title: "Content", fields: [{ key: "title", label: "Title", type: "text" }, { key: "subtitle", label: "Subtitle", type: "text" }] }],
  },
  newsletter: {
    sections: [
      { title: "Content", fields: [
        { key: "title", label: "Title", type: "text" },
        { key: "subtitle", label: "Subtitle", type: "text" },
        { key: "buttonText", label: "Button Text", type: "text" },
        { key: "socialProof", label: "Social Proof", type: "text" },
      ] },
    ],
  },
  logocloud: {
    sections: [{ title: "Content", fields: [{ key: "title", label: "Title", type: "text" }, { key: "logos", label: "Logos", type: "array-strings" }] }],
  },
  content: {
    sections: [
      { title: "Content", fields: [{ key: "body", label: "Body", type: "textarea" }] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["prose", "columns", "highlight"] }] },
    ],
  },
  image: {
    sections: [
      { title: "Content", fields: [
        { key: "src", label: "Image URL", type: "text" },
        { key: "alt", label: "Alt Text", type: "text" },
        { key: "title", label: "Title", type: "text" },
        { key: "subtitle", label: "Subtitle", type: "text" },
        { key: "imageSide", label: "Image Side", type: "select", options: ["left", "right"] },
      ] },
      { title: "Grid Images", fields: [{ key: "images", label: "Images", type: "array-items" }] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["hero-image", "side-by-side", "grid"] }] },
    ],
  },
  video: {
    sections: [
      { title: "Content", fields: [{ key: "url", label: "Video URL", type: "text" }, { key: "title", label: "Title", type: "text" }] },
      { title: "Style", fields: [{ key: "variant", label: "Platform", type: "select", options: ["youtube", "vimeo"] }] },
    ],
  },
  gallery: {
    sections: [
      { title: "Content", fields: [{ key: "title", label: "Title", type: "text" }, { key: "images", label: "Images", type: "array-items" }] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["grid", "masonry"] }] },
    ],
  },
  divider: {
    sections: [
      { title: "Style", fields: [
        { key: "variant", label: "Variant", type: "select", options: ["line", "space", "dots"] },
        { key: "width", label: "Width", type: "select", options: ["full", "centered", "narrow"] },
        { key: "height", label: "Height (px)", type: "text" },
      ] },
    ],
  },
  banner: {
    sections: [
      { title: "Content", fields: [
        { key: "text", label: "Text", type: "text" },
        { key: "linkText", label: "Link Text", type: "text" },
        { key: "linkUrl", label: "Link URL", type: "text" },
      ] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["ribbon", "bar"] }] },
    ],
  },
  button: {
    sections: [
      { title: "Content", fields: [
        { key: "text", label: "Label", type: "text" },
        { key: "url", label: "URL", type: "text" },
      ] },
      { title: "Style", fields: [
        { key: "variant", label: "Variant", type: "select", options: ["default", "secondary", "outline", "ghost", "link", "destructive"] },
        { key: "size", label: "Size", type: "select", options: ["default", "sm", "lg"] },
        { key: "align", label: "Align", type: "select", options: ["left", "center", "right"] },
      ] },
    ],
  },
  heading: {
    sections: [
      { title: "Content", fields: [{ key: "text", label: "Text", type: "text" }] },
      { title: "Style", fields: [
        { key: "variant", label: "Level", type: "select", options: ["h1", "h2", "h3", "h4"] },
        { key: "align", label: "Align", type: "select", options: ["left", "center", "right"] },
      ] },
    ],
  },
  text: {
    sections: [
      { title: "Content", fields: [{ key: "text", label: "Text", type: "textarea" }] },
      { title: "Style", fields: [
        { key: "variant", label: "Style", type: "select", options: ["base", "lead", "muted", "small"] },
        { key: "align", label: "Align", type: "select", options: ["left", "center", "right"] },
      ] },
    ],
  },
  badge: {
    sections: [
      { title: "Content", fields: [{ key: "text", label: "Text", type: "text" }] },
      { title: "Style", fields: [
        { key: "variant", label: "Variant", type: "select", options: ["default", "secondary", "outline", "destructive"] },
        { key: "align", label: "Align", type: "select", options: ["left", "center", "right"] },
      ] },
    ],
  },
  card: {
    sections: [
      { title: "Content", fields: [
        { key: "title", label: "Title", type: "text" },
        { key: "description", label: "Description", type: "text" },
        { key: "body", label: "Body", type: "textarea" },
        { key: "buttonText", label: "Button Text", type: "text" },
      ] },
      { title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: ["default", "ghost"] }] },
    ],
  },
}

function PropertyField({ field, block }: { field: FieldDef; block: BlockConfig }) {
  const updateBlockProps = useConfigStore((s) => s.updateBlockProps)
  const updateBlock = useConfigStore((s) => s.updateBlock)

  const value = field.key === "variant" ? block.variant : (block.props as Record<string, unknown>)[field.key]

  const onChange = (newValue: unknown) => {
    if (field.key === "variant") {
      updateBlock(block.id, { variant: newValue as string })
    } else {
      updateBlockProps(block.id, { [field.key]: newValue })
    }
  }

  switch (field.type) {
    case "text":
      return (
        <div className="mb-2.5">
          <label className="block text-[12px] text-muted-foreground mb-1 font-medium">{field.label}</label>
          <input type="text" value={String(value || "")} onChange={(e) => onChange(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[13px] outline-none focus:ring-1 focus:ring-ring transition-shadow" />
        </div>
      )
    case "textarea":
      return (
        <div className="mb-2.5">
          <label className="block text-[12px] text-muted-foreground mb-1 font-medium">{field.label}</label>
          <textarea value={String(value || "")} onChange={(e) => onChange(e.target.value)} rows={3} className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[13px] outline-none focus:ring-1 focus:ring-ring resize-y transition-shadow" />
        </div>
      )
    case "select":
      return (
        <div className="mb-2.5">
          <label className="block text-[12px] text-muted-foreground mb-1 font-medium">{field.label}</label>
          <select value={String(value || "")} onChange={(e) => onChange(e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[13px] outline-none focus:ring-1 focus:ring-ring cursor-pointer">
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )
    case "array-strings": {
      const items = (Array.isArray(value) ? value : []) as string[]
      return (
        <div className="mb-2.5">
          <label className="block text-[12px] text-muted-foreground mb-1 font-medium">{field.label}</label>
          {items.map((item, i) => (
            <div key={i} className="flex gap-1 mb-1">
              <input type="text" value={item} onChange={(e) => { const updated = [...items]; updated[i] = e.target.value; onChange(updated) }} className="flex-1 px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[13px] outline-none focus:ring-1 focus:ring-ring" />
              <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="px-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs transition-colors">x</button>
            </div>
          ))}
          <button onClick={() => onChange([...items, ""])} className="text-[11px] text-foreground/80 hover:text-foreground transition-colors mt-0.5">+ Add item</button>
        </div>
      )
    }
    case "array-items": {
      const items = (Array.isArray(value) ? value : []) as Array<Record<string, string>>
      function createEmptyItem(): Record<string, string> {
        if (items.length > 0) {
          const template: Record<string, string> = {}
          for (const key of Object.keys(items[0])) template[key] = ""
          return template
        }
        const blockTemplates: Partial<Record<string, Record<string, Record<string, string>>>> = {
          testimonials: { items: { name: "", role: "", quote: "" } },
          stats: { items: { value: "", label: "" } },
          faq: { items: { question: "", answer: "" } },
          team: { members: { name: "", role: "" } },
          features: { items: { title: "", description: "" } },
          image: { images: { src: "", alt: "" } },
          gallery: { images: { src: "", alt: "", caption: "" } },
        }
        return blockTemplates[block.type]?.[field.key] || { title: "", description: "" }
      }
      return (
        <div className="mb-2.5">
          <label className="block text-[12px] text-muted-foreground mb-1 font-medium">{field.label}</label>
          {items.map((item, i) => (
            <div key={i} className="bg-muted/40 border border-border rounded-lg p-2 mb-1.5">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground/70 font-medium">Item {i + 1}</span>
                <button onClick={() => onChange(items.filter((_, idx) => idx !== i))} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">Remove</button>
              </div>
              {Object.entries(item).map(([key, val]) => (
                <div key={key} className="mb-1">
                  <label className="block text-[10.5px] text-muted-foreground/70 mb-0.5">{key}</label>
                  <input type="text" value={String(val)} onChange={(e) => { const updated = [...items]; updated[i] = { ...updated[i], [key]: e.target.value }; onChange(updated) }} className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-foreground text-[12px] outline-none focus:ring-1 focus:ring-ring" />
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => onChange([...items, createEmptyItem()])} className="text-[11px] text-foreground/80 hover:text-foreground transition-colors">+ Add item</button>
        </div>
      )
    }
    default:
      return null
  }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="border-b border-border">
      <button onClick={() => setOpen(!open)} className="w-full px-3.5 py-2.5 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-muted-foreground transition-colors">
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-3.5 pb-3">{children}</div>}
    </div>
  )
}

/**
 * For blocks that have no hand-written schema (e.g. the shadcn UI catalogue),
 * derive an editable schema: a text/textarea field for every string prop plus a
 * variant selector when the block defines multiple variants.
 */
function deriveSchema(block: BlockConfig): { sections: { title: string; fields: FieldDef[] }[] } {
  const meta = blockMetadata.find((b) => b.type === block.type)
  const contentFields: FieldDef[] = []
  for (const [key, value] of Object.entries(block.props || {})) {
    if (typeof value === "string") {
      contentFields.push({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), type: value.length > 60 ? "textarea" : "text" })
    }
  }
  const sections: { title: string; fields: FieldDef[] }[] = []
  if (contentFields.length) sections.push({ title: "Content", fields: contentFields })
  if (meta && meta.variants.length > 1) {
    sections.push({ title: "Style", fields: [{ key: "variant", label: "Variant", type: "select", options: meta.variants }] })
  }
  return { sections }
}

export function PropertiesPanel({ block }: { block: BlockConfig }) {
  const [showJson, setShowJson] = useState(false)
  const schema = blockFields[block.type] ?? deriveSchema(block)
  const hasFields = schema.sections.length > 0

  return (
    <>
      <div className="px-3.5 py-3 border-b border-border flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Properties</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-foreground font-semibold capitalize">{block.type.replace(/^ui-/, "")}</span>
      </div>

      {hasFields ? (
        schema.sections.map((section) => (
          <Section key={section.title} title={section.title}>
            {section.fields.map((field) => (
              <PropertyField key={field.key} field={field} block={block} />
            ))}
          </Section>
        ))
      ) : (
        <div className="p-3.5 text-[12px] text-muted-foreground">This component has no inline-editable text. Use the block&apos;s Manage menu to duplicate, move, or delete it.</div>
      )}

      <div className="border-t border-border">
        <button onClick={() => setShowJson(!showJson)} className="w-full px-3.5 py-2 flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors">
          <Code size={12} />
          {showJson ? "Hide" : "View"} Block JSON
        </button>
        {showJson && (
          <pre className="px-3.5 pb-3 text-[10.5px] font-mono text-muted-foreground leading-relaxed overflow-x-auto max-h-48 overflow-y-auto custom-scrollbar">
            {JSON.stringify({ id: block.id, type: block.type, variant: block.variant, props: block.props }, null, 2)}
          </pre>
        )}
      </div>
    </>
  )
}
