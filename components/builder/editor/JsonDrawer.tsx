"use client"

import { useState } from "react"
import { toast } from "sonner"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function syntaxHighlight(json: string): string {
  const escaped = escapeHtml(json)
  return escaped.replace(
    /(&quot;(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\&])*?&quot;(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
    (match) => {
      let cls = "text-amber-400"
      if (/^&quot;/.test(match)) {
        if (/:$/.test(match)) {
          cls = "text-sky-300"
          match = match.replace(/:$/, "")
          return `<span class="${cls}">${match}</span>:`
        } else {
          cls = "text-emerald-400"
        }
      } else if (/true|false/.test(match)) {
        cls = "text-blue-400"
      } else if (/null/.test(match)) {
        cls = "text-muted-foreground"
      }
      return `<span class="${cls}">${match}</span>`
    },
  )
}

export function JsonDrawer() {
  const config = useConfigStore((s) => s.config)
  const setConfig = useConfigStore((s) => s.setConfig)
  const { jsonDrawerOpen, toggleJsonDrawer } = useEditorStore()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState("")
  const [error, setError] = useState<string | null>(null)

  const jsonStr = JSON.stringify(config, null, 2)
  const highlighted = syntaxHighlight(jsonStr)

  function startEditing() {
    setEditValue(jsonStr)
    setError(null)
    setEditing(true)
  }

  function applyEdit() {
    try {
      const parsed = JSON.parse(editValue)
      if (!parsed.name || (!Array.isArray(parsed.blocks) && !Array.isArray(parsed.pages))) {
        setError('Invalid config: must have "name" and "blocks" or "pages" array')
        return
      }
      setConfig(parsed)
      setEditing(false)
      setError(null)
      toast("Config updated from JSON")
    } catch (e) {
      setError((e as Error).message)
    }
  }

  function cancelEdit() {
    setEditing(false)
    setError(null)
  }

  return (
    <div className={`bg-card flex flex-col overflow-hidden transition-all duration-300 ease-in-out ${jsonDrawerOpen ? "border-t border-border" : ""}`} style={{ height: jsonDrawerOpen ? "220px" : "0px" }}>
      <div className="h-9 min-h-9 bg-muted/30 border-b border-border flex items-center px-3 text-[11.5px] text-muted-foreground gap-2 cursor-pointer select-none hover:bg-accent/50 transition-colors" onClick={toggleJsonDrawer}>
        <span className="font-mono text-foreground/70">{"{ }"}</span>
        <span>Site Config</span>
        <div className="ml-auto flex items-center gap-3">
          {!editing && (
            <button onClick={(e) => { e.stopPropagation(); startEditing() }} className="text-[10.5px] text-muted-foreground hover:text-foreground transition-colors">Edit</button>
          )}
          {editing && (
            <>
              <button onClick={(e) => { e.stopPropagation(); applyEdit() }} className="text-[10.5px] text-foreground hover:opacity-80 transition-opacity font-medium">Apply</button>
              <button onClick={(e) => { e.stopPropagation(); cancelEdit() }} className="text-[10.5px] text-muted-foreground hover:text-destructive transition-colors">Cancel</button>
            </>
          )}
          <div className="flex items-center gap-1 text-[10.5px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Live
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar px-3.5 py-2.5 font-mono text-[11.5px] leading-relaxed text-foreground/80">
        {editing ? (
          <div className="h-full flex flex-col">
            <textarea value={editValue} onChange={(e) => { setEditValue(e.target.value); setError(null) }} className="flex-1 w-full bg-transparent text-foreground/80 outline-none resize-none font-mono text-[11.5px] leading-relaxed" spellCheck={false} />
            {error && <div className="text-destructive text-[10.5px] mt-1 py-1">{error}</div>}
          </div>
        ) : (
          <pre dangerouslySetInnerHTML={{ __html: highlighted }} />
        )}
      </div>
    </div>
  )
}
