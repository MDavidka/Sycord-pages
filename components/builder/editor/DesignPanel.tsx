"use client"

import { useState, useMemo } from "react"
import { ChevronDown } from "lucide-react"
import { useConfigStore } from "@/components/builder/store/config-store"
import type { ThemeConfig } from "@/lib/builder/types"
import { themePresets, resolveTheme, googleFontOptions } from "@/lib/builder/theme-presets"

function ColorInput({ value, onInput, onChange }: { value: string; onInput: (v: string) => void; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <input type="color" value={value} onInput={(e) => onInput((e.target as HTMLInputElement).value)} onChange={(e) => onChange(e.target.value)} className="w-6 h-6 rounded-md border border-border bg-background cursor-pointer p-0.5 shrink-0" />
      <input
        type="text"
        value={value}
        onChange={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v) }}
        onBlur={(e) => { const v = e.target.value; if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v) }}
        className="w-[76px] px-2 py-1 rounded-md border border-border bg-background text-muted-foreground text-[11px] font-mono outline-none focus:ring-1 focus:ring-ring"
      />
    </div>
  )
}

function ColorSection({ title, colors, defaultOpen = false }: { title: string; colors: { key: keyof ThemeConfig; label: string }[]; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const theme = useConfigStore((s) => s.config.theme)
  const previewTheme = useConfigStore((s) => s.previewTheme)
  const updateTheme = useConfigStore((s) => s.updateTheme)
  const resolved = useMemo(() => resolveTheme(theme), [theme])

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-3 py-2.5 bg-muted/40 hover:bg-accent transition-colors text-left">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-foreground">{title}</span>
          <div className="flex gap-0.5">
            {colors.slice(0, 4).map((c) => (
              <div key={c.key} className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: resolved[c.key] as string }} />
            ))}
          </div>
        </div>
        <ChevronDown size={13} className={`text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-3 py-2.5 space-y-2.5 bg-card">
          {colors.map((c) => (
            <div key={c.key} className="flex items-center justify-between">
              <span className="text-[11.5px] text-muted-foreground">{c.label}</span>
              <ColorInput value={resolved[c.key] as string} onInput={(v) => previewTheme({ [c.key]: v })} onChange={(v) => updateTheme({ [c.key]: v })} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function VariablesManager() {
  const variables = useConfigStore((s) => s.config.variables) ?? []
  const setVariables = useConfigStore((s) => s.setVariables)
  const update = (i: number, patch: Partial<{ key: string; value: string }>) =>
    setVariables(variables.map((v, idx) => (idx === i ? { ...v, ...patch } : v)))

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">Variables</div>
      <p className="text-[10.5px] text-muted-foreground/60 mb-2">Reusable values. Reference them in any text as <code className="text-foreground/80">{"{{key}}"}</code>.</p>
      {variables.map((v, i) => (
        <div key={i} className="flex gap-1 mb-1.5">
          <input value={v.key} onChange={(e) => update(i, { key: e.target.value.replace(/[^\w.-]/g, "") })} placeholder="key" className="w-[38%] px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-[12px] font-mono outline-none focus:ring-1 focus:ring-ring" />
          <input value={v.value} onChange={(e) => update(i, { value: e.target.value })} placeholder="value" className="flex-1 px-2 py-1.5 rounded-lg border border-border bg-background text-foreground text-[12px] outline-none focus:ring-1 focus:ring-ring" />
          <button onClick={() => setVariables(variables.filter((_, idx) => idx !== i))} className="px-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 text-xs transition-colors">x</button>
        </div>
      ))}
      <button onClick={() => setVariables([...variables, { key: `var${variables.length + 1}`, value: "" }])} className="text-[11px] text-foreground/80 hover:text-foreground transition-colors mt-0.5">+ Add variable</button>
    </div>
  )
}

export function DesignPanel() {
  const theme = useConfigStore((s) => s.config.theme)
  const setTheme = useConfigStore((s) => s.setTheme)
  const updateTheme = useConfigStore((s) => s.updateTheme)
  const resolved = useMemo(() => resolveTheme(theme), [theme])

  const activePresetId = useMemo(() => {
    for (const preset of themePresets) {
      const match = Object.keys(preset.theme).every((k) => resolved[k as keyof ThemeConfig] === preset.theme[k as keyof ThemeConfig])
      if (match) return preset.id
    }
    return null
  }, [resolved])

  return (
    <div className="px-3.5 py-3.5">
      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">Presets</div>
        <div className="grid grid-cols-2 gap-1.5">
          {themePresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => setTheme(preset.theme)}
              className={`p-2 rounded-xl border transition-all text-left ${activePresetId === preset.id ? "border-primary/50 bg-accent ring-1 ring-primary/30" : "border-border bg-muted/40 hover:border-foreground/20 hover:bg-accent"}`}
            >
              <div className="flex gap-0.5 mb-1.5">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.theme.bg0 }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.theme.bg2 }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.theme.accent }} />
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: preset.theme.text0 }} />
              </div>
              <div className="text-[11px] font-medium truncate text-foreground">{preset.name}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <ColorSection title="Backgrounds" defaultOpen colors={[
          { key: "bg0", label: "Base" }, { key: "bg1", label: "Surface 1" }, { key: "bg2", label: "Surface 2" },
          { key: "bg3", label: "Surface 3" }, { key: "bg4", label: "Surface 4" }, { key: "bg5", label: "Surface 5" },
        ]} />
        <ColorSection title="Text" colors={[
          { key: "text0", label: "Primary" }, { key: "text1", label: "Secondary" }, { key: "text2", label: "Muted" }, { key: "text3", label: "Dimmed" },
        ]} />
        <ColorSection title="Accent" defaultOpen colors={[{ key: "accent", label: "Accent" }, { key: "accentDim", label: "Accent Dim" }]} />
        <ColorSection title="Borders" colors={[
          { key: "borderDefault", label: "Default" }, { key: "borderSubtle", label: "Subtle" }, { key: "borderHover", label: "Hover" },
        ]} />
      </div>

      <div className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">Fonts</div>
        <div className="space-y-2.5">
          {([{ key: "fontSans" as const, label: "Body" }, { key: "fontDisplay" as const, label: "Display" }, { key: "fontMono" as const, label: "Mono" }]).map(({ key, label }) => (
            <div key={key}>
              <label className="block text-[11.5px] text-muted-foreground mb-1">{label}</label>
              <select value={resolved[key]} onChange={(e) => updateTheme({ [key]: e.target.value })} className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[12px] outline-none focus:ring-1 focus:ring-ring cursor-pointer" style={{ fontFamily: `"${resolved[key]}", sans-serif` }}>
                {googleFontOptions.map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 mb-2">Radius</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[11.5px] text-muted-foreground mb-1">Default</label>
            <input type="number" min={0} max={24} value={resolved.radius} onChange={(e) => updateTheme({ radius: Number(e.target.value) })} className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[12px] outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <div>
            <label className="block text-[11.5px] text-muted-foreground mb-1">Large</label>
            <input type="number" min={0} max={32} value={resolved.radiusLg} onChange={(e) => updateTheme({ radiusLg: Number(e.target.value) })} className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[12px] outline-none focus:ring-1 focus:ring-ring" />
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <VariablesManager />
      </div>
    </div>
  )
}
