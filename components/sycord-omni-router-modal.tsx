"use client"

import React, { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  Search,
  Check,
  Sparkles,
  X,
  RefreshCw,
  Coins,
  SlidersHorizontal,
  Image as ImageIcon,
  Video,
  BrainCircuit,
  CheckSquare,
  Square,
  Plus,
  Layers,
  Cpu,
} from "lucide-react"

// Model Interface strictly matching Vercel AI Gateway & Sycord Omni Router
export interface OmniModelItem {
  id: string
  name: string
  provider: string
  providerDisplay?: string
  provider_display?: string
  swe_bench_score?: number
  swe_score?: number
  input_cost?: number
  output_cost?: number
  inputCostDisplay?: string
  outputCostDisplay?: string
  context_window?: number
  latency_tier?: string
  supports_vision?: boolean
  supports_image?: boolean
  supports_tools?: boolean
  supports_cache?: boolean
  supports_video?: boolean
  supports_reasoning?: boolean
  description?: string
  is_active?: boolean
  rank?: number
  tags?: string[]
}

// LobeHub icons catalog map provided by specification
const LOBEHUB_CDN_BASE = "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/"

const LOBEHUB_MAP: Record<string, string> = {
  ace: "ace",
  ai21: "ai21",
  aya: "aya",
  baichuan: "baichuan",
  chatglm: "chatglm",
  claude: "claude",
  codegeex: "codegeex",
  cogvideo: "cogvideo",
  cogview: "cogview",
  "command-a": "command-a",
  codex: "codex",
  "dall-e": "dall-e",
  dbrx: "dbrx",
  "deep-cogito": "deep-cogito",
  deepseek: "deepseek",
  dolphin: "dolphin",
  doubao: "doubao",
  elevenlabs: "elevenlabs",
  "fish-audio": "fish-audio",
  flux: "flux",
  gemini: "gemini",
  gemma: "gemma",
  "glm-v": "glm-v",
  grok: "grok",
  hunyuan: "hunyuan",
  kimi: "kimi",
  kolors: "kolors",
  kwaipilot: "kwaipilot",
  liquid: "liquid",
  llava: "llava",
  longcat: "longcat",
  magic: "magic",
  minimax: "minimax",
  mistral: "mistral",
  morph: "morph",
  "nano-banana": "nano-banana",
  nova: "nova",
  openchat: "openchat",
  openai: "openai",
  palm: "palm",
  perplexity: "perplexity",
  phind: "phind",
  poolside: "poolside",
  qwen: "qwen",
  reka: "reka",
  rwkv: "rwkv",
  sora: "sora",
  spark: "spark",
  stepfun: "stepfun",
  voyage: "voyage",
  wenxin: "wenxin",
  "xiaomi-mimo": "xiaomi-mimo",
  xuanyuan: "xuanyuan",
  yi: "yi",
}

