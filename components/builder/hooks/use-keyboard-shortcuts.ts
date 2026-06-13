"use client"

import { useEffect } from "react"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { useConfigStore } from "@/components/builder/store/config-store"

/** Editor keyboard shortcuts (J/H/P/Esc/? + undo/redo). No router navigation. */
export function useKeyboardShortcuts(enabled = true) {
  const { toggleJsonDrawer, toggleHistory, toggleShortcutsModal, togglePreview, selectBlock } = useEditorStore()
  const { undo, redo } = useConfigStore()

  useEffect(() => {
    if (!enabled) return
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return

      if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key === "?") {
        e.preventDefault()
        toggleShortcutsModal()
        return
      }

      if (!e.metaKey && !e.ctrlKey) {
        switch (e.key) {
          case "j": case "J": e.preventDefault(); toggleJsonDrawer(); return
          case "h": case "H": e.preventDefault(); toggleHistory(); return
          case "p": case "P": e.preventDefault(); togglePreview(); return
          case "Escape": e.preventDefault(); selectBlock(null); return
        }
      }

      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [enabled, toggleJsonDrawer, toggleHistory, toggleShortcutsModal, togglePreview, selectBlock, undo, redo])
}
