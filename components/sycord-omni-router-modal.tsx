"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Search,
  Check,
  Sparkles,
  Zap,
  Award,
  Layers,
  Eye,
  Wrench,
  Database,
  Coins,
  Cpu,
  Plus,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Shield,
  Clock,
  Code2,
  Sliders,
  X,
  ArrowUpRight,
  TrendingUp,
} from "lucide-react"
import { SvglIcon } from "@/components/ai-omni-manager"

export interface OmniModelItem {
  id: string
  name: string
  provider: string
  swe_bench_score?: number
  swe_score?: number
  input_cost?: number
  output_cost?: number
  context_window?: number
  latency_tier?: string
  supports_vision?: boolean
  supports_tools?: boolean
  supports_cache?: boolean
  supports_reasoning?: boolean
  description?: string
  is_active?: boolean
  is_frontier?: boolean
}

export interface SycordOmniRouterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedModel?: string
  onSelectModel?: (modelId: string, modelObj?: OmniModelItem) => void
  projectId?: string
  isDark?: boolean
}

export function SycordOmniRouterModal({
  open,
  onOpenChange,
  selectedModel,
  onSelectModel,
  projectId = "global",
  isDark = true,
}: SycordOmniRouterModalProps) {
  const [models, setModels] = useState<OmniModelItem[]>([])
  const [topSweModels, setTopSweModels] = useState<OmniModelItem[]>([])
  const [activeModelId, setActiveModelId] = useState<string>(selectedModel || "")
  const [userCredits, setUserCredits] = useState<number>(5.0)
  const [creditsDetails, setCreditsDetails] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [selectingModelId, setSelectingModelId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTag, setFilterTag] = useState<string>("all")
  const [profileModel, setProfileModel] = useState<OmniModelItem | null>(null)
  const [showCreditsModal, setShowCreditsModal] = useState(false)

  // Fetch Omni Router models catalog & User credit metering
  const fetchCatalogAndCredits = async () => {
    setLoading(true)
    try {
      const [omniRes, credsRes] = await Promise.all([
        fetch(`/api/ai/omni?project_id=${encodeURIComponent(projectId)}`).then((r) => r.json()).catch(() => null),
        fetch(`/api/user/credits`).then((r) => r.json()).catch(() => null),
      ])

      if (omniRes?.models && Array.isArray(omniRes.models)) {
        setModels(omniRes.models)
        if (omniRes.active_model) {
          setActiveModelId(omniRes.active_model)
        }
      }
      if (omniRes?.top_swe_models && Array.isArray(omniRes.top_swe_models)) {
        setTopSweModels(omniRes.top_swe_models)
      }

      if (credsRes?.ok && typeof credsRes?.balance_usd === "number") {
        setUserCredits(credsRes.balance_usd)
        setCreditsDetails(credsRes)
      } else if (typeof credsRes?.credits === "number") {
        setUserCredits(credsRes.credits)
      }
    } catch (err: any) {
      console.error("[SycordOmniRouterModal] Failed to load catalog:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      void fetchCatalogAndCredits()
      if (selectedModel) {
        setActiveModelId(selectedModel)
      }
    }
  }, [open, selectedModel, projectId])

  // Handle Model 1-Click Activation via Sycord Omni Route
  const handleSelectModel = async (model: OmniModelItem) => {
    setSelectingModelId(model.id)
    try {
      const res = await fetch("/api/ai/omni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model_id: model.id,
          project_id: projectId,
          provider: model.provider,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.ok) {
        setActiveModelId(model.id)
        toast.success(`Active model updated to ${model.name || model.id}`)
        onSelectModel?.(model.id, model)
        onOpenChange(false)
      } else {
        // Fallback: still notify parent if VM endpoint soft-failed
        setActiveModelId(model.id)
        toast.success(`Selected ${model.name || model.id}`)
        onSelectModel?.(model.id, model)
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error(`Selection failed: ${err.message}`)
    } finally {
      setSelectingModelId(null)
    }
  }

  // Filter and search logic
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        m.provider.toLowerCase().includes(q)

      if (!matchesSearch) return false

      if (filterTag === "all") return true
      if (filterTag === "top") return (m.swe_bench_score || m.swe_score || 0) >= 60
      if (filterTag === "vision") return Boolean(m.supports_vision)
      if (filterTag === "tools") return Boolean(m.supports_tools)
      if (filterTag === "cache") return Boolean(m.supports_cache)
      if (filterTag === "google") return m.provider.toLowerCase().includes("google") || m.id.toLowerCase().includes("gemini")
      if (filterTag === "anthropic") return m.provider.toLowerCase().includes("anthropic") || m.id.toLowerCase().includes("claude")
      if (filterTag === "openai") return m.provider.toLowerCase().includes("openai") || m.id.toLowerCase().includes("gpt") || m.id.toLowerCase().includes("o3")
      if (filterTag === "deepseek") return m.provider.toLowerCase().includes("deepseek")

      return true
    })
  }, [models, searchQuery, filterTag])

  const top3Swe = useMemo(() => {
    if (topSweModels.length > 0) return topSweModels.slice(0, 3)
    return [...models]
      .sort((a, b) => (b.swe_bench_score || b.swe_score || 0) - (a.swe_bench_score || a.swe_score || 0))
      .slice(0, 3)
  }, [topSweModels, models])

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="max-w-4xl p-0 gap-0 overflow-hidden border border-zinc-800/80 bg-[#121215] text-zinc-100 shadow-2xl rounded-2xl sm:max-w-4xl max-h-[90vh] flex flex-col"
          showCloseButton={false}
        >
          {/* Header Bar: Sycord Omni Brand & Credit Metering */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/80 bg-[#18181c]/60">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-semibold text-white tracking-tight">Sycord Omni Route</h2>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-indigo-500/30 bg-indigo-500/10 text-indigo-300 font-mono">
                    Frontier Router
                  </Badge>
                </div>
                <p className="text-xs text-zinc-400">
                  Select SWE-bench frontier models or route custom providers dynamically
                </p>
              </div>
            </div>

            {/* Right: Credits Metering Indicator ($5.00 default) & Close button */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowCreditsModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 text-emerald-400 transition-all cursor-pointer text-xs font-medium group"
                title="View Generation Credits"
              >
                <Coins className="h-3.5 w-3.5 text-emerald-400 group-hover:rotate-12 transition-transform" />
                <span className="font-mono font-semibold">${Number(userCredits).toFixed(2)}</span>
                <span className="text-[10px] text-emerald-400/70 border-l border-emerald-500/20 pl-1.5">Credit</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Top 3 SWE-Bench Verified Leaderboard */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Award className="h-4 w-4 text-amber-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                    Top 3 SWE-Bench Frontier Verified
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">Autonomous Software Engineering Score</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top3Swe.map((model, idx) => {
                  const score = model.swe_bench_score || model.swe_score || 0
                  const isCurrent = model.id === activeModelId
                  const rankColors = [
                    "from-amber-500/20 via-amber-500/5 to-transparent border-amber-500/40 text-amber-400",
                    "from-slate-400/20 via-slate-400/5 to-transparent border-slate-400/30 text-slate-300",
                    "from-amber-700/20 via-amber-700/5 to-transparent border-amber-700/30 text-amber-600",
                  ]

                  return (
                    <div
                      key={model.id}
                      className={`relative flex items-center justify-between p-3.5 rounded-xl border bg-gradient-to-br ${
                        isCurrent ? "border-indigo-500/70 bg-indigo-950/20 shadow-lg shadow-indigo-950/30" : "border-zinc-800 bg-zinc-900/40 hover:border-zinc-700"
                      } transition-all`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                          <SvglIcon brand={model.provider || model.id} size={20} />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-white truncate">{model.name}</span>
                            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${rankColors[idx] || ""}`}>
                              #{idx + 1}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                            <span className="text-emerald-400 font-bold font-mono">{score}% SWE</span>
                            <span>•</span>
                            <span>${model.input_cost || 0} / ${model.output_cost || 0}</span>
                          </div>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        variant={isCurrent ? "secondary" : "outline"}
                        disabled={selectingModelId === model.id}
                        onClick={() => handleSelectModel(model)}
                        className={`h-7 px-2.5 text-xs rounded-lg shrink-0 ${
                          isCurrent
                            ? "bg-indigo-600 hover:bg-indigo-500 text-white border-0"
                            : "border-zinc-700 hover:bg-zinc-800 text-zinc-200"
                        }`}
                      >
                        {isCurrent ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          "Use"
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Filter Tabs & Search Box */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                {/* Search Box */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <Input
                    placeholder="Search models, providers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 text-xs border-zinc-800 bg-zinc-900/60 text-zinc-100 placeholder:text-zinc-500 rounded-xl focus:border-indigo-500"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery("")}
                      className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-white"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 scrollbar-none">
                  {[
                    { id: "all", label: "All" },
                    { id: "top", label: "Top SWE" },
                    { id: "google", label: "Google" },
                    { id: "anthropic", label: "Anthropic" },
                    { id: "openai", label: "OpenAI" },
                    { id: "deepseek", label: "DeepSeek" },
                    { id: "vision", label: "Vision" },
                    { id: "tools", label: "Tools" },
                    { id: "cache", label: "Cache" },
                  ].map((chip) => (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setFilterTag(chip.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                        filterTag === chip.id
                          ? "bg-white/10 text-white border border-white/20"
                          : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 border border-transparent"
                      }`}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Models Catalog Table / Grid */}
              <div className="space-y-1.5 border border-zinc-800/80 rounded-xl bg-zinc-900/20 p-1">
                {filteredModels.length === 0 ? (
                  <div className="py-12 text-center text-zinc-500 text-xs">
                    No models found matching your search.
                  </div>
                ) : (
                  filteredModels.map((model) => {
                    const isCurrent = model.id === activeModelId
                    const score = model.swe_bench_score || model.swe_score || 0

                    return (
                      <div
                        key={model.id}
                        className={`flex items-center justify-between p-2.5 rounded-xl transition-colors ${
                          isCurrent
                            ? "bg-indigo-950/30 border border-indigo-500/40"
                            : "hover:bg-zinc-800/40 border border-transparent"
                        }`}
                      >
                        {/* Model Brand Icon + Name + Provider */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                            <SvglIcon brand={model.provider || model.id} size={18} />
                          </div>
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white truncate">
                                {model.name}
                              </span>
                              {score > 0 && (
                                <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                                  {score}% SWE
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400">
                              <span className="capitalize">{model.provider}</span>
                              <span>•</span>
                              <span className="font-mono text-zinc-300">
                                ${model.input_cost || 0} / ${model.output_cost || 0}
                              </span>
                              <span className="text-zinc-500 text-[10px]">per 1M tokens</span>
                            </div>
                          </div>
                        </div>

                        {/* Capabilities Checklist Icons */}
                        <div className="hidden md:flex items-center gap-2 text-zinc-400 mr-4">
                          {model.supports_vision && (
                            <span title="Vision Supported" className="p-1 rounded bg-zinc-800/60 text-zinc-300">
                              <Eye className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {model.supports_tools && (
                            <span title="Tool Calling" className="p-1 rounded bg-zinc-800/60 text-zinc-300">
                              <Wrench className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {model.supports_cache && (
                            <span title="Context Caching" className="p-1 rounded bg-zinc-800/60 text-zinc-300">
                              <Database className="h-3.5 w-3.5" />
                            </span>
                          )}
                          {model.context_window && (
                            <span className="text-[10px] font-mono text-zinc-400 px-1.5 py-0.5 rounded bg-zinc-800/40">
                              {Math.round(model.context_window / 1000)}k ctx
                            </span>
                          )}
                        </div>

                        {/* Action Buttons: Profile Drawer & 1-Click Select */}
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setProfileModel(model)}
                            className="h-7 px-2 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg"
                          >
                            Profile
                          </Button>

                          <Button
                            size="sm"
                            disabled={selectingModelId === model.id}
                            onClick={() => handleSelectModel(model)}
                            className={`h-7 px-3 text-xs rounded-lg font-medium transition-all ${
                              isCurrent
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : "bg-indigo-600 hover:bg-indigo-500 text-white"
                            }`}
                          >
                            {selectingModelId === model.id ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : isCurrent ? (
                              <>
                                <Check className="h-3 w-3 mr-1" />
                                Active
                              </>
                            ) : (
                              "Select"
                            )}
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800/80 bg-[#18181c]/40 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <Shield className="h-3.5 w-3.5 text-indigo-400" />
              <span>Sycord Omni routes all generation requests through verified secure proxies</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-zinc-500">
                {filteredModels.length} models available
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Model Profile Drawer / Modal */}
      {profileModel && (
        <Dialog open={Boolean(profileModel)} onOpenChange={(o) => !o && setProfileModel(null)}>
          <DialogContent className="max-w-md border border-zinc-800 bg-[#16161a] text-zinc-100 rounded-2xl p-5 shadow-2xl">
            <DialogHeader className="pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
                  <SvglIcon brand={profileModel.provider || profileModel.id} size={22} />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-white">
                    {profileModel.name}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-zinc-400 capitalize">
                    {profileModel.provider} • {profileModel.id}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-2 text-xs">
              {/* SWE Bench & Latency */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 space-y-1">
                  <span className="text-zinc-400 text-[11px]">SWE-Bench Score</span>
                  <div className="text-lg font-bold text-emerald-400">
                    {profileModel.swe_bench_score || profileModel.swe_score || 50}%
                  </div>
                  <span className="text-[10px] text-zinc-500">Autonomous SWE ranking</span>
                </div>
                <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 space-y-1">
                  <span className="text-zinc-400 text-[11px]">Context Window</span>
                  <div className="text-lg font-bold text-indigo-400">
                    {profileModel.context_window ? `${Math.round(profileModel.context_window / 1000)}k` : "128k"}
                  </div>
                  <span className="text-[10px] text-zinc-500">Token capacity</span>
                </div>
              </div>

              {/* Pricing Cards */}
              <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 space-y-2">
                <span className="text-zinc-300 font-semibold">Token Pricing (USD / 1M tokens)</span>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60">
                    <span className="text-zinc-400">Input</span>
                    <span className="text-zinc-200 font-bold">${profileModel.input_cost || 0}</span>
                  </div>
                  <div className="flex items-center justify-between p-2 rounded bg-zinc-950/60">
                    <span className="text-zinc-400">Output</span>
                    <span className="text-zinc-200 font-bold">${profileModel.output_cost || 0}</span>
                  </div>
                </div>
              </div>

              {/* Capabilities checklist */}
              <div className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/50 space-y-2">
                <span className="text-zinc-300 font-semibold">Capabilities</span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Check className={`h-3.5 w-3.5 ${profileModel.supports_vision ? "text-emerald-400" : "text-zinc-600"}`} />
                    <span className={profileModel.supports_vision ? "text-zinc-200" : "text-zinc-500"}>Image / Vision</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className={`h-3.5 w-3.5 ${profileModel.supports_tools ? "text-emerald-400" : "text-zinc-600"}`} />
                    <span className={profileModel.supports_tools ? "text-zinc-200" : "text-zinc-500"}>Function Tools</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className={`h-3.5 w-3.5 ${profileModel.supports_cache ? "text-emerald-400" : "text-zinc-600"}`} />
                    <span className={profileModel.supports_cache ? "text-zinc-200" : "text-zinc-500"}>Context Caching</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check className={`h-3.5 w-3.5 ${profileModel.supports_reasoning ? "text-emerald-400" : "text-zinc-600"}`} />
                    <span className={profileModel.supports_reasoning ? "text-zinc-200" : "text-zinc-500"}>Reasoning Budget</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                variant="outline"
                onClick={() => setProfileModel(null)}
                className="w-1/2 border-zinc-700 hover:bg-zinc-800 text-xs"
              >
                Close
              </Button>
              <Button
                onClick={() => {
                  handleSelectModel(profileModel)
                  setProfileModel(null)
                }}
                className="w-1/2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
              >
                Set as Active
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Credit Metering Breakdown Modal */}
      {showCreditsModal && (
        <Dialog open={showCreditsModal} onOpenChange={setShowCreditsModal}>
          <DialogContent className="max-w-md border border-zinc-800 bg-[#16161a] text-zinc-100 rounded-2xl p-5 shadow-2xl">
            <DialogHeader className="pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-emerald-400" />
                <DialogTitle className="text-base font-semibold text-white">Generation Credits Balance</DialogTitle>
              </div>
              <DialogDescription className="text-xs text-zinc-400">
                Every account starts with $5.00 in free starter credits for AI model generation.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4 text-center">
              <div className="p-4 rounded-2xl border border-emerald-500/20 bg-emerald-950/20">
                <span className="text-xs text-zinc-400">Remaining Balance</span>
                <div className="text-4xl font-extrabold text-emerald-400 font-mono mt-1">
                  ${Number(userCredits).toFixed(2)}
                </div>
                <span className="text-[11px] text-zinc-500 mt-1 block">Deducted per token based on model rate</span>
              </div>

              <div className="text-left space-y-2 text-xs">
                <span className="font-semibold text-zinc-300">How Credits Work</span>
                <p className="text-zinc-400">
                  Each prompt and completion automatically calculates input and output token consumption against the active model's rate card.
                </p>
              </div>
            </div>

            <Button
              onClick={() => setShowCreditsModal(false)}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white text-xs"
            >
              Got it
            </Button>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
