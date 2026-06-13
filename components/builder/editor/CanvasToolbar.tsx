"use client"

import { useState, useRef, useEffect } from "react"
import { Monitor, Tablet, Smartphone, Undo2, Redo2, Code, Clock, Eye, Plus, HelpCircle, Download, ArrowLeft, Save, Loader2, Rocket } from "lucide-react"
import { toast } from "sonner"
import { useEditorStore, type Viewport } from "@/components/builder/store/editor-store"
import { useConfigStore } from "@/components/builder/store/config-store"
import { buildPageHtml } from "@/lib/builder/export-html"
import type { PageConfig } from "@/lib/builder/types"

const viewports: { value: Viewport; icon: typeof Monitor; label: string }[] = [
  { value: "desktop", icon: Monitor, label: "Desktop" },
  { value: "tablet", icon: Tablet, label: "Tablet" },
  { value: "mobile", icon: Smartphone, label: "Mobile" },
]

function AddPagePopover({ onAdd, onClose }: { onAdd: (name: string, path: string) => void; onClose: () => void }) {
  const [name, setName] = useState("")
  const [path, setPath] = useState("/")
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  function submit() {
    const trimmed = name.trim()
    if (!trimmed) return
    const cleanPath = path.trim() || `/${trimmed.toLowerCase().replace(/\s+/g, "-")}`
    onAdd(trimmed, cleanPath)
    onClose()
  }

  return (
    <div className="absolute top-full left-0 mt-1 frosted-glass rounded-xl p-2.5 shadow-xl z-20 w-56">
      <div className="space-y-2">
        <div>
          <label className="block text-[10.5px] text-muted-foreground mb-0.5">Page name</label>
          <input ref={inputRef} value={name} onChange={(e) => { setName(e.target.value); if (!path || path === "/") setPath(`/${e.target.value.toLowerCase().replace(/\s+/g, "-")}`) }} onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose() }} placeholder="About" className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[12.5px] outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <div>
          <label className="block text-[10.5px] text-muted-foreground mb-0.5">Path</label>
          <input value={path} onChange={(e) => setPath(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submit(); if (e.key === "Escape") onClose() }} placeholder="/about" className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-[12.5px] outline-none focus:ring-1 focus:ring-ring font-mono" />
        </div>
        <button onClick={submit} disabled={!name.trim()} className="w-full py-1.5 rounded-lg bg-primary text-primary-foreground text-[12px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed">Add Page</button>
      </div>
    </div>
  )
}

