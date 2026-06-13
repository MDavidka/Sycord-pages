"use client"

import { useEffect, useRef } from "react"
import { X, Clock, RotateCcw } from "lucide-react"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { useConfigStore } from "@/components/builder/store/config-store"

function timeAgo(ts: number): string {
  const seconds = Math.floor((Date.now() - ts) / 1000)
  if (seconds < 10) return "Just now"
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function VersionHistory() {
  const { historyOpen, toggleHistory } = useEditorStore()
  const undoStack = useConfigStore((s) => s.undoStack)
  const panelRef = useRef<HTMLDivElement>(null)

  const entries = [...undoStack].reverse()

  useEffect(() => {
    if (!historyOpen) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); toggleHistory() }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [historyOpen, toggleHistory])

  useEffect(() => {
    if (!historyOpen) return
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) toggleHistory()
    }
    const id = setTimeout(() => window.addEventListener("mousedown", handleClick), 0)
    return () => { clearTimeout(id); window.removeEventListener("mousedown", handleClick) }
  }, [historyOpen, toggleHistory])

  return (
    <div ref={panelRef} className={`absolute top-0 right-0 bottom-0 w-80 max-w-[88vw] bg-card border-l border-border z-50 flex flex-col transition-transform duration-300 ease-in-out ${historyOpen ? "translate-x-0" : "translate-x-full"}`}>
      <div className="px-4 py-3.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={15} className="text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Version History</h3>
          <span className="text-[10.5px] text-muted-foreground/60">({entries.length})</span>
        </div>
        <button onClick={toggleHistory} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        <div className="p-3 rounded-xl bg-accent mb-0.5">
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
            <span>Current</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-primary/15 text-foreground">latest</span>
          </div>
          <div className="text-[12.5px] text-foreground/90">Current state</div>
        </div>

        {entries.map((entry, i) => (
          <div key={i} onClick={() => { for (let n = 0; n <= i; n++) useConfigStore.getState().undo() }} className="p-3 rounded-xl cursor-pointer transition-colors mb-0.5 hover:bg-accent/60 group">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mb-1">
              <span>{timeAgo(entry.timestamp)}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-muted text-muted-foreground">manual</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-[12.5px] text-foreground/90">{entry.label}</div>
              <RotateCcw size={12} className="text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}

        {entries.length === 0 && <div className="p-4 text-center text-[11.5px] text-muted-foreground">No history yet. Make some changes to see history.</div>}
      </div>
    </div>
  )
}
