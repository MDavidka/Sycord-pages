"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  Plus, 
  Trash2, 
  Save, 
  RotateCcw, 
  ChevronDown, 
  ChevronRight, 
  Loader2,
  Code,
  FileJson
} from "lucide-react"
import type { CheatSheet, CheatSheetComponent, ComponentProp, ComponentExample } from "@/lib/generator/types"

interface CheatSheetEditorProps {
  onSave?: (cheatSheet: CheatSheet) => void
}

export function CheatSheetEditor({ onSave }: CheatSheetEditorProps) {
  const [cheatSheet, setCheatSheet] = useState<CheatSheet | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [expandedComponents, setExpandedComponents] = useState<Set<string>>(new Set())
  const [jsonMode, setJsonMode] = useState(false)
  const [jsonText, setJsonText] = useState("")
  const [jsonError, setJsonError] = useState<string | null>(null)

  const fetchCheatSheet = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/cheatsheet")
      if (res.ok) {
        const data = await res.json()
        setCheatSheet(data.cheatSheet)
        setJsonText(JSON.stringify(data.cheatSheet, null, 2))
      }
    } catch (err) {
      console.error("Failed to fetch cheatsheet:", err)
      toast.error("Failed to load cheatsheet")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCheatSheet()
  }, [fetchCheatSheet])

  const saveCheatSheet = async () => {
    if (!cheatSheet) return
    
    setSaving(true)
    try {
      const res = await fetch("/api/admin/cheatsheet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cheatSheet }),
      })
      if (res.ok) {
        toast.success("Cheatsheet saved successfully")
        onSave?.(cheatSheet)
      } else {
        toast.error("Failed to save cheatsheet")
      }
    } catch (err) {
      console.error("Failed to save cheatsheet:", err)
      toast.error("Failed to save cheatsheet")
    } finally {
      setSaving(false)
    }
  }

  const toggleComponent = (name: string) => {
    setExpandedComponents(prev => {
      const next = new Set(prev)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

  const updateComponent = (index: number, updates: Partial<CheatSheetComponent>) => {
    if (!cheatSheet) return
    const newComponents = [...cheatSheet.components]
    newComponents[index] = { ...newComponents[index], ...updates }
    setCheatSheet({ ...cheatSheet, components: newComponents })
  }

  const addComponent = () => {
    if (!cheatSheet) return
    const newComponent: CheatSheetComponent = {
      name: "NewComponent",
      importPath: "@/components/ui/new-component",
      description: "New component description",
      props: [],
      examples: [],
      children: "none"
    }
    setCheatSheet({ 
      ...cheatSheet, 
      components: [...cheatSheet.components, newComponent] 
    })
    setExpandedComponents(prev => new Set([...prev, "NewComponent"]))
  }

  const removeComponent = (index: number) => {
    if (!cheatSheet) return
    const newComponents = cheatSheet.components.filter((_, i) => i !== index)
    setCheatSheet({ ...cheatSheet, components: newComponents })
  }

  const addProp = (compIndex: number) => {
    if (!cheatSheet) return
    const newProp: ComponentProp = {
      name: "newProp",
      type: "string",
      required: false,
      description: "Prop description"
    }
    const newComponents = [...cheatSheet.components]
    newComponents[compIndex].props = [...newComponents[compIndex].props, newProp]
    setCheatSheet({ ...cheatSheet, components: newComponents })
  }

  const updateProp = (compIndex: number, propIndex: number, updates: Partial<ComponentProp>) => {
    if (!cheatSheet) return
    const newComponents = [...cheatSheet.components]
    newComponents[compIndex].props[propIndex] = { 
      ...newComponents[compIndex].props[propIndex], 
      ...updates 
    }
    setCheatSheet({ ...cheatSheet, components: newComponents })
  }

  const removeProp = (compIndex: number, propIndex: number) => {
    if (!cheatSheet) return
    const newComponents = [...cheatSheet.components]
    newComponents[compIndex].props = newComponents[compIndex].props.filter((_, i) => i !== propIndex)
    setCheatSheet({ ...cheatSheet, components: newComponents })
  }

  const addExample = (compIndex: number) => {
    if (!cheatSheet) return
    const newExample: ComponentExample = {
      name: "Example",
      code: "<Component />"
    }
    const newComponents = [...cheatSheet.components]
    newComponents[compIndex].examples = [...newComponents[compIndex].examples, newExample]
    setCheatSheet({ ...cheatSheet, components: newComponents })
  }

  const updateExample = (compIndex: number, exIndex: number, updates: Partial<ComponentExample>) => {
    if (!cheatSheet) return
    const newComponents = [...cheatSheet.components]
    newComponents[compIndex].examples[exIndex] = {
      ...newComponents[compIndex].examples[exIndex],
      ...updates
    }
    setCheatSheet({ ...cheatSheet, components: newComponents })
  }

  const removeExample = (compIndex: number, exIndex: number) => {
    if (!cheatSheet) return
    const newComponents = [...cheatSheet.components]
    newComponents[compIndex].examples = newComponents[compIndex].examples.filter((_, i) => i !== exIndex)
    setCheatSheet({ ...cheatSheet, components: newComponents })
  }

  const handleJsonChange = (value: string) => {
    setJsonText(value)
    setJsonError(null)
    try {
      const parsed = JSON.parse(value)
      if (parsed.components && Array.isArray(parsed.components)) {
        setCheatSheet(parsed)
      } else {
        setJsonError("Invalid cheatsheet format: missing components array")
      }
    } catch {
      setJsonError("Invalid JSON syntax")
    }
  }

  const syncJsonFromState = () => {
    if (cheatSheet) {
      setJsonText(JSON.stringify(cheatSheet, null, 2))
      setJsonError(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    )
  }

  if (!cheatSheet) {
    return (
      <div className="text-center py-12 text-white/40">
        Failed to load cheatsheet
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Component Cheatsheet</h3>
          <p className="text-sm text-white/40">
            {cheatSheet.components.length} components | v{cheatSheet.version}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!jsonMode) syncJsonFromState()
              setJsonMode(!jsonMode)
            }}
            className="gap-2 bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
          >
            {jsonMode ? <Code className="h-4 w-4" /> : <FileJson className="h-4 w-4" />}
            {jsonMode ? "Visual" : "JSON"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchCheatSheet}
            className="gap-2 bg-white/5 border-white/10 text-white/70 hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={saveCheatSheet}
            disabled={saving || (jsonMode && !!jsonError)}
            className="gap-2 bg-white text-black hover:bg-white/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </div>

      {jsonMode ? (
        /* JSON Editor Mode */
        <div className="space-y-2">
          {jsonError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {jsonError}
            </div>
          )}
          <Textarea
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="min-h-[600px] font-mono text-sm bg-[#0a0a0a] border-white/10 text-white/90"
            placeholder="Paste cheatsheet JSON here..."
          />
        </div>
      ) : (
        /* Visual Editor Mode */
        <div className="space-y-3">
          {cheatSheet.components.map((comp, compIndex) => (
            <div
              key={compIndex}
              className="rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden"
            >
              {/* Component Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/[0.02]"
                onClick={() => toggleComponent(comp.name)}
              >
                <div className="flex items-center gap-3">
                  {expandedComponents.has(comp.name) ? (
                    <ChevronDown className="h-4 w-4 text-white/40" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-white/40" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{comp.name}</span>
                      <Badge variant="outline" className="text-[10px] bg-white/5 text-white/50 border-white/10">
                        {comp.props.length} props
                      </Badge>
                    </div>
                    <p className="text-xs text-white/40 mt-0.5">{comp.importPath}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    removeComponent(compIndex)
                  }}
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {/* Component Details */}
              {expandedComponents.has(comp.name) && (
                <div className="border-t border-white/[0.06] p-4 space-y-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Name</label>
                      <Input
                        value={comp.name}
                        onChange={(e) => updateComponent(compIndex, { name: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-white/40 mb-1 block">Import Path</label>
                      <Input
                        value={comp.importPath}
                        onChange={(e) => updateComponent(compIndex, { importPath: e.target.value })}
                        className="bg-white/5 border-white/10 text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Description</label>
                    <Input
                      value={comp.description}
                      onChange={(e) => updateComponent(compIndex, { description: e.target.value })}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 mb-1 block">Children Type</label>
                    <select
                      value={comp.children || "none"}
                      onChange={(e) => updateComponent(compIndex, { children: e.target.value })}
                      className="w-full bg-white/5 border border-white/10 text-white rounded-md px-3 py-2 text-sm"
                    >
                      <option value="none">None</option>
                      <option value="text">Text</option>
                      <option value="components">Components</option>
                    </select>
                  </div>

                  {/* Props */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/40">Props</label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addProp(compIndex)}
                        className="h-7 text-xs text-white/60 hover:text-white"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Prop
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {comp.props.map((prop, propIndex) => (
                        <div key={propIndex} className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-2">
                            <Input
                              value={prop.name}
                              onChange={(e) => updateProp(compIndex, propIndex, { name: e.target.value })}
                              placeholder="name"
                              className="bg-white/5 border-white/10 text-white text-xs h-8"
                            />
                            <Input
                              value={prop.type}
                              onChange={(e) => updateProp(compIndex, propIndex, { type: e.target.value })}
                              placeholder="type"
                              className="bg-white/5 border-white/10 text-white text-xs h-8"
                            />
                            <Input
                              value={prop.description}
                              onChange={(e) => updateProp(compIndex, propIndex, { description: e.target.value })}
                              placeholder="description"
                              className="bg-white/5 border-white/10 text-white text-xs h-8 md:col-span-2"
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1 text-xs text-white/40">
                              <input
                                type="checkbox"
                                checked={prop.required}
                                onChange={(e) => updateProp(compIndex, propIndex, { required: e.target.checked })}
                                className="rounded"
                              />
                              Req
                            </label>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeProp(compIndex, propIndex)}
                              className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Examples */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs text-white/40">Examples</label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => addExample(compIndex)}
                        className="h-7 text-xs text-white/60 hover:text-white"
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Example
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {comp.examples.map((ex, exIndex) => (
                        <div key={exIndex} className="flex items-start gap-2 p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                          <div className="flex-1 space-y-2">
                            <Input
                              value={ex.name}
                              onChange={(e) => updateExample(compIndex, exIndex, { name: e.target.value })}
                              placeholder="Example name"
                              className="bg-white/5 border-white/10 text-white text-xs h-8"
                            />
                            <Textarea
                              value={ex.code}
                              onChange={(e) => updateExample(compIndex, exIndex, { code: e.target.value })}
                              placeholder="<Component />"
                              className="bg-white/5 border-white/10 text-white text-xs font-mono min-h-[60px]"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeExample(compIndex, exIndex)}
                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add Component Button */}
          <Button
            variant="outline"
            onClick={addComponent}
            className="w-full gap-2 bg-white/[0.02] border-white/10 border-dashed text-white/40 hover:text-white hover:bg-white/5"
          >
            <Plus className="h-4 w-4" />
            Add Component
          </Button>
        </div>
      )}
    </div>
  )
}