export function getLobeHubIconKey(brandOrModel: string): string | null {
  if (!brandOrModel) return null
  const k = brandOrModel.toLowerCase().trim()

  if (LOBEHUB_MAP[k]) return LOBEHUB_MAP[k]

  if (k.includes("claude") || k.includes("anthropic") || k.includes("sonnet") || k.includes("haiku") || k.includes("opus")) return "claude"
  if (k.includes("openai") || k.includes("gpt") || k.includes("chatgpt") || k.includes("o1") || k.includes("o3")) return "openai"
  if (k.includes("gemini") || k.includes("google") || k.includes("vertex")) return "gemini"
  if (k.includes("gemma")) return "gemma"
  if (k.includes("deepseek")) return "deepseek"
  if (k.includes("qwen") || k.includes("alibaba")) return "qwen"
  if (k.includes("mistral")) return "mistral"
  if (k.includes("grok") || k.includes("xai")) return "grok"
  if (k.includes("flux")) return "flux"
  if (k.includes("dall-e") || k.includes("dalle") || k.includes("cogview") || k.includes("kolors")) return "dall-e"
  if (k.includes("sora") || k.includes("cogvideo")) return "sora"
  if (k.includes("minimax")) return "minimax"
  if (k.includes("perplexity")) return "perplexity"
  if (k.includes("stepfun")) return "stepfun"
  if (k.includes("yi")) return "yi"
  if (k.includes("baichuan")) return "baichuan"
  if (k.includes("doubao")) return "doubao"
  if (k.includes("kimi") || k.includes("moonshot")) return "kimi"
  if (k.includes("chatglm") || k.includes("glm") || k.includes("zhipu") || k.includes("zai")) return "chatglm"
  if (k.includes("codegeex")) return "codegeex"
  if (k.includes("command")) return "command-a"
  if (k.includes("codex")) return "codex"
  if (k.includes("dbrx")) return "dbrx"
  if (k.includes("elevenlabs")) return "elevenlabs"
  if (k.includes("nova")) return "nova"
  if (k.includes("phind")) return "phind"
  if (k.includes("voyage")) return "voyage"
  if (k.includes("wenxin") || k.includes("baidu")) return "wenxin"
  if (k.includes("hunyuan")) return "hunyuan"

  return null
}

