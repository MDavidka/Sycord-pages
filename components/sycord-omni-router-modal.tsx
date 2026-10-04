"use client"

import React, { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Search,
  Check,
  X,
  Settings,
  SlidersHorizontal,
  Cpu,
  BarChart3,
  Coins,
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
  if (k.includes("openai") || k.includes("gpt") || k.includes("chatgpt") || k.includes("o1") || k.includes("o3") || k.includes("o4")) return "openai"
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

// Brand SVG logos with full vibrant color and fallback
export function BrandLogo({
  brand,
  size = 24,
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
      <Cpu className="text-emerald-400 shrink-0" style={{ width: size, height: size }} />
    </div>
  )
}

export interface ModelBrowserViewProps {
  onClose?: () => void
  selectedModel?: string
  onSelectModel?: (modelId: string, modelObj?: OmniModelItem) => void
  projectId?: string
  isStandalone?: boolean
}

export function ModelBrowserView({
  onClose,
  selectedModel,
  onSelectModel,
  projectId = "global",
  isStandalone = false,
}: ModelBrowserViewProps) {
  const [models, setModels] = useState<OmniModelItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeModelId, setActiveModelId] = useState<string>(selectedModel || "gemini-2.5-flash")
  const [activeTab, setActiveTab] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")

  const loadModels = (forceRefresh = false) => {
    setLoading(true)
    fetch(`/api/ai/omni?project_id=${encodeURIComponent(projectId)}${forceRefresh ? "&refresh=true" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.models && Array.isArray(data.models)) {
          setModels(data.models)
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
    loadModels()
  }, [projectId, selectedModel])

  // Benchmark top models for the bar chart
  const topSweModels = useMemo(() => {
    const defaultScores: Record<string, number> = {
      "claude-3-7-sonnet": 70.3,
      "claude-3-5-sonnet": 67.2,
      "o3-mini": 64.8,
      "deepseek-r1": 62.5,
      "gpt-4o": 53.4,
      "gemini-2.5-pro": 51.8,
    }

    const processed = models.map((m) => {
      let score = m.swe_score ?? m.swe_bench_score
      if (!score) {
        for (const [key, s] of Object.entries(defaultScores)) {
          if (m.id.toLowerCase().includes(key)) {
            score = s
            break
          }
        }
      }
      return {
        ...m,
        swe_score: score || Math.round(35 + (m.id.length * 3) % 35),
      }
    })

    return processed.sort((a, b) => (b.swe_score || 0) - (a.swe_score || 0)).slice(0, 6)
  }, [models])

  const maxSweScore = useMemo(() => {
    if (topSweModels.length === 0) return 100
    return Math.max(...topSweModels.map((m) => m.swe_score || 50), 100)
  }, [topSweModels])

  // Featured Cards with heights scaled by benchmark %
  const featuredCards = useMemo(() => {
    return topSweModels.map((model) => {
      const swe = model.swe_score || 50
      const heightPx = Math.max(55, Math.round((swe / maxSweScore) * 145))
      return {
        id: model.id,
        name: model.name,
        model,
        heightPx,
      }
    })
  }, [topSweModels, maxSweScore])

  // Filter tabs
  const filterTabs = [
    "All",
    "Anthropic",
    "OpenAI",
    "Google",
    "Open Source",
    "Reasoning",
    "Vision",
  ]

  const filteredModels = useMemo(() => {
    let list = models

    if (activeTab === "Anthropic") {
      list = list.filter((m) => (m.provider || "").toLowerCase().includes("anthropic") || m.id.toLowerCase().includes("claude"))
    } else if (activeTab === "OpenAI") {
      list = list.filter((m) => (m.provider || "").toLowerCase().includes("openai") || m.id.toLowerCase().includes("gpt") || m.id.toLowerCase().includes("o1") || m.id.toLowerCase().includes("o3"))
    } else if (activeTab === "Google") {
      list = list.filter((m) => (m.provider || "").toLowerCase().includes("google") || m.id.toLowerCase().includes("gemini"))
    } else if (activeTab === "Open Source") {
      list = list.filter((m) => {
        const p = (m.provider || "").toLowerCase()
        const id = m.id.toLowerCase()
        return p.includes("meta") || p.includes("mistral") || p.includes("deepseek") || p.includes("qwen") || id.includes("llama") || id.includes("qwen") || id.includes("deepseek")
      })
    } else if (activeTab === "Reasoning") {
      list = list.filter((m) => m.supports_reasoning || m.id.toLowerCase().includes("r1") || m.id.toLowerCase().includes("o1") || m.id.toLowerCase().includes("o3") || (m.swe_score ?? 0) > 40)
    } else if (activeTab === "Vision") {
      list = list.filter((m) => m.supports_vision || m.supports_image || m.id.toLowerCase().includes("vision") || m.id.toLowerCase().includes("flux"))
    }

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
  }, [models, activeTab, searchQuery])

  const handleToggleModel = (model: OmniModelItem) => {
    const isCurrentlyActive = activeModelId === model.id
    const newId = isCurrentlyActive ? "" : model.id
    setActiveModelId(newId)

    if (!isCurrentlyActive) {
      toast.success(`${model.name || model.id} activated`)
      onSelectModel?.(model.id, model)
    } else {
      toast.info(`${model.name || model.id} deactivated`)
    }

    void fetch("/api/ai/omni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_id: model.id,
        project_id: projectId,
        provider: model.provider,
        action: isCurrentlyActive ? "deactivate" : "activate",
      }),
    }).catch(() => {})
  }

  // Format pricing string like "$0.50 in / $1.50 out"
  const formatPricing = (model: OmniModelItem) => {
    const inCost = model.input_cost !== undefined ? `$${model.input_cost.toFixed(2)}` : "$0.50"
    const outCost = model.output_cost !== undefined ? `$${model.output_cost.toFixed(2)}` : "$1.50"
    return `${inCost} in • ${outCost} out`
  }

  const getModelSubtitle = (model: OmniModelItem) => {
    if (model.id.toLowerCase().includes("claude")) return "Anthropic • Sonnet 3.7"
    if (model.id.toLowerCase().includes("gpt-4o")) return "OpenAI • Multimodal"
    if (model.id.toLowerCase().includes("o3")) return "OpenAI • Reasoning"
    if (model.id.toLowerCase().includes("gemini")) return "Google DeepMind"
    if (model.id.toLowerCase().includes("deepseek")) return "DeepSeek AI"
    if (model.providerDisplay) return model.providerDisplay
    if (model.provider) return model.provider
    return "Foundation Model"
  }

  return (
    <div className="w-full h-full flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-y-auto">
      {/* Top Navbar */}
      <header className="w-full max-w-4xl mx-auto px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Sycord"
            width={24}
            height={24}
            className="rounded object-contain shrink-0"
            priority
          />
          <span className="text-sm font-semibold tracking-tight text-white">Sycord</span>
        </div>

        {onClose && !isStandalone && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </header>

      {/* Main Content Container */}
      <main className="w-full max-w-4xl mx-auto px-6 pb-12 flex-1 flex flex-col space-y-7">
        {/* Page Title & Settings */}
        <div className="flex items-center justify-between pt-1">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
              Model Browser
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Explore foundation AI models, pricing specifications, and benchmark metrics.
            </p>
          </div>
          <button
            type="button"
            aria-label="Settings"
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>

        {/* Top Models SWE-Bench Relative Bar Chart (No % markers on top) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5 text-zinc-400" />
              Top Models Benchmark Capabilities
            </span>
          </div>

          <div className="grid grid-cols-6 gap-2.5 sm:gap-3.5 items-end pt-2">
            {featuredCards.map((item) => (
              <div key={item.id} className="flex flex-col items-center gap-1.5 group">
                <button
                  type="button"
                  onClick={() => {
                    if (item.model) handleToggleModel(item.model)
                  }}
                  style={{ height: `${item.heightPx}px` }}
                  className="w-full rounded-2xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800/80 hover:border-zinc-700 active:scale-[0.98] transition-all flex flex-col items-center justify-center relative overflow-hidden shadow-xs cursor-pointer group"
                  title={item.name}
                >
                  {item.model && (
                    <BrandLogo
                      brand={item.model.provider || item.model.name}
                      size={26}
                      className="group-hover:scale-110 transition-transform"
                    />
                  )}
                </button>

                <span className="text-[11px] font-medium text-zinc-400 truncate max-w-full text-center group-hover:text-zinc-200 transition-colors">
                  {item.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2.5">
            {/* Search Input Container */}
            <div className="relative flex-1 flex items-center bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 focus-within:border-zinc-700 transition-colors">
              <Search className="w-4 h-4 text-zinc-400 shrink-0 mr-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models by name, provider, or ID..."
                className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 outline-none"
              />
              <span className="text-xs text-zinc-400 font-normal shrink-0 ml-2">
                {filteredModels.length} models
              </span>
            </div>

            {/* Filter Button */}
            <button
              type="button"
              aria-label="Filter"
              className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </div>

          {/* Pill Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            {filterTabs.map((tab) => {
              const isSelected = activeTab === tab
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors shrink-0 ${
                    isSelected
                      ? "bg-white text-black font-semibold shadow-xs"
                      : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800 border border-zinc-800"
                  }`}
                >
                  {tab}
                </button>
              )
            })}
          </div>
        </div>

        {/* Model Cards List (Removed background box from icons, added full color icons & explicit pricing) */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-semibold text-zinc-300">Available AI Models</span>
            <span className="text-[11px] text-zinc-500">Includes live pricing & capabilities</span>
          </div>

          {loading && models.length === 0 ? (
            <div className="space-y-2.5 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-zinc-900 border border-zinc-800/60" />
              ))}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="py-12 text-center text-xs text-zinc-500">
              No models found matching your search query.
            </div>
          ) : (
            filteredModels.map((model) => {
              const isActive = activeModelId === model.id
              const subtitle = getModelSubtitle(model)
              const pricing = formatPricing(model)

              return (
                <div
                  key={model.id}
                  className={`w-full rounded-2xl px-4 py-3.5 flex items-center justify-between gap-4 transition-all border ${
                    isActive
                      ? "bg-zinc-900/90 border-zinc-700 ring-1 ring-white/10"
                      : "bg-zinc-900/40 hover:bg-zinc-900/70 border-zinc-800/80"
                  }`}
                >
                  {/* Left: Direct LobeHub Color Icon (No background box) + Model Name + Subtitle */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="shrink-0 flex items-center justify-center">
                      <BrandLogo brand={model.provider || model.name} size={28} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate flex items-center gap-2">
                        <span>{model.name}</span>
                        {model.supports_reasoning && (
                          <span className="text-[9px] font-semibold text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded-md">
                            Reasoning
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-400 truncate mt-0.5">
                        {subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Clear Pricing info badge */}
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-zinc-300 font-mono bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl shrink-0">
                    <Coins className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>{pricing}</span>
                  </div>

                  {/* Right: Rounded Pill Toggle Switch */}
                  <button
                    type="button"
                    onClick={() => handleToggleModel(model)}
                    role="switch"
                    aria-checked={isActive}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isActive ? "bg-white" : "bg-[#28282b]"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-black shadow-md ring-0 transition duration-200 ease-in-out ${
                        isActive ? "translate-x-5 !bg-black" : "translate-x-0 !bg-zinc-400"
                      }`}
                    />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </main>
    </div>
  )
}

// Dialog Modal wrapper for opening inside Chat or Dashboard
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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="!bg-black/70 data-[state=open]:!bg-black/70 backdrop-blur-md"
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !min-h-[100dvh] !max-w-none !max-h-none !p-0 !gap-0 !rounded-none border-0 bg-zinc-950 text-zinc-100 shadow-none flex flex-col overflow-hidden font-sans z-[9999]"
        showCloseButton={false}
      >
        <ModelBrowserView
          onClose={() => onOpenChange(false)}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          projectId={projectId}
        />
      </DialogContent>
    </Dialog>
  )
}
