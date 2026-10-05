"use client"

import React, { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  Cpu,
  Plus,
  RefreshCw,
  Check,
  Search,
  Zap,
  SlidersHorizontal,
  Sparkles,
  Layers,
  Wrench,
  Trash2,
  Edit2,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { BrandLogo, getLobeHubIconKey } from "@/components/sycord-omni-router-modal"

// Vercel AI Gateway top providers catalog for quick selection
const VERCEL_PROVIDERS = [
  { id: "anthropic", name: "Anthropic", defaultModel: "anthropic/claude-3.5-sonnet" },
  { id: "openai", name: "OpenAI", defaultModel: "openai/gpt-4o" },
  { id: "google", name: "Google", defaultModel: "google/gemini-2.5-flash" },
  { id: "deepseek", name: "DeepSeek", defaultModel: "deepseek/deepseek-r1" },
  { id: "meta", name: "Meta Llama", defaultModel: "meta/llama-3.3-70b-instruct" },
  { id: "alibaba", name: "Alibaba Qwen", defaultModel: "alibaba/qwen-2.5-72b-instruct" },
  { id: "mistral", name: "Mistral AI", defaultModel: "mistral/mistral-large" },
  { id: "xai", name: "xAI Grok", defaultModel: "xai/grok-2" },
]

export function AdminModeratorModelSetup() {
  const [configuredModels, setConfiguredModels] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  // Quick Add Model state with smart guessing
  const [selectedProvider, setSelectedProvider] = useState("anthropic")
  const [modelInput, setModelInput] = useState("")
  const [displayNameInput, setDisplayNameInput] = useState("")
  const [isAdding, setIsAdding] = useState(false)

  // Smart guess model ID and human display name on provider or input change
  const handleProviderSelect = (providerId: string) => {
    setSelectedProvider(providerId)
    const prov = VERCEL_PROVIDERS.find((p) => p.id === providerId)
    if (prov && !modelInput) {
      setModelInput(prov.defaultModel)
      smartGuessDisplayName(prov.defaultModel)
    }
  }

  const smartGuessDisplayName = (input: string) => {
    if (!input) return
    let name = input.includes("/") ? input.split("/").slice(1).join("/") : input
    name = name
      .replace(/-a\d+b-it$/i, "")
      .replace(/-it$/i, "")
      .replace(/-instruct$/i, "")
      .replace(/-preview$/i, "")
      .split(/[-_]+/)
      .map((w) => (/^\d+[bB]$/.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1)))
      .join(" ")

    setDisplayNameInput(name)
  }

  const fetchModels = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/ai/models")
      const data = await res.json()
      if (data?.models && Array.isArray(data.models)) {
        setConfiguredModels(data.models)
      } else if (Array.isArray(data)) {
        setConfiguredModels(data)
      }
    } catch {
      toast.error("Failed to load admin model settings")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchModels()
  }, [])

  const handleQuickAddModel = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!modelInput.trim()) {
      toast.error("Please enter a model name or Vercel model ID")
      return
    }

    setIsAdding(true)
    const rawId = modelInput.trim()
    const fullModelId = rawId.includes("/") ? rawId : `${selectedProvider}/${rawId}`
    const displayName = displayNameInput.trim() || fullModelId

    try {
      const res = await fetch("/api/admin/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId: fullModelId,
          displayName,
          enabledInLibrary: true,
          provider: selectedProvider,
        }),
      })

      const data = await res.json()
      if (data.ok || res.ok) {
        toast.success(`Successfully configured model: ${displayName}`)
        setModelInput("")
        setDisplayNameInput("")
        fetchModels()
      } else {
        toast.error(data.error || "Failed to configure model")
      }
    } catch (err: any) {
      toast.error(err?.message || "Failed to connect to admin API")
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggleModelEnabled = async (modelId: string, currentEnabled: boolean) => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modelId,
          enabledInLibrary: !currentEnabled,
        }),
      })
      if (res.ok) {
        toast.success(currentEnabled ? "Model disabled from public Model Browser" : "Model enabled for users")
        setConfiguredModels((prev) =>
          prev.map((m) => (m.id === modelId || m.modelId === modelId ? { ...m, enabledInLibrary: !currentEnabled } : m))
        )
      }
    } catch {
      toast.error("Failed to update model status")
    }
  }

  const handleBulkAction = async (action: "disable_all" | "enable_all") => {
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      if (res.ok) {
        toast.success(action === "disable_all" ? "Disabled all models" : "Enabled all models")
        fetchModels()
      } else {
        toast.error("Bulk action failed")
      }
    } catch {
      toast.error("Failed to perform bulk action")
    }
  }

  const filtered = configuredModels.filter((m) => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (m.name || "").toLowerCase().includes(q) ||
      (m.id || "").toLowerCase().includes(q) ||
      (m.provider || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-base font-bold text-white">
            <Wrench className="w-5 h-5 text-amber-400" />
            <span>Moderator AI Model Setup & Provisioning</span>
          </div>
          <p className="text-xs text-zinc-400">
            Provision and set up Vercel AI Gateway models. Un-configured models will not appear in the user Model Browser.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction("disable_all")}
            className="h-9 text-xs border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 gap-1.5 rounded-xl"
          >
            <span>Disable All</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkAction("enable_all")}
            className="h-9 text-xs border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 gap-1.5 rounded-xl"
          >
            <span>Enable All</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchModels}
            className="h-9 text-xs border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white gap-2 rounded-xl"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Quick Add Model Form with Smart Guessing */}
      <form onSubmit={handleQuickAddModel} className="p-5 rounded-2xl bg-zinc-900/80 border border-amber-500/30 space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            Fast Setup Model (Vercel Provider + Smart Guessing)
          </span>
          <span className="text-[11px] text-zinc-400">Auto-formats ID & Display Name</span>
        </div>

        {/* Step 1: Select Vercel Provider */}
        <div className="space-y-1.5">
          <label className="text-xs text-zinc-400 font-medium">1. Select Provider</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {VERCEL_PROVIDERS.map((p) => {
              const isSelected = selectedProvider === p.id
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleProviderSelect(p.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition-all ${
                    isSelected
                      ? "bg-amber-500/10 border-amber-500 text-amber-300 shadow-xs"
                      : "bg-zinc-900 border-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-800"
                  }`}
                >
                  <BrandLogo brand={p.id} size={18} />
                  <span className="truncate">{p.name}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Step 2: Model Name & Smart Guessing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">2. Model Name or Vercel ID</label>
            <Input
              type="text"
              placeholder="e.g. claude-3.5-sonnet or anthropic/claude-3.5-sonnet"
              value={modelInput}
              onChange={(e) => {
                setModelInput(e.target.value)
                smartGuessDisplayName(e.target.value)
              }}
              className="bg-zinc-950 border-zinc-800 text-xs text-white rounded-xl h-10 placeholder:text-zinc-600"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-zinc-400 font-medium">Smart Guessed Display Name</label>
            <Input
              type="text"
              placeholder="e.g. Claude 3.5 Sonnet"
              value={displayNameInput}
              onChange={(e) => setDisplayNameInput(e.target.value)}
              className="bg-zinc-950 border-zinc-800 text-xs text-white rounded-xl h-10 font-semibold"
            />
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button
            type="submit"
            disabled={isAdding}
            className="h-10 px-5 bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs rounded-xl gap-2 shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{isAdding ? "Provisioning..." : "Setup & Enable Model"}</span>
          </Button>
        </div>
      </form>

      {/* Configured Models Management Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Configured Models Catalog ({filtered.length})</h3>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search configured models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-white placeholder:text-zinc-600 outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2.5">
          {filtered.map((m) => {
            const isEnabled = m.enabledInLibrary ?? true
            return (
              <div
                key={m.id || m.modelId}
                className="p-3.5 rounded-2xl bg-zinc-900/60 border border-zinc-800/80 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BrandLogo brand={m.provider || m.name} size={24} />
                  <div className="min-w-0">
                    <div className="text-xs sm:text-sm font-semibold text-white truncate flex items-center gap-2">
                      <span>{m.name || m.displayName || m.id}</span>
                      <span className="text-[10px] text-zinc-500 font-mono">({m.id})</span>
                    </div>
                    <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                      Provider: <strong className="text-zinc-300">{m.provider || "Vercel AI"}</strong> • Cost: ${m.input_cost ?? 0.5}/1M in
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleModelEnabled(m.id || m.modelId, isEnabled)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      isEnabled
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                        : "bg-zinc-800 text-zinc-500 border border-zinc-700"
                    }`}
                  >
                    {isEnabled ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                    <span>{isEnabled ? "Settled & Active" : "Hidden"}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