function PageTab({ page, isActive, onClick, onRename, onDelete, canDelete }: {
  page: PageConfig
  isActive: boolean
  onClick: () => void
  onRename: (name: string) => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(page.name)
  const [showContext, setShowContext] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])

  function commitRename() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== page.name) onRename(trimmed)
    else setName(page.name)
    setEditing(false)
  }

  if (editing) {
    return (
      <input ref={inputRef} value={name} onChange={(e) => setName(e.target.value)} onBlur={commitRename} onKeyDown={(e) => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") { setName(page.name); setEditing(false) } }} className="px-2 py-1 rounded-md text-xs bg-background border border-ring outline-none w-20" onClick={(e) => e.stopPropagation()} />
    )
  }

  return (
    <div className="relative">
      <button onClick={onClick} onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }} onContextMenu={(e) => { e.preventDefault(); setShowContext(true) }} className={`px-2.5 py-1 rounded-md text-xs whitespace-nowrap transition-all ${isActive ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent/60"}`} title={`${page.name} (${page.path})`}>
        {page.name}
      </button>
      {showContext && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setShowContext(false)} />
          <div className="absolute top-full left-0 mt-1 frosted-glass rounded-xl p-1 shadow-xl z-20 min-w-[110px]">
            <button onClick={() => { setShowContext(false); setEditing(true) }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">Rename</button>
            {canDelete && (
              <button onClick={() => { setShowContext(false); onDelete() }} className="w-full text-left px-2.5 py-1.5 rounded-lg text-[12px] text-muted-foreground hover:bg-destructive/15 hover:text-destructive transition-colors">Delete</button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

interface CanvasToolbarProps {
  projectName?: string
  onBack?: () => void
  onSave?: () => void
  saving?: boolean
  dirty?: boolean
  onPublish?: () => void
  publishing?: boolean
}

export function CanvasToolbar({ projectName, onBack, onSave, saving, dirty, onPublish, publishing }: CanvasToolbarProps) {
  const { viewport, setViewport, toggleJsonDrawer, jsonDrawerOpen, toggleHistory, togglePreview, toggleShortcutsModal, previewMode } = useEditorStore()
  const { undo, redo, canUndo, canRedo } = useConfigStore()
  const undoStack = useConfigStore((s) => s.undoStack)
  const redoStack = useConfigStore((s) => s.redoStack)
  const pages = useConfigStore((s) => s.config.pages) ?? []
  const activePageId = useConfigStore((s) => s.activePageId)
  const setActivePage = useConfigStore((s) => s.setActivePage)
  const addPage = useConfigStore((s) => s.addPage)
  const removePage = useConfigStore((s) => s.removePage)
  const renamePage = useConfigStore((s) => s.renamePage)
  const configName = useConfigStore((s) => s.config.name)
  const config = useConfigStore((s) => s.config)
  const [showAddPage, setShowAddPage] = useState(false)

  async function handleExport() {
    try {
      const page = pages.find((p) => p.id === activePageId) ?? pages[0]
      const html = await buildPageHtml({
        siteName: projectName || config.name || "site",
        pageName: page?.name || "Home",
        blocks: page?.blocks || config.blocks,
        theme: config.theme,
      })
      const blob = new Blob([html], { type: "text/html" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${(page?.name || "index").toLowerCase().replace(/\s+/g, "-")}.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast("Deployable HTML exported")
    } catch {
      toast.error("Export failed")
    }
  }

  const iconBtn = "w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all"

  return (
    <div className="h-12 frosted-header flex items-center px-2 sm:px-3 gap-1 shrink-0">
      <div className="flex items-center gap-1.5 text-xs shrink-0">
        {onBack && (
          <button onClick={onBack} className={iconBtn} title="Back" aria-label="Back">
            <ArrowLeft size={15} />
          </button>
        )}
        <span className="text-foreground font-medium max-w-[100px] sm:max-w-[160px] truncate">{projectName || configName}</span>
      </div>

      <div className="w-px h-5 bg-border mx-1 sm:mx-1.5 shrink-0 hidden sm:block" />

      {/* Page tabs */}
      <div className="flex items-center gap-0.5 relative overflow-x-auto scrollbar-hide max-w-[28vw] sm:max-w-none">
        {pages.map((page) => (
          <PageTab key={page.id} page={page} isActive={activePageId === page.id} onClick={() => setActivePage(page.id)} onRename={(name) => renamePage(page.id, name)} onDelete={() => removePage(page.id)} canDelete={pages.length > 1} />
        ))}
        <div className="relative">
          <button onClick={() => setShowAddPage(!showAddPage)} className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-all" title="Add page" aria-label="Add page">
            <Plus size={13} />
          </button>
          {showAddPage && <AddPagePopover onAdd={(name, path) => addPage(name, path)} onClose={() => setShowAddPage(false)} />}
        </div>
      </div>

      <div className="ml-auto flex items-center gap-0.5 sm:gap-1 shrink-0">
        {/* Viewport toggle — desktop only */}
        <div className="hidden lg:flex items-center gap-0.5 bg-muted/40 rounded-lg p-0.5">
          {viewports.map(({ value, icon: Icon, label }) => (
            <button key={value} title={label} aria-label={label} aria-pressed={viewport === value} onClick={() => setViewport(value)} className={`w-7 h-7 rounded-md flex items-center justify-center text-xs transition-all ${viewport === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <Icon size={14} />
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-border mx-0.5 sm:mx-1 hidden sm:block" />

        <button onClick={() => { const label = undoStack[undoStack.length - 1]?.label; undo(); if (label) toast(`Undo: ${label}`, { duration: 1500 }) }} disabled={!canUndo()} className={`${iconBtn} disabled:opacity-30 disabled:cursor-not-allowed`} title="Undo" aria-label="Undo">
          <Undo2 size={15} />
        </button>
        <button onClick={() => { const label = redoStack[redoStack.length - 1]?.label; redo(); if (label) toast(`Redo: ${label}`, { duration: 1500 }) }} disabled={!canRedo()} className={`${iconBtn} disabled:opacity-30 disabled:cursor-not-allowed`} title="Redo" aria-label="Redo">
          <Redo2 size={15} />
        </button>

        <div className="w-px h-5 bg-border mx-0.5 sm:mx-1" />

        <button onClick={togglePreview} className={`h-8 px-2 rounded-lg flex items-center gap-1 text-[11.5px] transition-all ${previewMode ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`} title="Preview (P)" aria-label="Toggle preview mode" aria-pressed={previewMode}>
          <Eye size={14} />
          <span className="hidden xl:inline">Preview</span>
        </button>

        <button onClick={toggleJsonDrawer} className={`hidden sm:flex h-8 px-2 rounded-lg items-center gap-1 text-[11.5px] transition-all ${jsonDrawerOpen ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-accent"}`} title="JSON (J)" aria-label="Toggle JSON drawer" aria-pressed={jsonDrawerOpen}>
          <Code size={14} />
          <span className="hidden xl:inline">JSON</span>
        </button>

        <button onClick={toggleHistory} className={`${iconBtn} hidden sm:flex`} title="History (H)" aria-label="Toggle version history">
          <Clock size={15} />
        </button>

        <button onClick={toggleShortcutsModal} className={`${iconBtn} hidden lg:flex`} title="Keyboard shortcuts (?)" aria-label="Show keyboard shortcuts">
          <HelpCircle size={15} />
        </button>

        <button onClick={handleExport} className={`${iconBtn} hidden sm:flex`} title="Download deployable HTML" aria-label="Download deployable HTML">
          <Download size={15} />
        </button>

        {onPublish && (
          <button onClick={onPublish} disabled={publishing} className="h-8 px-2.5 rounded-lg text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5" title="Save deployable pages to the Pages tab" aria-label="Publish to Pages">
            {publishing ? <Loader2 size={14} className="animate-spin" /> : <Rocket size={14} />}
            <span className="hidden lg:inline">Publish</span>
          </button>
        )}

        {onSave && (
          <button onClick={onSave} disabled={saving} className="h-8 px-2.5 sm:px-3 ml-0.5 rounded-lg bg-primary text-primary-foreground text-[11.5px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            <span className="hidden sm:inline">{saving ? "Saving..." : dirty ? "Save" : "Saved"}</span>
          </button>
        )}
      </div>
    </div>
  )
}
