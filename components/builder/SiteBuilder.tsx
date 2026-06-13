"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core"
import { toast } from "sonner"
import { Bot, Loader2, LayoutGrid, Layers as LayersIcon, SlidersHorizontal } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CanvasToolbar } from "@/components/builder/editor/CanvasToolbar"
import { LeftSidebar, ComponentsPanel, blockIcons } from "@/components/builder/editor/LeftSidebar"
import { LayersPanel } from "@/components/builder/editor/LayersPanel"
import { Canvas } from "@/components/builder/editor/Canvas"
import { RightSidebar, RightSidebarContent } from "@/components/builder/editor/RightSidebar"
import { JsonDrawer } from "@/components/builder/editor/JsonDrawer"
import { VersionHistory } from "@/components/builder/editor/VersionHistory"
import { GenerationOverlay } from "@/components/builder/editor/GenerationOverlay"
import { ShortcutsModal } from "@/components/builder/editor/ShortcutsModal"
import { AgentPanel } from "@/components/builder/editor/AgentPanel"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { useKeyboardShortcuts } from "@/components/builder/hooks/use-keyboard-shortcuts"
import { blockMetadata } from "@/lib/builder/block-metadata"
import { generateSiteConfig } from "@/lib/builder/generate-site"
import { blankTheme } from "@/lib/builder/theme-presets"
import type { BlockConfig, BlockType, SiteConfig } from "@/lib/builder/types"

type LoadState = "loading" | "ready" | "error"
type MobileSheet = "components" | "layers" | "edit" | "agent" | null

