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
  Star,
  FileText,
  ImageIcon,
  Video,
  Mic,
  Brain,
  Layers,
  ChevronRight,
  Info,
  Plus,
  Trash2,
  Globe,
  Key,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Server,
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
  supports_audio?: boolean
  description?: string
  is_active?: boolean
  is_custom?: boolean
  rank?: number
  tags?: string[]
}

export interface CustomProviderRecord {
  id?: string
  name: string
  provider: string
  provider_type?: string
  base_url: string
  api_key?: string
  api_key_masked?: string
  models: string[]
  created_at?: string
}

// LobeHub icons catalog map provided by specification
const LOBEHUB_CDN_BASE = "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/"

const LOBEHUB_MAP: Record<string, string> = {
  ace: "ace",
  ai21: "ai21",
  anthropic: "claude",
  claude: "claude",
  aya: "aya",
  baichuan: "baichuan",
  chatglm: "chatglm",
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
  google: "gemini",
  gemma: "gemma",
  "glm-v": "glm-v",
  grok: "grok",
  xai: "grok",
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
  alibaba: "qwen",
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
  ollama: "ollama",
  groq: "groq",
  together: "together",
  openrouter: "openrouter",
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
  if (k.includes("ollama")) return "ollama"
  if (k.includes("groq")) return "groq"
  if (k.includes("together")) return "together"
  if (k.includes("openrouter")) return "openrouter"

  return null
}

