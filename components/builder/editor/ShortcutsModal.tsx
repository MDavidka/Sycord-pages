"use client"

import { useRef, useEffect, useCallback } from "react"
import { X } from "lucide-react"
import { useEditorStore } from "@/components/builder/store/editor-store"

const shortcutGroups = [
  {
    title: "Editor",
    shortcuts: [
      { keys: ["J"], description: "Toggle JSON drawer" },
      { keys: ["H"], description: "Toggle version history" },
      { keys: ["P"], description: "Toggle preview mode" },
      { keys: ["Esc"], description: "Deselect block" },
      { keys: ["?"], description: "Show this help" },
    ],
  },
  {
    title: "Actions",
    shortcuts: [
      { keys: ["\u2318", "Z"], description: "Undo" },
      { keys: ["\u2318", "\u21E7", "Z"], description: "Redo" },
    ],
  },
]

export function ShortcutsModal() {
  const { shortcutsModalOpen, toggleShortcutsModal } = useEditorStore()
  const modalRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!shortcutsModalOpen) return
    closeRef.current?.focus()
  }, [shortcutsModalOpen])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        toggleShortcutsModal()
        return
      }
      if (e.key !== "Tab") return
      const modal = modalRef.current
      if (!modal) return
      const focusable = modal.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [toggleShortcutsModal],
  )

  if (!shortcutsModalOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={toggleShortcutsModal} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onKeyDown={handleKeyDown}>
      <div ref={modalRef} className="bg-bg-1 border border-border-default rounded-xl w-[420px] max-h-[80vh] overflow-hidden shadow-[0_16px_48px_rgba(0,0,0,0.5)]" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-border-default flex items-center justify-between">
          <h2 className="text-sm font-semibold">Keyboard Shortcuts</h2>
          <button ref={closeRef} onClick={toggleShortcutsModal} className="w-7 h-7 rounded flex items-center justify-center text-text-3 hover:text-text-0 hover:bg-bg-3 transition-colors" aria-label="Close shortcuts">
            <X size={14} />
          </button>
        </div>
        <div className="p-5 space-y-5 overflow-y-auto">
          {shortcutGroups.map((group) => (
            <div key={group.title}>
              <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-3 mb-2">{group.title}</h3>
              <div className="space-y-1.5">
                {group.shortcuts.map((shortcut) => (
                  <div key={shortcut.description} className="flex items-center justify-between">
                    <span className="text-[12.5px] text-text-1">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, i) => (
                        <kbd key={i} className="min-w-[24px] h-6 px-1.5 rounded border border-border-default bg-bg-3 text-[11px] font-mono text-text-2 flex items-center justify-center">{key}</kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