// Brand SVG logos strictly using LobeHub icons JSON with SVGL/Lucide fallback
export function BrandLogo({
  brand,
  size = 20,
  className = "",
  onClick,
}: {
  brand: string
  size?: number
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const iconKey = getLobeHubIconKey(brand)
  const [error, setError] = useState(false)

  if (iconKey && !error) {
    const iconUrl = `${LOBEHUB_CDN_BASE}${iconKey}.svg`
    return (
      <img
        src={iconUrl}
        alt={brand}
        width={size}
        height={size}
        onError={() => setError(true)}
        onClick={onClick}
        className={`object-contain inline-block shrink-0 ${onClick ? "cursor-pointer" : ""} ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div onClick={onClick} className={`inline-flex items-center justify-center ${onClick ? "cursor-pointer" : ""} ${className}`}>
      <Cpu className="text-muted-foreground shrink-0" style={{ width: size, height: size }} />
    </div>
  )
}

export type PriceFilter = "all" | "free" | "low" | "medium" | "high"
export type CategoryFilter = "all" | "image" | "video" | "reasoning"

export interface SycordOmniRouterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedModel?: string
  onSelectModel?: (modelId: string, modelObj?: OmniModelItem) => void
  projectId?: string
  modelChoices?: Array<{
    id: string
    label?: string
    apiModel?: string
    active?: boolean
    isAiTabActive?: boolean
    enabled?: boolean
  }>
  isDark?: boolean
  onlyTurnedOn?: boolean
}

export function SycordOmniRouterModal({
  open,
  onOpenChange,
  selectedModel,
  onSelectModel,
  projectId = "global",
}: SycordOmniRouterModalProps) {
  const [models, setModels] = useState<OmniModelItem[]>([])
  const [providers, setProviders] = useState<Array<{ id: string; name: string; count: number }>>([])
  const [selectedProvider, setSelectedProvider] = useState<string>("all")
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all")
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all")
  const [loading, setLoading] = useState(false)
  const [activeModelId, setActiveModelId] = useState<string>(selectedModel || "gemini-2.5-flash")
  const [userCredits, setUserCredits] = useState<number>(200)
  const [searchQuery, setSearchQuery] = useState("")

  // Multi-select state for adding multiple models at once
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false)
  const [selectedModelIds, setSelectedModelIds] = useState<Set<string>>(new Set())

  const loadModels = (forceRefresh = false) => {
    setLoading(true)
    fetch(`/api/ai/omni?project_id=${encodeURIComponent(projectId)}${forceRefresh ? "&refresh=true" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.models && Array.isArray(data.models)) {
          setModels(data.models)
          if (data?.providers && Array.isArray(data.providers)) {
            setProviders(data.providers)
          }
        }
        if (data?.active_model && !selectedModel) {
          setActiveModelId(data.active_model)
        }
      })
      .catch(() => {
        toast.error("Failed to load models")
      })
      .finally(() => {
        setLoading(false)
      })
  }

  useEffect(() => {
    if (!open) return
    loadModels()

    fetch(`/api/user/credits`)
      .then((r) => r.json())
      .then((data) => {
        if (typeof data?.credits === "number") setUserCredits(data.credits)
        else if (typeof data?.balance === "number") setUserCredits(Math.round(data.balance * 40))
      })
      .catch(() => {})
  }, [open, projectId, selectedModel])

  const handleSelectModel = (model: OmniModelItem) => {
    setActiveModelId(model.id)
    // 1-click instantaneous response: immediately update parent & close modal
    toast.success(`Model ${model.name || model.id} added & set as active!`)
    onSelectModel?.(model.id, model)
    onOpenChange(false)

    // Fire API sync in the background without blocking the UI
    void fetch("/api/ai/omni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_id: model.id,
        project_id: projectId,
        provider: model.provider,
      }),
    }).catch(() => {})
  }

  // Toggle selection of a model in multi-select mode
  const toggleModelSelection = (modelId: string) => {
    setSelectedModelIds((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        next.delete(modelId)
      } else {
        next.add(modelId)
      }
      return next
    })
  }

  // Batch add multiple selected models to model library
  const handleBatchAddSelectedModels = async () => {
    if (selectedModelIds.size === 0) {
      toast.error("Please select at least one model to add")
      return
    }

    const selectedList = models.filter((m) => selectedModelIds.has(m.id))
    let count = 0

    for (const model of selectedList) {
      try {
        await fetch("/api/ai/omni", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model_id: model.id,
            project_id: projectId,
            provider: model.provider,
          }),
        }).catch(() => {})
        onSelectModel?.(model.id, model)
        count++
      } catch {}
    }

    toast.success(`Successfully added ${count} models to model library!`)
    setSelectedModelIds(new Set())
    setIsMultiSelectMode(false)
    onOpenChange(false)
  }

  // Helper checks for video / image models
  const isVideoModel = (m: OmniModelItem) => {
    const id = m.id.toLowerCase()
    const name = m.name.toLowerCase()
    return (
      m.supports_video ||
      id.includes("video") ||
      name.includes("video") ||
      id.includes("sora") ||
      id.includes("cogvideo") ||
      id.includes("runway") ||
      id.includes("kling") ||
      id.includes("hailuo") ||
      id.includes("luma")
    )
  }

  const isImageModel = (m: OmniModelItem) => {
    const id = m.id.toLowerCase()
    const name = m.name.toLowerCase()
    return (
      m.supports_image ||
      id.includes("flux") ||
      id.includes("dall-e") ||
      id.includes("dalle") ||
      id.includes("image") ||
      name.includes("image") ||
      id.includes("cogview") ||
      id.includes("kolors") ||
      id.includes("recraft") ||
      id.includes("sdxl") ||
      id.includes("stable-diffusion")
    )
  }

  const isReasoningModel = (m: OmniModelItem) => {
    const id = m.id.toLowerCase()
    return (
      m.supports_reasoning ||
      (m.swe_score ?? 0) > 40 ||
      id.includes("o1") ||
      id.includes("o3") ||
      id.includes("r1") ||
      id.includes("reasoning") ||
      id.includes("coder")
    )
  }

  // Filter models by category, provider, price, search query
  const filteredModels = useMemo(() => {
    let list = models

    // Category filter
    if (categoryFilter === "image") {
      list = list.filter(isImageModel)
    } else if (categoryFilter === "video") {
      list = list.filter(isVideoModel)
    } else if (categoryFilter === "reasoning") {
      list = list.filter(isReasoningModel)
    }

    // Provider filter
    if (selectedProvider !== "all") {
      list = list.filter((m) => (m.provider || "").toLowerCase() === selectedProvider.toLowerCase())
    }

    // Price tier filter
    if (priceFilter === "free") {
      list = list.filter((m) => (m.input_cost ?? 0) === 0 && (m.output_cost ?? 0) === 0)
    } else if (priceFilter === "low") {
      list = list.filter((m) => (m.input_cost ?? 0) > 0 && (m.input_cost ?? 0) <= 0.5)
    } else if (priceFilter === "medium") {
      list = list.filter((m) => (m.input_cost ?? 0) > 0.5 && (m.input_cost ?? 0) <= 2.5)
    } else if (priceFilter === "high") {
      list = list.filter((m) => (m.input_cost ?? 0) > 2.5)
    }

    // Search query
    const q = searchQuery.toLowerCase().trim()
    if (!q) return list
    return list.filter((m) => {
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.provider && m.provider.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      )
    })
  }, [models, categoryFilter, selectedProvider, priceFilter, searchQuery])

  // Group filtered models by provider or media type for categorized rendering
  const categorizedModels = useMemo(() => {
    const groups = new Map<string, OmniModelItem[]>()
    for (const model of filteredModels) {
      let groupKey = model.provider || "other"
      if (isVideoModel(model)) groupKey = "video_media"
      else if (isImageModel(model)) groupKey = "image_media"

      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey)!.push(model)
    }

    return Array.from(groups.entries()).map(([key, items]) => {
      let isVideo = key === "video_media"
      let isImage = key === "image_media"
      let providerDisplay = items[0]?.provider_display || items[0]?.providerDisplay || key.toUpperCase()

      if (isVideo) providerDisplay = "Video Generation Models"
      if (isImage) providerDisplay = "Image Generation & Vision Models"

      return {
        key,
        provider: items[0]?.provider || key,
        providerDisplay,
        isVideo,
        isImage,
        items,
      }
    })
  }, [filteredModels])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="!bg-black/60 data-[state=open]:!bg-black/60 backdrop-blur-md"
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !min-h-[100dvh] !max-w-none !max-h-none !p-0 !gap-0 !rounded-none border-0 bg-background text-foreground shadow-none flex flex-col overflow-hidden font-sans z-[9999]"
        showCloseButton={false}
      >
        {/* Modern Dashboard Header without "AI Models" badge */}
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 shrink-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            {/* Left: Sycord Brand & Logo (NO AI Models badge next to icon) */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/logo.png"
                  alt="Sycord"
                  width={26}
                  height={26}
                  className="rounded object-contain shrink-0"
                  priority
                />
                <span className="text-base font-semibold text-foreground tracking-tight">Sycord</span>
              </div>
            </div>

            {/* Right: Credits, Batch Add Multi-Select Toggle, Sync & Close */}
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Multi-Select Toggle Button */}
              <Button
                variant={isMultiSelectMode ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setIsMultiSelectMode(!isMultiSelectMode)
                  if (isMultiSelectMode) setSelectedModelIds(new Set())
                }}
                className={`h-8 px-2.5 text-xs rounded-lg gap-1.5 ${
                  isMultiSelectMode
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span>{isMultiSelectMode ? "Cancel Multi-Select" : "Add Multiple Models"}</span>
              </Button>

              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border bg-card text-muted-foreground text-xs font-medium">
                <Coins className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-foreground font-semibold tabular-nums">{userCredits}</span>
                <span className="text-[11px] text-muted-foreground">credits</span>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => loadModels(true)}
                title="Refresh models"
                className="h-8 px-2.5 text-xs border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground gap-1.5 rounded-lg"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                <span className="hidden sm:inline">Sync</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Filter Controls Bar (Search, Media Category Tabs with Lucide Icons, Price & Providers) */}
        <div className="border-b border-border bg-card/50 px-4 sm:px-6 py-3 shrink-0">
          <div className="max-w-6xl mx-auto space-y-3">
            {/* Search and Media Category Filter Row */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search models by name, capabilities, or id..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground text-xs font-medium outline-none focus:border-ring focus:ring-1 focus:ring-ring transition-all"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Filter Tabs with Lucide Icons (Image & Video Models displayed in new categories) */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
                {(
                  [
                    { id: "all", label: "All Models", icon: Sparkles },
                    { id: "image", label: "Image Models", icon: ImageIcon },
                    { id: "video", label: "Video Models", icon: Video },
                    { id: "reasoning", label: "Reasoning & Code", icon: BrainCircuit },
                  ] as const
                ).map((cat) => {
                  const Icon = cat.icon
                  const isSelected = categoryFilter === cat.id
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryFilter(cat.id)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs font-semibold"
                          : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span>{cat.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Price & Provider Scroll Bar */}
            <div className="flex items-center justify-between gap-3 pt-0.5 overflow-x-auto custom-scrollbar">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setSelectedProvider("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors shrink-0 flex items-center gap-1.5 ${
                    selectedProvider === "all"
                      ? "bg-accent text-foreground border-border shadow-xs font-semibold"
                      : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span>All Providers</span>
                  <span className="text-[10px] opacity-70">({models.length})</span>
                </button>
                {providers.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setSelectedProvider(p.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors shrink-0 flex items-center gap-1.5 ${
                      selectedProvider === p.id
                        ? "bg-accent text-foreground border-border shadow-xs font-semibold"
                        : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <BrandLogo brand={p.id} size={14} />
                    <span>{p.name}</span>
                    <span className="text-[10px] opacity-70 font-mono">({p.count})</span>
                  </button>
                ))}
              </div>

              {/* Price Filter */}
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline-flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Price:</span>
                </span>
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "free", label: "Free" },
                    { id: "low", label: "<$0.5" },
                    { id: "medium", label: "$0.5-$2.5" },
                    { id: "high", label: ">$2.5" },
                  ] as const
                ).map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setPriceFilter(tier.id)}
                    className={`px-2 py-0.5 rounded-md text-[11px] font-medium border transition-colors ${
                      priceFilter === tier.id
                        ? "bg-muted text-foreground border-border font-semibold"
                        : "bg-background text-muted-foreground border-border hover:bg-muted"
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Minimalist Models Grid Surface */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar bg-background">
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Batch Action Banner when Multi-Select Mode is Active */}
            {isMultiSelectMode && (
              <div className="p-3 rounded-xl border border-primary/40 bg-primary/10 flex items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <CheckSquare className="w-4 h-4 text-primary" />
                  <span>
                    Selected <strong className="text-primary">{selectedModelIds.size}</strong> model(s) to add to library
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      if (selectedModelIds.size === filteredModels.length) {
                        setSelectedModelIds(new Set())
                      } else {
                        setSelectedModelIds(new Set(filteredModels.map((m) => m.id)))
                      }
                    }}
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  >
                    {selectedModelIds.size === filteredModels.length ? "Deselect All" : "Select All Filtered"}
                  </Button>

                  <Button
                    size="sm"
                    onClick={handleBatchAddSelectedModels}
                    disabled={selectedModelIds.size === 0}
                    className="h-7 text-xs px-3 bg-primary text-primary-foreground font-semibold rounded-lg gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Selected Models ({selectedModelIds.size})</span>
                  </Button>
                </div>
              </div>
            )}

            {loading && models.length === 0 ? (
              <div className="py-20 text-center text-xs text-muted-foreground animate-pulse">
                Fetching models and specifications...
              </div>
            ) : categorizedModels.length === 0 ? (
              <div className="py-20 text-center text-xs text-muted-foreground space-y-2">
                <p>No models match your current filters.</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setCategoryFilter("all")
                    setSelectedProvider("all")
                    setPriceFilter("all")
                    setSearchQuery("")
                  }}
                  className="rounded-lg text-xs border-border"
                >
                  Clear all filters
                </Button>
              </div>
            ) : (
              categorizedModels.map((group) => (
                <div key={group.key} className="space-y-3">
                  {/* Category Header with Lucide Icons for Video/Image models */}
                  <div className="flex items-center gap-2 px-0.5 border-b border-border/60 pb-1.5">
                    {group.isVideo ? (
                      <Video className="w-4 h-4 text-purple-400 shrink-0" />
                    ) : group.isImage ? (
                      <ImageIcon className="w-4 h-4 text-emerald-400 shrink-0" />
                    ) : (
                      <BrandLogo brand={group.provider} size={16} />
                    )}
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      {group.providerDisplay}
                    </h2>
                    <span className="text-[11px] text-muted-foreground font-mono">({group.items.length})</span>
                  </div>

                  {/* Clean, minimalist cards matching dashboard styling */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.items.map((model) => {
                      const isSelected = model.id === activeModelId
                      const isCheckedInMulti = selectedModelIds.has(model.id)

                      return (
                        <div
                          key={model.id}
                          onClick={() => {
                            if (isMultiSelectMode) {
                              toggleModelSelection(model.id)
                            } else {
                              handleSelectModel(model)
                            }
                          }}
                          className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-xs ${
                            isCheckedInMulti
                              ? "bg-primary/10 border-primary ring-1 ring-primary/50"
                              : isSelected
                              ? "bg-card border-primary/70 ring-1 ring-primary/40"
                              : "bg-card border-border hover:border-border/80 hover:bg-card/90"
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {/* Model Brand Logo using LobeHub icons JSON */}
                                <div
                                  className="w-7 h-7 rounded-lg bg-muted/60 border border-border flex items-center justify-center shrink-0 group-hover:scale-105 group-hover:border-primary/50 transition-all pointer-events-none"
                                  title={model.name}
                                >
                                  {isVideoModel(model) ? (
                                    <Video className="w-4 h-4 text-purple-400" />
                                  ) : isImageModel(model) ? (
                                    <ImageIcon className="w-4 h-4 text-emerald-400" />
                                  ) : (
                                    <BrandLogo brand={model.provider || model.name} size={16} />
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {model.name}
                                  </div>
                                  <p className="text-[10px] font-mono text-muted-foreground truncate">{model.id}</p>
                                </div>
                              </div>

                              {/* Selection Indicator / Multi-Select Checkbox */}
                              {isMultiSelectMode ? (
                                <div className="shrink-0 text-primary">
                                  {isCheckedInMulti ? (
                                    <CheckSquare className="w-4 h-4" />
                                  ) : (
                                    <Square className="w-4 h-4 text-muted-foreground" />
                                  )}
                                </div>
                              ) : (
                                <div
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                    isSelected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border bg-transparent group-hover:border-muted-foreground"
                                  }`}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                                </div>
                              )}
                            </div>

                            {model.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {model.description}
                              </p>
                            )}
                          </div>

                          {/* Pricing, Media Badges & Context Details */}
                          <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
                            <div className="flex items-center gap-1.5 font-medium">
                              <span>
                                In: <strong className="text-foreground">{model.inputCostDisplay || `$${model.input_cost}`}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Out: <strong className="text-foreground">{model.outputCostDisplay || `$${model.output_cost}`}</strong>
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              {isVideoModel(model) && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-md">
                                  <Video className="w-2.5 h-2.5" />
                                  Video
                                </span>
                              )}
                              {isImageModel(model) && !isVideoModel(model) && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
                                  <ImageIcon className="w-2.5 h-2.5" />
                                  Image
                                </span>
                              )}
                              {model.context_window && (
                                <div className="font-mono text-muted-foreground text-[10px]">
                                  {Math.round(model.context_window / 1000)}k ctx
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </main>
      </DialogContent>
    </Dialog>
  )
}