// Provider icon abstraction complying with Section 5
export function ModelIcon({
  provider,
  modelName,
  size = 22,
  className = "",
  onClick,
}: {
  provider?: string
  modelName?: string
  size?: number
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  const iconKey = getLobeHubIconKey(provider || modelName || "")
  const [error, setError] = useState(false)

  if (iconKey && !error) {
    const iconUrl = `${LOBEHUB_CDN_BASE}${iconKey}.svg`
    return (
      <img
        src={iconUrl}
        alt={provider || modelName || "Model provider"}
        width={size}
        height={size}
        onError={() => setError(true)}
        onClick={onClick}
        className={`object-contain inline-block shrink-0 brightness-0 invert opacity-90 transition-opacity ${onClick ? "cursor-pointer" : ""} ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center justify-center text-[#A3A3A3] ${onClick ? "cursor-pointer" : ""} ${className}`}
    >
      <Cpu style={{ width: size, height: size }} strokeWidth={1.75} />
    </div>
  )
}

// Brand SVG logos backward compatibility wrapper
export function BrandLogo({
  brand,
  size = 22,
  className = "",
  onClick,
}: {
  brand: string
  size?: number
  className?: string
  onClick?: (e: React.MouseEvent) => void
}) {
  return <ModelIcon provider={brand} modelName={brand} size={size} className={className} onClick={onClick} />
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
  const [starredModelIds, setStarredModelIds] = useState<Set<string>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("starred_model_ids")
        if (saved) return new Set(JSON.parse(saved))
      } catch {}
    }
    return new Set(["anthropic/claude-3.5-sonnet", "openai/gpt-4o", "google/gemini-2.5-flash"])
  })
  const [activeTab, setActiveTab] = useState<string>("All")
  const [searchQuery, setSearchQuery] = useState("")
  const [inspectingModel, setInspectingModel] = useState<OmniModelItem | null>(null)

  // Custom Provider Settings State
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [settingsTab, setSettingsTab] = useState<"add" | "saved">("add")
  const [savedProviders, setSavedProviders] = useState<CustomProviderRecord[]>([])
  const [cpName, setCpName] = useState("")
  const [cpBaseUrl, setCpBaseUrl] = useState("")
  const [cpApiKey, setCpApiKey] = useState("")
  const [cpShowKey, setCpShowKey] = useState(false)
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryStatus, setDiscoveryStatus] = useState<{
    type: "idle" | "loading" | "success" | "error"
    message?: string
  }>({ type: "idle" })
  const [discoveredModels, setDiscoveredModels] = useState<Array<{ id: string; name: string }>>([])
  const [selectedDiscoveredModels, setSelectedDiscoveredModels] = useState<Set<string>>(new Set())
  const [manualModelInput, setManualModelInput] = useState("")
  const [manualModels, setManualModels] = useState<string[]>([])
  const [isSavingProvider, setIsSavingProvider] = useState(false)

  // Load custom providers from backend / local storage
  const loadCustomProviders = () => {
    fetch("/api/ai/custom-providers")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.providers)) {
          setSavedProviders(data.providers)
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("sycord_custom_providers", JSON.stringify(data.providers))
            } catch {}
          }
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("sycord_custom_providers")
            if (cached) setSavedProviders(JSON.parse(cached))
          } catch {}
        }
      })
  }

  const loadModels = (forceRefresh = false) => {
    setLoading(true)
    fetch(`/api/ai/omni?project_id=${encodeURIComponent(projectId)}${forceRefresh ? "&refresh=true" : ""}`)
      .then((r) => r.json())
      .then((data) => {
        let loadedModels: OmniModelItem[] = []
        if (data?.models && Array.isArray(data.models)) {
          loadedModels = data.models
        }

        // Merge any locally saved custom providers that may not be in MongoDB yet
        if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("sycord_custom_providers")
            if (cached) {
              const providers: CustomProviderRecord[] = JSON.parse(cached)
              const existingIds = new Set(loadedModels.map((m) => m.id))
              for (const p of providers) {
                const slug = p.provider || p.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")
                for (const mId of p.models || []) {
                  const fullId = mId.includes("/") ? mId : `${slug}/${mId}`
                  if (!existingIds.has(fullId)) {
                    existingIds.add(fullId)
                    loadedModels.unshift({
                      id: fullId,
                      name: mId.includes("/") ? mId.split("/").pop() || mId : mId,
                      provider: slug,
                      providerDisplay: p.name,
                      provider_display: p.name,
                      swe_score: 50,
                      input_cost: 0.0,
                      output_cost: 0.0,
                      context_window: 128000,
                      supports_vision: true,
                      supports_tools: true,
                      supports_reasoning: true,
                      description: `Custom model hosted on ${p.name} (${p.base_url || "Custom Endpoint"})`,
                      is_active: false,
                      is_custom: true,
                      tags: ["custom", slug],
                    })
                  }
                }
              }
            }
          } catch {}
        }

        setModels(loadedModels)
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
    loadCustomProviders()
  }, [projectId, selectedModel])

  // Save starred models to localStorage
  const toggleStarModel = (modelId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setStarredModelIds((prev) => {
      const next = new Set(prev)
      if (next.has(modelId)) {
        next.delete(modelId)
        toast.info("Model removed from favorites")
      } else {
        next.add(modelId)
        toast.success("Model starred as favorite")
      }
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("starred_model_ids", JSON.stringify(Array.from(next)))
        } catch {}
      }
      return next
    })
  }

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

  // Check if we have any custom models in library
  const hasCustomModels = useMemo(() => {
    return models.some((m) => m.is_custom || (m.tags && m.tags.includes("custom")))
  }, [models])

  // Filter tabs
  const filterTabs = useMemo(() => {
    const base = [
      "All",
      "Starred",
      "Anthropic",
      "OpenAI",
      "Google",
      "Open Source",
      "Reasoning",
      "Vision",
    ]
    if (hasCustomModels) {
      base.push("Custom")
    }
    return base
  }, [hasCustomModels])

  const filteredModels = useMemo(() => {
    let list = models

    if (activeTab === "Starred") {
      list = list.filter((m) => starredModelIds.has(m.id))
    } else if (activeTab === "Anthropic") {
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
    } else if (activeTab === "Custom") {
      list = list.filter((m) => m.is_custom || (m.tags && m.tags.includes("custom")))
    }

    const q = searchQuery.toLowerCase().trim()
    if (!q) return list

    return list.filter((m) => {
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.provider && m.provider.toLowerCase().includes(q)) ||
        (m.providerDisplay && m.providerDisplay.toLowerCase().includes(q)) ||
        (m.description && m.description.toLowerCase().includes(q))
      )
    })
  }, [models, activeTab, searchQuery, starredModelIds])

  const handleSelectActiveModel = (model: OmniModelItem) => {
    setActiveModelId(model.id)
    toast.success(`${model.name || model.id} set as active model`)
    onSelectModel?.(model.id, model)
    if (!isStandalone && onClose) {
      onClose()
    }

    void fetch("/api/ai/omni", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model_id: model.id,
        project_id: projectId,
        provider: model.provider,
        action: "activate",
      }),
    }).catch(() => {})
  }

  // Format pricing string
  const formatPricing = (model: OmniModelItem) => {
    if (model.is_custom) return "Custom Endpoint"
    const inCost = model.input_cost !== undefined ? `$${model.input_cost.toFixed(2)}` : "$0.50"
    const outCost = model.output_cost !== undefined ? `$${model.output_cost.toFixed(2)}` : "$1.50"
    return `${inCost} in • ${outCost} out`
  }

  const getModelSubtitle = (model: OmniModelItem) => {
    if (model.is_custom) return `Custom • ${model.providerDisplay || model.provider}`
    if (model.id.toLowerCase().includes("claude")) return "Anthropic • Sonnet 3.7"
    if (model.id.toLowerCase().includes("gpt-4o")) return "OpenAI • Multimodal"
    if (model.id.toLowerCase().includes("o3")) return "OpenAI • Reasoning"
    if (model.id.toLowerCase().includes("gemini")) return "Google DeepMind"
    if (model.id.toLowerCase().includes("deepseek")) return "DeepSeek AI"
    if (model.providerDisplay) return model.providerDisplay
    if (model.provider) return model.provider
    return "Foundation Model"
  }

  // Modal modality indicator badges
  const getModalities = (model: OmniModelItem) => {
    const list: Array<{ label: string; icon: any; color: string }> = [
      { label: "Text", icon: FileText, color: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
    ]
    if (model.supports_vision || model.supports_image || model.id.toLowerCase().includes("vision") || model.id.toLowerCase().includes("flux")) {
      list.push({ label: "Image", icon: ImageIcon, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20" })
    }
    if (model.supports_video || model.id.toLowerCase().includes("video") || model.id.toLowerCase().includes("sora")) {
      list.push({ label: "Video", icon: Video, color: "text-purple-400 bg-purple-500/10 border-purple-500/20" })
    }
    if (model.supports_audio || model.id.toLowerCase().includes("audio") || model.id.toLowerCase().includes("speech")) {
      list.push({ label: "Audio", icon: Mic, color: "text-amber-400 bg-amber-500/10 border-amber-500/20" })
    }
    if (model.supports_reasoning || model.id.toLowerCase().includes("r1") || model.id.toLowerCase().includes("o1") || model.id.toLowerCase().includes("o3")) {
      list.push({ label: "Reasoning", icon: Brain, color: "text-pink-400 bg-pink-500/10 border-pink-500/20" })
    }
    return list
  }

  // --- SMART MODEL AUTO-DISCOVERY ACTION ---
  const handleDiscoverModels = async () => {
    if (!cpBaseUrl.trim()) {
      toast.error("Please enter a Base URL or Chat Completion URL")
      return
    }

    setIsDiscovering(true)
    setDiscoveryStatus({
      type: "loading",
      message: "Connecting to provider endpoint and searching for available models...",
    })

    try {
      const res = await fetch("/api/ai/custom-providers/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          base_url: cpBaseUrl.trim(),
          api_key: cpApiKey.trim(),
        }),
      })

      const data = await res.json().catch(() => null)

      if (res.ok && data?.ok && Array.isArray(data?.models) && data.models.length > 0) {
        setDiscoveredModels(data.models)
        setSelectedDiscoveredModels(new Set(data.models.map((m: any) => m.id)))
        setDiscoveryStatus({
          type: "success",
          message: `Found ${data.models.length} available models from provider!`,
        })
        toast.success(`Discovered ${data.models.length} models!`)
      } else {
        setDiscoveredModels([])
        setSelectedDiscoveredModels(new Set())
        setDiscoveryStatus({
          type: "error",
          message: data?.error || "Auto-discovery could not detect models. Please use the manual model adder below.",
        })
        toast.warning("Could not auto-discover models. Enter model names manually.")
      }
    } catch (err: any) {
      setDiscoveredModels([])
      setSelectedDiscoveredModels(new Set())
      setDiscoveryStatus({
        type: "error",
        message: err?.message || "Network error. Please use manual model adder below.",
      })
      toast.error("Discovery failed. Please add models manually.")
    } finally {
      setIsDiscovering(false)
    }
  }

  // --- MANUAL MODEL ADDER ACTIONS ---
  const handleAddManualModel = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = manualModelInput.trim()
    if (!trimmed) return
    if (!manualModels.includes(trimmed)) {
      setManualModels((prev) => [...prev, trimmed])
      setManualModelInput("")
      toast.success(`Added "${trimmed}" to provider models`)
    } else {
      toast.info(`Model "${trimmed}" is already added`)
    }
  }

  const handleRemoveManualModel = (modelToRemove: string) => {
    setManualModels((prev) => prev.filter((m) => m !== modelToRemove))
  }

  const handleToggleDiscoveredModel = (id: string) => {
    setSelectedDiscoveredModels((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleSelectAllDiscovered = () => {
    setSelectedDiscoveredModels(new Set(discoveredModels.map((m) => m.id)))
  }

  const handleDeselectAllDiscovered = () => {
    setSelectedDiscoveredModels(new Set())
  }

  // Combined staged models ready for saving
  const stagedModelsList = useMemo(() => {
    const fromDiscovery = Array.from(selectedDiscoveredModels)
    const combined = [...fromDiscovery, ...manualModels]
    return Array.from(new Set(combined))
  }, [selectedDiscoveredModels, manualModels])

  // --- SAVE CUSTOM PROVIDER ACTION ---
  const handleSaveCustomProvider = async () => {
    const trimmedName = cpName.trim()
    const trimmedUrl = cpBaseUrl.trim()

    if (!trimmedName) {
      toast.error("Please provide a Provider Name")
      return
    }
    if (!trimmedUrl) {
      toast.error("Please provide a Base URL")
      return
    }
    if (stagedModelsList.length === 0) {
      toast.error("Please add at least one model (via auto-discovery or manual entry)")
      return
    }

    setIsSavingProvider(true)
    const providerSlug = trimmedName.toLowerCase().replace(/[^a-z0-9_-]/g, "_")

    try {
      const res = await fetch("/api/ai/custom-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          provider: providerSlug,
          base_url: trimmedUrl,
          api_key: cpApiKey.trim(),
          models: stagedModelsList,
        }),
      })

      const data = await res.json().catch(() => null)

      // Create new OmniModelItem instances for immediate library injection
      const newModelItems: OmniModelItem[] = stagedModelsList.map((mId) => {
        const fullId = mId.includes("/") ? mId : `${providerSlug}/${mId}`
        const displayName = mId.includes("/") ? mId.split("/").pop() || mId : mId
        return {
          id: fullId,
          name: displayName,
          provider: providerSlug,
          providerDisplay: trimmedName,
          provider_display: trimmedName,
          swe_score: 50,
          input_cost: 0.0,
          output_cost: 0.0,
          context_window: 128000,
          supports_vision: true,
          supports_tools: true,
          supports_reasoning: true,
          description: `Custom model hosted on ${trimmedName} (${trimmedUrl})`,
          is_active: false,
          is_custom: true,
          tags: ["custom", providerSlug],
        }
      })

      // Add models to active state immediately
      setModels((prev) => {
        const newIds = new Set(newModelItems.map((m) => m.id))
        const remaining = prev.filter((m) => !newIds.has(m.id))
        return [...newModelItems, ...remaining]
      })

      // Update saved providers list & localStorage
      const newProviderRecord: CustomProviderRecord = {
        id: data?.provider?.id || `cp_${Date.now()}`,
        name: trimmedName,
        provider: providerSlug,
        base_url: trimmedUrl,
        api_key_masked: cpApiKey ? `${cpApiKey.slice(0, 4)}...${cpApiKey.slice(-4)}` : "",
        models: stagedModelsList,
        created_at: new Date().toISOString(),
      }

      const updatedProviders = [newProviderRecord, ...savedProviders.filter((p) => p.provider !== providerSlug)]
      setSavedProviders(updatedProviders)
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("sycord_custom_providers", JSON.stringify(updatedProviders))
        } catch {}
      }

      toast.success(`Provider "${trimmedName}" with ${stagedModelsList.length} models added to library!`)

      // Reset form
      setCpName("")
      setCpBaseUrl("")
      setCpApiKey("")
      setDiscoveredModels([])
      setSelectedDiscoveredModels(new Set())
      setManualModels([])
      setDiscoveryStatus({ type: "idle" })
      setShowSettingsModal(false)
      setActiveTab("Custom")
    } catch (err: any) {
      toast.error(err?.message || "Failed to save provider")
    } finally {
      setIsSavingProvider(false)
    }
  }

  // --- DELETE CUSTOM PROVIDER ACTION ---
  const handleDeleteProvider = async (providerRecord: CustomProviderRecord) => {
    try {
      const slug = providerRecord.provider || providerRecord.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")
      await fetch(`/api/ai/custom-providers?id=${encodeURIComponent(providerRecord.id || slug)}`, {
        method: "DELETE",
      }).catch(() => {})

      // Remove from state
      setSavedProviders((prev) => prev.filter((p) => (p.id || p.provider) !== (providerRecord.id || slug)))
      setModels((prev) => prev.filter((m) => m.provider !== slug))

      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("sycord_custom_providers")
          if (cached) {
            const list: CustomProviderRecord[] = JSON.parse(cached)
            const nextList = list.filter((p) => (p.id || p.provider) !== (providerRecord.id || slug))
            localStorage.setItem("sycord_custom_providers", JSON.stringify(nextList))
          }
        } catch {}
      }

      toast.success(`Provider "${providerRecord.name}" removed`)
    } catch {
      toast.error("Failed to delete provider")
    }
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#131313] text-[#F5F5F5] select-none overflow-y-auto">
      {/* Top Navbar */}
      <header className="w-full max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Sycord"
            width={24}
            height={24}
            className="rounded-[6px] object-contain shrink-0"
            priority
          />
          <span className="text-sm font-medium tracking-tight text-[#F5F5F5]">Sycord</span>
        </div>

        {onClose && !isStandalone && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-11 items-center justify-center rounded-[14px] text-[#737373] hover:text-[#F5F5F5] hover:bg-[#1D1D1D] border border-transparent hover:border-[#292929] transition-all active:scale-[0.97]"
          >
            <X className="size-4" strokeWidth={1.75} />
          </button>
        )}
      </header>

      {/* Main Content Container */}
      <main className="w-full max-w-4xl mx-auto px-4 sm:px-6 pb-12 flex-1 flex flex-col space-y-8">
        {/* Page Title & Settings Area */}
        <div className="flex items-start justify-between gap-4 pt-1">
          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-[#F5F5F5]">
              Model Browser
            </h1>
            <p className="text-xs sm:text-[13px] text-[#737373] leading-relaxed">
              Explore foundation AI models, pricing specifications, and benchmark metrics.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowSettingsModal(true)}
            aria-label="Provider Settings"
            title="Add Custom Provider & Manage Endpoints"
            className="flex size-11 items-center justify-center rounded-[18px] bg-[#171717] border border-[#292929] text-[#737373] hover:text-[#F5F5F5] hover:bg-[#1D1D1D] hover:border-[#383838] transition-all active:scale-[0.97] shrink-0 group relative"
          >
            <Settings className="size-4 group-hover:rotate-45 transition-transform duration-200" strokeWidth={1.75} />
            {savedProviders.length > 0 && (
              <span className="absolute -top-1 -right-1 size-4 rounded-full bg-emerald-500 text-[9px] font-bold text-black flex items-center justify-center">
                {savedProviders.length}
              </span>
            )}
          </button>
        </div>

        {/* Top Models SWE-Bench Carousel / Featured Models */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-medium text-[#A3A3A3] flex items-center gap-2">
              <BarChart3 className="size-3.5 text-[#737373]" strokeWidth={1.75} />
              Top models benchmark capabilities
            </span>
          </div>

          {/* Horizontal scrollable featured cards */}
          <div className="flex gap-2.5 sm:gap-3 overflow-x-auto pb-1.5 scrollbar-none">
            {featuredCards.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.model) setInspectingModel(item.model)
                }}
                className="group flex-shrink-0 w-[140px] sm:w-[150px] p-3 rounded-[18px] bg-[#171717] hover:bg-[#1D1D1D] border border-[#292929] hover:border-[#383838] transition-all active:scale-[0.97] flex flex-col items-start gap-2.5 text-left cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-[#383838]"
              >
                <div className="flex size-9 items-center justify-center rounded-[12px] bg-[#1D1D1D] border border-[#222222] group-hover:border-[#292929] transition-colors">
                  <ModelIcon
                    provider={item.model?.provider}
                    modelName={item.name}
                    size={20}
                  />
                </div>

                <div className="w-full min-w-0 space-y-0.5">
                  <div className="text-xs font-medium text-[#F5F5F5] truncate group-hover:text-white transition-colors">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-[#737373] truncate">
                    {item.model?.providerDisplay || item.model?.provider || "AI Model"}
                  </div>
                </div>

                {item.model?.swe_score ? (
                  <div className="w-full pt-1 border-t border-[#222222] flex items-center justify-between text-[10.5px]">
                    <span className="text-[#737373]">SWE-bench</span>
                    <span className="font-mono font-medium text-[#A3A3A3]">{item.model.swe_score}%</span>
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="space-y-3">
          <div className="flex items-center gap-2.5">
            {/* Search Input Container */}
            <div className="relative flex-1 flex items-center min-h-[44px] bg-[#171717] border border-[#292929] focus-within:border-[#383838] rounded-[18px] px-3.5 transition-colors">
              <Search className="size-4 text-[#737373] shrink-0 mr-2.5" strokeWidth={1.75} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search models by name, provider, or ID..."
                className="w-full bg-transparent text-xs sm:text-sm text-[#F5F5F5] placeholder:text-[#737373] outline-none"
              />
              <span className="text-xs text-[#737373] font-normal shrink-0 ml-2">
                {filteredModels.length} models
              </span>
            </div>

            {/* Quick Add Custom Provider Button */}
            <button
              type="button"
              onClick={() => {
                setSettingsTab("add")
                setShowSettingsModal(true)
              }}
              aria-label="Add Custom Provider"
              title="Add Custom Provider"
              className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-[18px] bg-[#171717] border border-[#292929] text-xs font-medium text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#1D1D1D] hover:border-[#383838] transition-all active:scale-[0.97] shrink-0"
            >
              <Plus className="size-3.5 text-emerald-400" strokeWidth={2.5} />
              <span className="hidden sm:inline">Add Provider</span>
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
                  className={`min-h-[44px] px-4 rounded-[18px] text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 active:scale-[0.97] ${
                    isSelected
                      ? "bg-[#F5F5F5] text-[#131313] font-semibold"
                      : "bg-[#171717] text-[#A3A3A3] hover:text-[#F5F5F5] hover:bg-[#1D1D1D] border border-[#292929]"
                  }`}
                >
                  {tab === "Starred" && (
                    <Star
                      className={`size-3.5 ${isSelected ? "fill-[#131313] text-[#131313]" : "fill-[#A3A3A3] text-[#A3A3A3]"}`}
                    />
                  )}
                  {tab === "Custom" && (
                    <Sparkles className={`size-3.5 ${isSelected ? "text-[#131313]" : "text-emerald-400"}`} />
                  )}
                  <span>{tab}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Model Cards List */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between px-0.5">
            <span className="text-xs font-medium text-[#F5F5F5]">Available AI Models</span>
            <span className="text-[11px] text-[#737373]">Click card for model specifications</span>
          </div>

          {loading && models.length === 0 ? (
            <div className="space-y-2.5 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 rounded-[20px] bg-[#171717] border border-[#222222]" />
              ))}
            </div>
          ) : filteredModels.length === 0 ? (
            <div className="py-12 text-center text-xs text-[#737373] space-y-3">
              <p>No models found matching your search query.</p>
              <button
                type="button"
                onClick={() => {
                  setSettingsTab("add")
                  setShowSettingsModal(true)
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#1D1D1D] border border-[#292929] text-xs font-medium text-[#F5F5F5] hover:border-[#383838]"
              >
                <Plus className="size-3.5 text-emerald-400" />
                <span>Add Custom Provider & Model</span>
              </button>
            </div>
          ) : (
            filteredModels.map((model) => {
              const isActive = activeModelId === model.id
              const isStarred = starredModelIds.has(model.id)
              const subtitle = getModelSubtitle(model)
              const pricing = formatPricing(model)

              return (
                <div
                  key={model.id}
                  onClick={() => setInspectingModel(model)}
                  className={`w-full rounded-[20px] p-3.5 sm:px-5 sm:py-4 flex items-center justify-between gap-4 transition-all border cursor-pointer group active:scale-[0.99] ${
                    isActive
                      ? "bg-[#1D1D1D] border-[#383838]"
                      : "bg-[#171717] hover:bg-[#1D1D1D] border-[#292929] hover:border-[#383838]"
                  }`}
                >
                  {/* Left: Provider Icon + Model Name + Provider Subtitle */}
                  <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                    <div className="size-10 sm:size-11 shrink-0 flex items-center justify-center rounded-[14px] bg-[#1D1D1D] border border-[#222222]">
                      <ModelIcon provider={model.provider} modelName={model.name} size={22} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[#F5F5F5] truncate flex items-center gap-2 group-hover:text-white transition-colors">
                        <span className="truncate">{model.name}</span>
                        {model.is_custom && (
                          <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-[6px]">
                            Custom
                          </span>
                        )}
                        {isActive && (
                          <span className="text-[9.5px] font-medium text-[#F5F5F5] bg-[#202020] border border-[#383838] px-1.5 py-0.5 rounded-[8px]">
                            Active
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[#737373] truncate mt-0.5">
                        {subtitle}
                      </div>
                    </div>
                  </div>

                  {/* Middle: Pricing info */}
                  <div className="hidden sm:flex items-center gap-1.5 text-xs text-[#A3A3A3] font-mono bg-[#1D1D1D] border border-[#222222] px-3 py-1.5 rounded-[12px] shrink-0">
                    <Coins className="size-3.5 text-[#737373] shrink-0" strokeWidth={1.75} />
                    <span>{pricing}</span>
                  </div>

                  {/* Right: Star Action Icon (Favorite toggle with 44px hit target) */}
                  <button
                    type="button"
                    onClick={(e) => toggleStarModel(model.id, e)}
                    aria-label={isStarred ? "Remove from favorites" : "Add to favorites"}
                    title={isStarred ? "Unstar model" : "Star model as favorite"}
                    className={`flex size-11 items-center justify-center rounded-[14px] border transition-all active:scale-[0.97] shrink-0 ${
                      isStarred
                        ? "bg-[#202020] border-[#383838] text-[#F5F5F5]"
                        : "bg-transparent border-transparent text-[#737373] hover:text-[#F5F5F5] hover:bg-[#1D1D1D] hover:border-[#292929]"
                    }`}
                  >
                    <Star
                      className={`size-4 ${isStarred ? "fill-[#F5F5F5]" : ""}`}
                      strokeWidth={1.75}
                    />
                  </button>
                </div>
              )
            })
          )}
        </div>
      </main>

      {/* --- CUSTOM PROVIDER SETTINGS MODAL --- */}
      <Dialog open={showSettingsModal} onOpenChange={setShowSettingsModal}>
        <DialogContent className="bg-[#171717] border border-[#292929] text-[#F5F5F5] max-w-xl max-h-[85vh] overflow-y-auto rounded-[26px] p-6 shadow-2xl space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 border-b border-[#292929] pb-4">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold text-[#F5F5F5] flex items-center gap-2">
                <Settings className="size-5 text-emerald-400" />
                Custom AI Providers
              </h2>
              <p className="text-xs text-[#737373]">
                Connect self-hosted or third-party OpenAI-compatible endpoints and add custom models to your library.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              aria-label="Close"
              className="flex size-9 items-center justify-center rounded-[10px] text-[#737373] hover:text-[#F5F5F5] hover:bg-[#202020] transition-colors"
            >
              <X className="size-4" strokeWidth={1.75} />
            </button>
          </div>

          {/* Navigation Tabs (Add New vs Saved Providers) */}
          <div className="flex items-center gap-2 border-b border-[#222222] pb-3">
            <button
              type="button"
              onClick={() => setSettingsTab("add")}
              className={`px-3.5 py-1.5 rounded-[12px] text-xs font-medium transition-all ${
                settingsTab === "add"
                  ? "bg-[#F5F5F5] text-[#131313] font-semibold"
                  : "bg-[#1D1D1D] text-[#A3A3A3] hover:text-white border border-[#292929]"
              }`}
            >
              Add Custom Provider
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab("saved")}
              className={`px-3.5 py-1.5 rounded-[12px] text-xs font-medium transition-all flex items-center gap-1.5 ${
                settingsTab === "saved"
                  ? "bg-[#F5F5F5] text-[#131313] font-semibold"
                  : "bg-[#1D1D1D] text-[#A3A3A3] hover:text-white border border-[#292929]"
              }`}
            >
              <span>Configured Providers</span>
              <span className="text-[10px] bg-[#292929] px-1.5 py-0.5 rounded-full text-[#A3A3A3]">
                {savedProviders.length}
              </span>
            </button>
          </div>

          {/* Tab 1: ADD CUSTOM PROVIDER FORM */}
          {settingsTab === "add" && (
            <div className="space-y-5">
              {/* Provider Name Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#A3A3A3]">
                  Provider Name <span className="text-red-400">*</span>
                </label>
                <div className="relative flex items-center min-h-[42px] bg-[#131313] border border-[#292929] focus-within:border-[#383838] rounded-[14px] px-3 transition-colors">
                  <Server className="size-4 text-[#737373] mr-2 shrink-0" />
                  <input
                    type="text"
                    value={cpName}
                    onChange={(e) => setCpName(e.target.value)}
                    placeholder="e.g. Ollama Local, Groq Custom, DeepInfra, Together"
                    className="w-full bg-transparent text-xs text-[#F5F5F5] placeholder:text-[#737373] outline-none"
                  />
                </div>
              </div>

              {/* Base URL Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#A3A3A3]">
                  Base URL / Chat Completion URL <span className="text-red-400">*</span>
                </label>
                <div className="relative flex items-center min-h-[42px] bg-[#131313] border border-[#292929] focus-within:border-[#383838] rounded-[14px] px-3 transition-colors">
                  <Globe className="size-4 text-[#737373] mr-2 shrink-0" />
                  <input
                    type="text"
                    value={cpBaseUrl}
                    onChange={(e) => setCpBaseUrl(e.target.value)}
                    placeholder="http://localhost:11434/v1 or https://api.groq.com/openai/v1"
                    className="w-full bg-transparent text-xs text-[#F5F5F5] placeholder:text-[#737373] outline-none"
                  />
                </div>
                <p className="text-[11px] text-[#737373]">
                  Accepts standard OpenAI-compatible endpoints or chat completion endpoints.
                </p>
              </div>

              {/* API Key Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[#A3A3A3]">
                  API Key <span className="text-[11px] text-[#737373]">(Optional for local endpoints)</span>
                </label>
                <div className="relative flex items-center min-h-[42px] bg-[#131313] border border-[#292929] focus-within:border-[#383838] rounded-[14px] px-3 transition-colors">
                  <Key className="size-4 text-[#737373] mr-2 shrink-0" />
                  <input
                    type={cpShowKey ? "text" : "password"}
                    value={cpApiKey}
                    onChange={(e) => setCpApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-transparent text-xs text-[#F5F5F5] placeholder:text-[#737373] outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setCpShowKey(!cpShowKey)}
                    className="text-[#737373] hover:text-[#F5F5F5] ml-2 shrink-0"
                  >
                    {cpShowKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              {/* Smart Auto-Discovery Section */}
              <div className="p-4 rounded-[18px] bg-[#131313] border border-[#292929] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="text-xs font-medium text-[#F5F5F5] flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-emerald-400" />
                      Smart Model Auto-Discovery
                    </span>
                    <p className="text-[11px] text-[#737373]">
                      Scan the base URL to discover available models automatically.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isDiscovering || !cpBaseUrl.trim()}
                    onClick={handleDiscoverModels}
                    className="px-3 py-1.5 rounded-[12px] bg-[#1D1D1D] hover:bg-[#252525] border border-[#383838] text-xs font-medium text-[#F5F5F5] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all shrink-0 active:scale-[0.97]"
                  >
                    {isDiscovering ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin text-emerald-400" />
                        <span>Searching...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-3.5 text-emerald-400" />
                        <span>Search Models</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Discovery Status Banner */}
                {discoveryStatus.type === "loading" && (
                  <div className="p-2.5 rounded-[12px] bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin shrink-0" />
                    <span>{discoveryStatus.message}</span>
                  </div>
                )}

                {discoveryStatus.type === "success" && (
                  <div className="p-2.5 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>{discoveryStatus.message}</span>
                  </div>
                )}

                {discoveryStatus.type === "error" && (
                  <div className="p-2.5 rounded-[12px] bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{discoveryStatus.message}</span>
                  </div>
                )}

                {/* Discovered Models Checkbox Selector */}
                {discoveredModels.length > 0 && (
                  <div className="space-y-2 pt-1 border-t border-[#222222]">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#A3A3A3]">
                        Select models to add ({selectedDiscoveredModels.size}/{discoveredModels.length}):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSelectAllDiscovered}
                          className="text-emerald-400 hover:underline"
                        >
                          Select all
                        </button>
                        <span className="text-[#383838]">•</span>
                        <button
                          type="button"
                          onClick={handleDeselectAllDiscovered}
                          className="text-[#737373] hover:text-[#A3A3A3]"
                        >
                          Deselect all
                        </button>
                      </div>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {discoveredModels.map((m) => {
                        const isSelected = selectedDiscoveredModels.has(m.id)
                        return (
                          <div
                            key={m.id}
                            onClick={() => handleToggleDiscoveredModel(m.id)}
                            className={`p-2 rounded-[10px] text-xs flex items-center justify-between cursor-pointer border transition-colors ${
                              isSelected
                                ? "bg-[#1D1D1D] border-emerald-500/30 text-emerald-300"
                                : "bg-[#171717] border-[#292929] text-[#737373] hover:text-[#A3A3A3]"
                            }`}
                          >
                            <span className="font-mono truncate">{m.id}</span>
                            <div
                              className={`size-4 rounded-[4px] border flex items-center justify-center shrink-0 ${
                                isSelected
                                  ? "bg-emerald-500 border-emerald-500 text-black"
                                  : "border-[#383838]"
                              }`}
                            >
                              {isSelected && <Check className="size-3" strokeWidth={3} />}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Manual Model Adder Fallback */}
              <div className="p-4 rounded-[18px] bg-[#131313] border border-[#292929] space-y-3">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-[#F5F5F5] flex items-center gap-1.5">
                    <Plus className="size-3.5 text-blue-400" />
                    Manual Model Adder
                  </span>
                  <p className="text-[11px] text-[#737373]">
                    Add specific model IDs if auto-discovery is unavailable or to include custom fine-tunes.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={manualModelInput}
                    onChange={(e) => setManualModelInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        handleAddManualModel()
                      }
                    }}
                    placeholder="e.g. llama3:8b, mistral-large, qwen2.5-coder-32b"
                    className="flex-1 bg-[#171717] border border-[#292929] focus:border-[#383838] rounded-[12px] px-3 py-2 text-xs text-[#F5F5F5] placeholder:text-[#737373] outline-none font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddManualModel}
                    className="px-3.5 py-2 rounded-[12px] bg-[#1D1D1D] hover:bg-[#252525] border border-[#383838] text-xs font-medium text-[#F5F5F5] hover:text-white transition-all shrink-0 active:scale-[0.97]"
                  >
                    Add
                  </button>
                </div>

                {/* Manually added chips */}
                {manualModels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {manualModels.map((m) => (
                      <span
                        key={m}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#1D1D1D] border border-blue-500/30 text-blue-300 text-xs font-mono"
                      >
                        <span>{m}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveManualModel(m)}
                          className="hover:text-white"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Staged Models Summary & Save Button */}
              <div className="pt-2 flex items-center justify-between border-t border-[#292929]">
                <div className="text-xs text-[#A3A3A3]">
                  Total Models Ready:{" "}
                  <span className="font-semibold text-[#F5F5F5]">{stagedModelsList.length}</span>
                </div>
                <button
                  type="button"
                  disabled={isSavingProvider || !cpName.trim() || !cpBaseUrl.trim() || stagedModelsList.length === 0}
                  onClick={handleSaveCustomProvider}
                  className="px-5 py-2.5 rounded-[14px] bg-[#F5F5F5] hover:bg-white text-[#131313] font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-[0.97]"
                >
                  {isSavingProvider ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="size-3.5" strokeWidth={2.5} />
                      <span>Save Provider & Add Models</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Tab 2: CONFIGURED SAVED PROVIDERS LIST */}
          {settingsTab === "saved" && (
            <div className="space-y-4">
              {savedProviders.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#737373] space-y-2">
                  <p>No custom providers configured yet.</p>
                  <button
                    type="button"
                    onClick={() => setSettingsTab("add")}
                    className="text-emerald-400 hover:underline"
                  >
                    Add your first custom provider
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {savedProviders.map((provider) => (
                    <div
                      key={provider.id || provider.provider}
                      className="p-4 rounded-[18px] bg-[#131313] border border-[#292929] space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5 min-w-0">
                          <h4 className="text-sm font-medium text-[#F5F5F5] truncate flex items-center gap-2">
                            <span>{provider.name}</span>
                            <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-[6px]">
                              Active
                            </span>
                          </h4>
                          <p className="text-xs text-[#737373] font-mono truncate">{provider.base_url}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteProvider(provider)}
                          title="Remove Provider"
                          className="flex size-8 items-center justify-center rounded-[8px] text-[#737373] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[11px] text-[#737373]">
                          Models ({provider.models?.length || 0}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {(provider.models || []).map((m) => (
                            <span
                              key={m}
                              className="px-2 py-0.5 rounded-[6px] bg-[#1D1D1D] border border-[#292929] text-[11px] font-mono text-[#A3A3A3]"
                            >
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* OPENROUTER-STYLE MODEL DETAILS INSPECTOR MODAL */}
      {inspectingModel && (
        <Dialog open={!!inspectingModel} onOpenChange={() => setInspectingModel(null)}>
          <DialogContent className="bg-[#171717] border border-[#292929] text-[#F5F5F5] max-w-lg rounded-[26px] p-6 shadow-2xl space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#292929] pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-11 shrink-0 flex items-center justify-center rounded-[14px] bg-[#1D1D1D] border border-[#222222]">
                  <ModelIcon provider={inspectingModel.provider} modelName={inspectingModel.name} size={24} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[#F5F5F5] truncate flex items-center gap-2">
                    <span className="truncate">{inspectingModel.name}</span>
                    {inspectingModel.is_custom && (
                      <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-[6px]">
                        Custom
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-[#737373] font-mono truncate">{inspectingModel.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setInspectingModel(null)}
                aria-label="Close"
                className="flex size-9 items-center justify-center rounded-[10px] text-[#737373] hover:text-[#F5F5F5] hover:bg-[#202020]"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-[#A3A3A3] leading-relaxed">
              {inspectingModel.description || `${inspectingModel.name} foundation AI model hosted via Vercel AI Gateway.`}
            </p>

            {/* Modalities & Capabilities Badges */}
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-[#737373]">Supported modalities</span>
              <div className="flex flex-wrap items-center gap-2">
                {getModalities(inspectingModel).map((mod) => {
                  const Icon = mod.icon
                  return (
                    <span
                      key={mod.label}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[10px] text-xs font-medium border border-[#292929] bg-[#1D1D1D] text-[#A3A3A3]"
                    >
                      <Icon className="size-3.5 text-[#737373]" strokeWidth={1.75} />
                      <span>{mod.label}</span>
                    </span>
                  )
                })}
              </div>
            </div>

            {/* OpenRouter Specifications Grid */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="p-3 rounded-[16px] bg-[#1D1D1D] border border-[#292929] space-y-1">
                <span className="text-[11px] text-[#737373] font-normal">Provider</span>
                <p className="text-xs font-medium text-[#F5F5F5] truncate">
                  {inspectingModel.providerDisplay || inspectingModel.provider}
                </p>
              </div>

              <div className="p-3 rounded-[16px] bg-[#1D1D1D] border border-[#292929] space-y-1">
                <span className="text-[11px] text-[#737373] font-normal">Context window</span>
                <p className="text-xs font-medium text-[#F5F5F5] font-mono">
                  {inspectingModel.context_window ? `${Math.round(inspectingModel.context_window / 1000)}k tokens` : "128k tokens"}
                </p>
              </div>

              <div className="p-3 rounded-[16px] bg-[#1D1D1D] border border-[#292929] space-y-1">
                <span className="text-[11px] text-[#737373] font-normal">Input pricing / 1M</span>
                <p className="text-xs font-medium text-[#F5F5F5] font-mono">
                  {inspectingModel.is_custom ? "Custom" : `$${inspectingModel.input_cost !== undefined ? inspectingModel.input_cost.toFixed(2) : "0.50"}`}
                </p>
              </div>

              <div className="p-3 rounded-[16px] bg-[#1D1D1D] border border-[#292929] space-y-1">
                <span className="text-[11px] text-[#737373] font-normal">Output pricing / 1M</span>
                <p className="text-xs font-medium text-[#F5F5F5] font-mono">
                  {inspectingModel.is_custom ? "Custom" : `$${inspectingModel.output_cost !== undefined ? inspectingModel.output_cost.toFixed(2) : "1.50"}`}
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={(e) => toggleStarModel(inspectingModel.id, e)}
                className={`min-h-[44px] px-3.5 rounded-[16px] text-xs font-medium flex items-center gap-1.5 transition-all border ${
                  starredModelIds.has(inspectingModel.id)
                    ? "bg-[#202020] border-[#383838] text-[#F5F5F5]"
                    : "bg-[#1D1D1D] border-[#292929] text-[#737373] hover:text-[#F5F5F5]"
                }`}
              >
                <Star className={`size-3.5 ${starredModelIds.has(inspectingModel.id) ? "fill-[#F5F5F5]" : ""}`} strokeWidth={1.75} />
                <span>{starredModelIds.has(inspectingModel.id) ? "Starred favorite" : "Add to favorites"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleSelectActiveModel(inspectingModel)
                  setInspectingModel(null)
                }}
                className="min-h-[44px] px-4 rounded-[16px] text-xs font-medium bg-[#F5F5F5] text-[#131313] hover:bg-white transition-all active:scale-[0.97]"
              >
                Set as active model
              </button>
            </div>
          </DialogContent>
        </Dialog>
      )}
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
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !min-h-[100dvh] !max-w-none !max-h-none !p-0 !gap-0 !rounded-none border-0 bg-[#131313] text-[#F5F5F5] shadow-none flex flex-col overflow-hidden font-sans z-[9999]"
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
