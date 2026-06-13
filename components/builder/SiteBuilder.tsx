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
import { Bot, Loader2, X } from "lucide-react"
import { CanvasToolbar } from "@/components/builder/editor/CanvasToolbar"
import { LeftSidebar, blockIcons } from "@/components/builder/editor/LeftSidebar"
import { Canvas } from "@/components/builder/editor/Canvas"
import { RightSidebar } from "@/components/builder/editor/RightSidebar"
import { JsonDrawer } from "@/components/builder/editor/JsonDrawer"
import { VersionHistory } from "@/components/builder/editor/VersionHistory"
import { GenerationOverlay } from "@/components/builder/editor/GenerationOverlay"
import { ShortcutsModal } from "@/components/builder/editor/ShortcutsModal"
import { AgentPanel } from "@/components/builder/editor/AgentPanel"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { useKeyboardShortcuts } from "@/components/builder/hooks/use-keyboard-shortcuts"
import { blockMetadata } from "@/lib/builder/block-metadata"
import { generateSiteConfig, getStarterTemplate } from "@/lib/builder/generate-site"
import type { BlockConfig, BlockType, SiteConfig } from "@/lib/builder/types"

type LoadState = "loading" | "ready" | "error"

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
          const starter = getStarterTemplate(data?.businessName || "")
          setConfig(starter)
          savedRef.current = JSON.stringify(starter)
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
      <div className="h-full w-full flex items-center justify-center bg-bg-0 text-text-2">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading builder…
      </div>
    )
  }

  if (loadState === "error") {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center bg-bg-0 text-text-2 gap-3">
        <p className="text-sm">Couldn&apos;t load this project.</p>
        {onBack && (
          <button onClick={onBack} className="px-3 py-1.5 rounded-lg bg-bg-2 border border-border-default text-text-1 text-xs hover:bg-bg-3">
            Go back
          </button>
        )}
      </div>
    )
  }

  const ActiveIcon = activePaletteType ? blockIcons[activePaletteType] : null

  return (
    <div className="h-full w-full flex flex-col relative bg-bg-0 text-text-0">
      <CanvasToolbar projectName={projectName} onBack={onBack} onSave={() => persist(config)} saving={saving} dirty={dirty} />

      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => { setActivePaletteType(null); setDndActive(false) }}>
        <div className="flex-1 flex overflow-hidden">
          {!previewMode && <LeftSidebar />}

          <div className="flex-1 flex flex-col min-w-0 relative">
            <div className="flex-1 flex flex-col overflow-hidden relative">
              <Canvas dndActive={dndActive} />
              <JsonDrawer />
              <GenerationOverlay />
            </div>
          </div>

          {!previewMode && (showAgent ? (
            <div className="hidden md:flex w-[320px] bg-bg-1 border-l border-border-default flex-col shrink-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-text-2 flex items-center gap-1.5">
                  <Bot size={13} className="text-green" /> AI Agent
                </span>
                <button onClick={() => setShowAgent(false)} className="w-6 h-6 rounded flex items-center justify-center text-text-3 hover:text-text-0 hover:bg-bg-3 transition-colors" aria-label="Close agent">
                  <X size={13} />
                </button>
              </div>
              <AgentPanel onGenerateSite={handleGenerateSite} />
            </div>
          ) : (
            <RightSidebar />
          ))}
        </div>

        <DragOverlay dropAnimation={null}>
          {activePaletteType && ActiveIcon ? (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green text-black text-[12px] font-semibold shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
              <ActiveIcon size={14} />
              {blockMetadata.find((b) => b.type === activePaletteType)?.label}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <VersionHistory />
      <ShortcutsModal />

      {/* Floating AI agent toggle */}
      {!previewMode && !showAgent && (
        <button
          onClick={() => setShowAgent(true)}
          className="absolute bottom-5 right-5 z-40 h-11 px-4 rounded-full bg-green text-black text-[13px] font-semibold shadow-[0_8px_24px_rgba(34,197,94,0.4)] hover:bg-green-dim transition-all flex items-center gap-2 active:scale-95"
        >
          <Bot size={16} />
          AI Agent
        </button>
      )}
    </div>
  )
}