export default function SiteBuilder({ projectId, onBack }: { projectId: string; onBack?: () => void }) {
  const config = useConfigStore((s) => s.config)
  const setConfig = useConfigStore((s) => s.setConfig)
  const addBlock = useConfigStore((s) => s.addBlock)
  const previewMode = useEditorStore((s) => s.previewMode)
  const selectBlock = useEditorStore((s) => s.selectBlock)
  const setGenerating = useEditorStore((s) => s.setGenerating)
  const clearGeneration = useEditorStore((s) => s.clearGeneration)
  const setGenerationError = useEditorStore((s) => s.setGenerationError)

  const [loadState, setLoadState] = useState<LoadState>("loading")
  const [projectName, setProjectName] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [showAgent, setShowAgent] = useState(false)
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)
  const [activePaletteType, setActivePaletteType] = useState<BlockType | null>(null)
  const [dndActive, setDndActive] = useState(false)

  const savedRef = useRef<string>("")
  const generationAbort = useRef<AbortController | null>(null)

  useKeyboardShortcuts(loadState === "ready")

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  // ---- Load the project's builder config -------------------------------
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/projects/${projectId}`)
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) throw new Error(data?.message || "Failed to load project")
        setProjectName(data?.businessName || data?.name || "Untitled site")

        const stored = data?.builderConfig as SiteConfig | undefined
        if (stored && (Array.isArray(stored.blocks) || Array.isArray(stored.pages))) {
          setConfig(stored)
          savedRef.current = JSON.stringify(stored)
        } else {
          // Brand-new project: start on a blank #101010 page.
          const blank: SiteConfig = {
            name: data?.businessName || "My site",
            pages: [{ id: "page-home", name: "Home", path: "/", blocks: [] }],
            blocks: [],
            theme: blankTheme,
          }
          setConfig(blank)
          savedRef.current = JSON.stringify(blank)
        }
        setLoadState("ready")
      } catch (err) {
        console.error("[builder] load failed", err)
        if (!cancelled) setLoadState("error")
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // ---- Persist (debounced autosave) ------------------------------------
  const persist = useCallback(
    async (cfg: SiteConfig) => {
      setSaving(true)
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ builderConfig: cfg }),
        })
        if (!res.ok) throw new Error("save failed")
        savedRef.current = JSON.stringify(cfg)
        setDirty(false)
      } catch {
        toast.error("Couldn't save changes")
      } finally {
        setSaving(false)
      }
    },
    [projectId],
  )

  useEffect(() => {
    if (loadState !== "ready") return
    const serialized = JSON.stringify(config)
    if (serialized === savedRef.current) {
      setDirty(false)
      return
    }
    setDirty(true)
    const t = setTimeout(() => persist(config), 1200)
    return () => clearTimeout(t)
  }, [config, loadState, persist])

  // ---- AI full-site generation -----------------------------------------
  const handleGenerateSite = useCallback(
    async (prompt: string) => {
      setMobileSheet(null)
      setGenerating(prompt)
      generationAbort.current?.abort()
      const ac = new AbortController()
      generationAbort.current = ac
      try {
        const { config: generated, source } = await generateSiteConfig(prompt, ac.signal)
        if (ac.signal.aborted) return
        setConfig(generated)
        persist(generated)
        clearGeneration()
        if (source === "template") {
          toast("Generated a starter layout. Configure the AI key for full generation.")
        } else {
          toast("Site generated")
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return
        setGenerationError(err instanceof Error ? err.message : "Generation failed")
        toast.error("Generation failed")
        clearGeneration()
      }
    },
    [setGenerating, setConfig, persist, clearGeneration, setGenerationError],
  )

  // ---- Drag & drop: palette -> canvas insertion ------------------------
  function handleDragStart(event: DragStartEvent) {
    const paletteType = event.active.data.current?.paletteType as BlockType | undefined
    if (paletteType) {
      setActivePaletteType(paletteType)
      setDndActive(true)
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const paletteType = event.active.data.current?.paletteType as BlockType | undefined
    setActivePaletteType(null)
    setDndActive(false)
    if (!paletteType || !event.over) return
    const index = event.over.data.current?.index as number | undefined
    const meta = blockMetadata.find((b) => b.type === paletteType)
    if (!meta) return
    const block: BlockConfig = {
      id: `block-${Date.now()}`,
      type: paletteType,
      variant: meta.variants[0],
      props: { ...meta.defaultProps },
    }
    addBlock(block, typeof index === "number" ? index : undefined)
    selectBlock(block.id)
    toast(`${meta.label} added`)
  }

  if (loadState === "loading") {
    return (
      <div className="h-full w-full flex items-center justify-center bg-background text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading builder…
      </div>
    )
  }

  if (loadState === "error") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-background text-muted-foreground gap-3">
        <p className="text-sm">Couldn&apos;t load this project.</p>
        {onBack && (
          <button onClick={onBack} className="px-3 py-1.5 rounded-lg bg-card border border-border text-foreground text-xs hover:bg-accent transition-colors">
            Go back
          </button>
        )}
      </div>
    )
  }

  const ActiveIcon = activePaletteType ? blockIcons[activePaletteType] : null

  const mobileNav: { key: Exclude<MobileSheet, null>; label: string; icon: typeof Bot }[] = [
    { key: "components", label: "Add", icon: LayoutGrid },
    { key: "layers", label: "Layers", icon: LayersIcon },
    { key: "edit", label: "Edit", icon: SlidersHorizontal },
    { key: "agent", label: "AI", icon: Bot },
  ]

  return (
    <div className="h-full w-full flex flex-col relative bg-background text-foreground">
      <CanvasToolbar projectName={projectName} onBack={onBack} onSave={() => persist(config)} saving={saving} dirty={dirty} />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => { setActivePaletteType(null); setDndActive(false) }}>
        <div className="flex-1 flex overflow-hidden min-h-0">
          {!previewMode && <LeftSidebar />}

          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <Canvas dndActive={dndActive} />
              <JsonDrawer />
              <GenerationOverlay />
            </div>
          </div>

          {!previewMode && (showAgent ? (
            <div className="hidden md:flex w-[320px] bg-card border-l border-border flex-col shrink-0">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Bot size={14} className="text-foreground" /> AI Agent
                </span>
                <button onClick={() => setShowAgent(false)} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors" aria-label="Close agent">
                  <SlidersHorizontal size={14} />
                </button>
              </div>
              <AgentPanel onGenerateSite={handleGenerateSite} />
            </div>
          ) : (
            <RightSidebar />
          ))}
        </div>

        {/* Mobile bottom navigation */}
        {!previewMode && (
          <nav className="md:hidden shrink-0 frosted-header border-t border-border flex items-stretch h-14">
            {mobileNav.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setMobileSheet(key)}
                className="flex-1 flex flex-col items-center justify-center gap-0.5 text-muted-foreground hover:text-foreground active:bg-accent/60 transition-colors"
                aria-label={label}
              >
                <Icon size={18} />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Mobile sheets (rendered inside DndContext so palette hooks have context) */}
        <Sheet open={mobileSheet === "components"} onOpenChange={(o) => !o && setMobileSheet(null)}>
          <SheetContent side="bottom" className="md:hidden h-[80vh] p-0 rounded-t-2xl bg-card flex flex-col gap-0">
            <SheetHeader className="border-b border-border"><SheetTitle className="text-sm">Add Components</SheetTitle></SheetHeader>
            <ComponentsPanel draggable={false} onAdded={() => setMobileSheet(null)} />
          </SheetContent>
        </Sheet>

        <Sheet open={mobileSheet === "layers"} onOpenChange={(o) => !o && setMobileSheet(null)}>
          <SheetContent side="bottom" className="md:hidden h-[80vh] p-0 rounded-t-2xl bg-card flex flex-col gap-0">
            <SheetHeader className="border-b border-border"><SheetTitle className="text-sm">Layers</SheetTitle></SheetHeader>
            <LayersPanel />
          </SheetContent>
        </Sheet>

        <Sheet open={mobileSheet === "edit"} onOpenChange={(o) => !o && setMobileSheet(null)}>
          <SheetContent side="bottom" className="md:hidden h-[80vh] p-0 rounded-t-2xl bg-card flex flex-col gap-0">
            <SheetHeader className="border-b border-border"><SheetTitle className="text-sm">Edit & Design</SheetTitle></SheetHeader>
            <RightSidebarContent />
          </SheetContent>
        </Sheet>

        <Sheet open={mobileSheet === "agent"} onOpenChange={(o) => !o && setMobileSheet(null)}>
          <SheetContent side="bottom" className="md:hidden h-[80vh] p-0 rounded-t-2xl bg-card flex flex-col gap-0">
            <SheetHeader className="border-b border-border"><SheetTitle className="text-sm flex items-center gap-1.5"><Bot size={15} /> AI Agent</SheetTitle></SheetHeader>
            <AgentPanel onGenerateSite={handleGenerateSite} />
          </SheetContent>
        </Sheet>

        <DragOverlay dropAnimation={null}>
          {activePaletteType && ActiveIcon ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold shadow-xl">
              <ActiveIcon size={14} />
              {blockMetadata.find((b) => b.type === activePaletteType)?.label}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <VersionHistory />
      <ShortcutsModal />

      {/* Floating AI agent toggle — desktop only */}
      {!previewMode && !showAgent && (
        <button
          onClick={() => setShowAgent(true)}
          className="hidden md:flex absolute bottom-5 right-5 z-40 h-11 px-4 rounded-full bg-primary text-primary-foreground text-[13px] font-semibold shadow-lg hover:opacity-90 transition-all items-center gap-2 active:scale-95"
        >
          <Bot size={16} />
          AI Agent
        </button>
      )}
    </div>
  )
}
