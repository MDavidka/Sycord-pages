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
  ChevronLeft,
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

// Pre-configured system providers (e.g. Vyce AI direct access)
export const DEFAULT_PRECONFIGURED_PROVIDERS: CustomProviderRecord[] = [
  {
    id: "cp_vyceai",
    name: "Vyce AI",
    provider: "vyceai",
    provider_type: "vyceai",
    base_url: "https://vyceai.com/v1",
    api_key: "sk-358124256568957fd788fcdb8c9eb7dd521989cfc12fc68e",
    api_key_masked: "sk-3...c68e",
    models: ["claude-sonnet-4-6", "deepseek-v4.1", "agnes-3.0-flash"],
    created_at: "2026-10-11T00:00:00.000Z",
  },
]

// TypingMind & LobeHub colored model icons catalog map
const TYPINGMIND_CDN_BASE = "https://raw.githubusercontent.com/TypingMind/model-icons/main/icons/"
const LOBEHUB_CDN_BASE = "https://unpkg.com/@lobehub/icons-static-svg@latest/icons/"

// Direct mapping to TypingMind color icons (PNG / JPG)
const TYPINGMIND_COLOR_MAP: Record<string, string> = {
  claude: "claude-color.jpg",
  anthropic: "claude-color.jpg",
  gemini: "gemini-color.jpg",
  google: "gemini-color.jpg",
  openai: "openai.svg",
  gpt: "openai.svg",
  "gpt-4": "gpt-4.webp",
  "gpt-3.5": "gpt-35.webp",
  mistral: "mistral-color.jpg",
  llama: "llama.png",
  meta: "llama.png",
  deepseek: "deepseek.png",
  qwen: "qwen2.png",
  alibaba: "qwen2.png",
  gemma: "gemma-color.jpg",
  perplexity: "perplexity-color.jpg",
  huggingface: "huggingface-color.jpg",
  replit: "replit-color.jpg",
  azure: "azureopenai.png",
  bing: "bing-color.jpg",
  pi: "pi-logo-192.png",
  llava: "llava-color.jpg",
  falcon: "falcon.png",
  vicuna: "vicuna.png",
  openrouter: "openrouterai.png",
  openassistant: "openassistant.webp",
  vyceai: "openai.svg",
  vyce: "openai.svg",
  agnes: "gemini-color.jpg",
}

const LOBEHUB_MAP: Record<string, string> = {
  ace: "ace",
  ai21: "ai21",
  anthropic: "claude-color",
  claude: "claude-color",
  aya: "aya",
  baichuan: "baichuan-color",
  chatglm: "chatglm-color",
  codegeex: "codegeex-color",
  cogvideo: "cogvideo-color",
  cogview: "cogview-color",
  "command-a": "command-a",
  codex: "codex",
  "dall-e": "dall-e",
  dbrx: "dbrx-color",
  "deep-cogito": "deep-cogito",
  deepseek: "deepseek-color",
  dolphin: "dolphin",
  doubao: "doubao-color",
  elevenlabs: "elevenlabs",
  "fish-audio": "fish-audio",
  flux: "flux",
  gemini: "gemini-color",
  google: "gemini-color",
  gemma: "gemma-color",
  "glm-v": "glm-v",
  grok: "grok",
  xai: "grok",
  hunyuan: "hunyuan-color",
  kimi: "kimi-color",
  kolors: "kolors-color",
  kwaipilot: "kwaipilot",
  liquid: "liquid",
  llava: "llava-color",
  longcat: "longcat",
  magic: "magic",
  minimax: "minimax-color",
  mistral: "mistral-color",
  morph: "morph",
  "nano-banana": "nano-banana",
  nova: "nova",
  openchat: "openchat",
  openai: "openai",
  palm: "palm-color",
  perplexity: "perplexity-color",
  phind: "phind",
  poolside: "poolside",
  qwen: "qwen-color",
  alibaba: "qwen-color",
  reka: "reka",
  rwkv: "rwkv-color",
  sora: "sora",
  spark: "spark-color",
  stepfun: "stepfun-color",
  voyage: "voyage",
  wenxin: "wenxin-color",
  "xiaomi-mimo": "xiaomi-mimo",
  xuanyuan: "xuanyuan",
  yi: "yi-color",
  ollama: "ollama",
  groq: "groq-color",
  together: "together-color",
  openrouter: "openrouter",
}

export function getTypingMindIconFile(brandOrModel: string): string | null {
  if (!brandOrModel) return null
  const k = brandOrModel.toLowerCase().trim()

  if (TYPINGMIND_COLOR_MAP[k]) return TYPINGMIND_COLOR_MAP[k]
  if (k.includes("claude") || k.includes("anthropic") || k.includes("sonnet") || k.includes("haiku") || k.includes("opus")) return "claude-color.jpg"
  if (k.includes("gemini") || k.includes("google") || k.includes("vertex")) return "gemini-color.jpg"
  if (k.includes("gemma")) return "gemma-color.jpg"
  if (k.includes("mistral") || k.includes("mixtral")) return "mistral-color.jpg"
  if (k.includes("llama") || k.includes("meta")) return "llama.png"
  if (k.includes("deepseek")) return "deepseek.png"
  if (k.includes("qwen") || k.includes("alibaba")) return "qwen2.png"
  if (k.includes("perplexity")) return "perplexity-color.jpg"
  if (k.includes("gpt-4")) return "gpt-4.webp"
  if (k.includes("gpt-3")) return "gpt-35.webp"
  if (k.includes("openai") || k.includes("gpt") || k.includes("chatgpt") || k.includes("o1") || k.includes("o3") || k.includes("o4")) return "openai.svg"
  if (k.includes("huggingface") || k.includes("hf")) return "huggingface-color.jpg"
  if (k.includes("replit")) return "replit-color.jpg"
  if (k.includes("bing")) return "bing-color.jpg"
  if (k.includes("llava")) return "llava-color.jpg"
  if (k.includes("agnes")) return "gemini-color.jpg"
  if (k.includes("vyce")) return "openai.svg"

  return null
}

export function getLobeHubIconKey(brandOrModel: string): string | null {
  if (!brandOrModel) return null
  const k = brandOrModel.toLowerCase().trim()

  if (LOBEHUB_MAP[k]) return LOBEHUB_MAP[k]

  if (k.includes("agnes")) return "gemini-color"
  if (k.includes("vyce")) return "openai"

  if (k.includes("claude") || k.includes("anthropic") || k.includes("sonnet") || k.includes("haiku") || k.includes("opus")) return "claude-color"
  if (k.includes("openai") || k.includes("gpt") || k.includes("chatgpt") || k.includes("o1") || k.includes("o3") || k.includes("o4")) return "openai"
  if (k.includes("gemini") || k.includes("google") || k.includes("vertex")) return "gemini-color"
  if (k.includes("gemma")) return "gemma-color"
  if (k.includes("deepseek")) return "deepseek-color"
  if (k.includes("qwen") || k.includes("alibaba")) return "qwen-color"
  if (k.includes("mistral")) return "mistral-color"
  if (k.includes("grok") || k.includes("xai")) return "grok"
  if (k.includes("flux")) return "flux"
  if (k.includes("dall-e") || k.includes("dalle") || k.includes("cogview") || k.includes("kolors")) return "dall-e"
  if (k.includes("sora") || k.includes("cogvideo")) return "sora"
  if (k.includes("minimax")) return "minimax-color"
  if (k.includes("perplexity")) return "perplexity-color"
  if (k.includes("stepfun")) return "stepfun-color"
  if (k.includes("yi")) return "yi-color"
  if (k.includes("baichuan")) return "baichuan-color"
  if (k.includes("doubao")) return "doubao-color"
  if (k.includes("kimi") || k.includes("moonshot")) return "kimi-color"
  if (k.includes("chatglm") || k.includes("glm") || k.includes("zhipu") || k.includes("zai")) return "chatglm-color"
  if (k.includes("codegeex")) return "codegeex-color"
  if (k.includes("command")) return "command-a"
  if (k.includes("codex")) return "codex"
  if (k.includes("dbrx")) return "dbrx-color"
  if (k.includes("elevenlabs")) return "elevenlabs"
  if (k.includes("nova")) return "nova"
  if (k.includes("phind")) return "phind"
  if (k.includes("voyage")) return "voyage"
  if (k.includes("wenxin") || k.includes("baidu")) return "wenxin-color"
  if (k.includes("hunyuan")) return "hunyuan-color"
  if (k.includes("ollama")) return "ollama"
  if (k.includes("groq")) return "groq-color"
  if (k.includes("together")) return "together-color"
  if (k.includes("openrouter")) return "openrouter"

  return null
}

// Provider icon abstraction fetching colorful icons from TypingMind & LobeHub
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
  const tmFile = getTypingMindIconFile(modelName || provider || "")
  const lobeKey = getLobeHubIconKey(provider || modelName || "")
  const [errorCount, setErrorCount] = useState(0)

  // Level 1: Try TypingMind colored icon
  if (tmFile && errorCount === 0) {
    const tmUrl = `${TYPINGMIND_CDN_BASE}${tmFile}`
    return (
      <img
        src={tmUrl}
        alt={provider || modelName || "Model provider"}
        width={size}
        height={size}
        onError={() => setErrorCount(1)}
        onClick={onClick}
        className={`object-contain rounded-[6px] inline-block shrink-0 transition-opacity ${onClick ? "cursor-pointer" : ""} ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  // Level 2: Try LobeHub color SVG icon
  if (lobeKey && errorCount <= 1) {
    const lobeUrl = `${LOBEHUB_CDN_BASE}${lobeKey}.svg`
    return (
      <img
        src={lobeUrl}
        alt={provider || modelName || "Model provider"}
        width={size}
        height={size}
        onError={() => setErrorCount(2)}
        onClick={onClick}
        className={`object-contain inline-block shrink-0 transition-opacity ${onClick ? "cursor-pointer" : ""} ${className}`}
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
  initialOpenCustomProvider?: boolean
  initialTab?: string
}

export function ModelBrowserView({
  onClose,
  selectedModel,
  onSelectModel,
  projectId = "global",
  isStandalone = false,
  initialOpenCustomProvider = false,
  initialTab = "All",
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
  const [activeTab, setActiveTab] = useState<string>(initialTab)
  const [searchQuery, setSearchQuery] = useState("")
  const [inspectingModel, setInspectingModel] = useState<OmniModelItem | null>(null)

  // Custom Provider & Settings State
  const [currentView, setCurrentView] = useState<"models" | "settings">(
    initialOpenCustomProvider ? "settings" : "models"
  )
  const [settingsTab, setSettingsTab] = useState<"add" | "saved">("add")
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1)
  const [userCredits, setUserCredits] = useState<{ credits: number; maxCredits: number; isPremium: boolean } | null>(null)
  const [creditsLoading, setCreditsLoading] = useState(false)
  const [savedProviders, setSavedProviders] = useState<CustomProviderRecord[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("sycord_custom_providers")
        if (cached) {
          const list: CustomProviderRecord[] = JSON.parse(cached)
          if (Array.isArray(list) && list.length > 0) {
            const hasVyce = list.some((p) => p.provider === "vyceai" || p.name === "Vyce AI")
            return hasVyce ? list : [...DEFAULT_PRECONFIGURED_PROVIDERS, ...list]
          }
        }
      } catch {}
    }
    return DEFAULT_PRECONFIGURED_PROVIDERS
  })
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

  // Fetch user credits
  const loadUserCredits = () => {
    setCreditsLoading(true)
    fetch("/api/user/credits", { headers: { credentials: "include" } })
      .then((r) => r.json())
      .then((data) => {
        if (data && typeof data.credits === "number") {
          setUserCredits({
            credits: data.credits,
            maxCredits: data.isPremium ? 200 : 10,
            isPremium: Boolean(data.isPremium),
          })
        }
      })
      .catch(() => {})
      .finally(() => setCreditsLoading(false))
  }

  // Load custom providers from backend / local storage
  const loadCustomProviders = () => {
    fetch("/api/ai/custom-providers")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.providers)) {
          const hasVyce = data.providers.some((p: any) => p.provider === "vyceai" || p.name === "Vyce AI")
          const merged = hasVyce ? data.providers : [...DEFAULT_PRECONFIGURED_PROVIDERS, ...data.providers]
          setSavedProviders(merged)
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("sycord_custom_providers", JSON.stringify(merged))
            } catch {}
          }
        }
      })
      .catch(() => {
        if (typeof window !== "undefined") {
          try {
            const cached = localStorage.getItem("sycord_custom_providers")
            if (cached) {
              const list = JSON.parse(cached)
              const hasVyce = list.some((p: any) => p.provider === "vyceai" || p.name === "Vyce AI")
              setSavedProviders(hasVyce ? list : [...DEFAULT_PRECONFIGURED_PROVIDERS, ...list])
            }
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

        // Ensure default Vyce AI models are always present
        const hasVyceModel = loadedModels.some((m) => m.provider === "vyceai" || m.id.includes("vyceai"))
        if (!hasVyceModel) {
          const vyceModels: OmniModelItem[] = [
            {
              id: "vyceai/claude-sonnet-4-6",
              name: "Claude Sonnet 4.6",
              provider: "vyceai",
              providerDisplay: "Vyce AI",
              provider_display: "Vyce AI",
              swe_score: 74,
              input_cost: 0.0,
              output_cost: 0.0,
              context_window: 270000,
              supports_vision: true,
              supports_tools: true,
              supports_reasoning: true,
              description: "Claude Sonnet 4.6 direct API endpoint via Vyce AI",
              is_active: false,
              is_custom: true,
              tags: ["custom", "vyceai", "claude"],
            },
            {
              id: "vyceai/deepseek-v4.1",
              name: "DeepSeek V4.1",
              provider: "vyceai",
              providerDisplay: "Vyce AI",
              provider_display: "Vyce AI",
              swe_score: 68,
              input_cost: 0.0,
              output_cost: 0.0,
              context_window: 270000,
              supports_vision: true,
              supports_tools: true,
              supports_reasoning: true,
              description: "DeepSeek V4.1 foundation reasoning endpoint via Vyce AI",
              is_active: false,
              is_custom: true,
              tags: ["custom", "vyceai", "deepseek"],
            },
            {
              id: "vyceai/agnes-3.0-flash",
              name: "Agnes 3.0 Flash",
              provider: "vyceai",
              providerDisplay: "Vyce AI",
              provider_display: "Vyce AI",
              swe_score: 63,
              input_cost: 0.0,
              output_cost: 0.0,
              context_window: 512000,
              supports_vision: true,
              supports_tools: true,
              supports_reasoning: true,
              description: "Agnes 3.0 Flash long-context endpoint via Vyce AI",
              is_active: false,
              is_custom: true,
              tags: ["custom", "vyceai", "agnes"],
            },
          ]
          loadedModels.unshift(...vyceModels)
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
    loadUserCredits()
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

    if (!Array.isArray(models)) return []

    const processed = models
      .filter((m): m is OmniModelItem => Boolean(m && (m.id || m.name)))
      .map((m) => {
        const mId = String(m.id || m.name || "").toLowerCase()
        let score = m.swe_score ?? m.swe_bench_score
        if (!score) {
          for (const [key, s] of Object.entries(defaultScores)) {
            if (mId.includes(key)) {
              score = s
              break
            }
          }
        }
        return {
          ...m,
          swe_score: score || Math.round(35 + ((m.id ? m.id.length : 5) * 3) % 35),
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
    if (!Array.isArray(models)) return false
    return models.some((m) => Boolean(m && (m.is_custom || (Array.isArray(m.tags) && m.tags.includes("custom")))))
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
    if (!Array.isArray(models)) return []
    let list = models.filter((m): m is OmniModelItem => Boolean(m && (m.id || m.name)))

    if (activeTab === "Starred") {
      list = list.filter((m) => m.id && starredModelIds.has(m.id))
    } else if (activeTab === "Anthropic") {
      list = list.filter((m) => (m.provider || "").toLowerCase().includes("anthropic") || (m.id || "").toLowerCase().includes("claude"))
    } else if (activeTab === "OpenAI") {
      list = list.filter((m) => {
        const p = (m.provider || "").toLowerCase()
        const id = (m.id || "").toLowerCase()
        return p.includes("openai") || id.includes("gpt") || id.includes("o1") || id.includes("o3")
      })
    } else if (activeTab === "Google") {
      list = list.filter((m) => (m.provider || "").toLowerCase().includes("google") || (m.id || "").toLowerCase().includes("gemini"))
    } else if (activeTab === "Open Source") {
      list = list.filter((m) => {
        const p = (m.provider || "").toLowerCase()
        const id = (m.id || "").toLowerCase()
        return p.includes("meta") || p.includes("mistral") || p.includes("deepseek") || p.includes("qwen") || id.includes("llama") || id.includes("qwen") || id.includes("deepseek")
      })
    } else if (activeTab === "Reasoning") {
      list = list.filter((m) => {
        const id = (m.id || "").toLowerCase()
        return m.supports_reasoning || id.includes("r1") || id.includes("o1") || id.includes("o3") || (m.swe_score ?? 0) > 40
      })
    } else if (activeTab === "Vision") {
      list = list.filter((m) => {
        const id = (m.id || "").toLowerCase()
        return m.supports_vision || m.supports_image || id.includes("vision") || id.includes("flux")
      })
    } else if (activeTab === "Custom") {
      list = list.filter((m) => m.is_custom || (Array.isArray(m.tags) && m.tags.includes("custom")))
    }

    const q = searchQuery.toLowerCase().trim()
    if (!q) return list

    return list.filter((m) => {
      const name = (m.name || "").toLowerCase()
      const id = (m.id || "").toLowerCase()
      const provider = (m.provider || "").toLowerCase()
      const providerDisplay = (m.providerDisplay || m.provider_display || "").toLowerCase()
      const description = (m.description || "").toLowerCase()

      return (
        name.includes(q) ||
        id.includes(q) ||
        provider.includes(q) ||
        providerDisplay.includes(q) ||
        description.includes(q)
      )
    })
  }, [models, activeTab, searchQuery, starredModelIds])

  const handleSelectActiveModel = (model: OmniModelItem) => {
    setActiveModelId(model.id)
    toast.success(`${model.name || model.id} set as active model`)

    // Hotpatch: sync selection with ModelEffortSelector and Chat
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("sycord_selected_model", String(model.id))
        window.dispatchEvent(
          new CustomEvent("sycord:model-selected", {
            detail: {
              modelId: model.id,
              modelName: model.name,
              provider: model.provider,
              model,
            },
          })
        )
      } catch {}
    }

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
  const handleDiscoverModels = async (overrideUrl?: string, overrideKey?: string) => {
    const targetUrl = (overrideUrl !== undefined ? overrideUrl : cpBaseUrl).trim()
    const targetKey = (overrideKey !== undefined ? overrideKey : cpApiKey).trim()

    if (!targetUrl) {
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
          base_url: targetUrl,
          api_key: targetKey,
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
        api_key: cpApiKey.trim(),
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
      setWizardStep(1)
      setCurrentView("models")
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

  const [showFilterPills, setShowFilterPills] = useState(false)

  return (
    <div className="w-full flex flex-col bg-[#161616] text-[#FFFFFF] select-none rounded-t-[28px] sm:rounded-[28px] border border-[#242424] shadow-2xl overflow-hidden max-h-[85vh] sm:max-h-[640px]">
      {/* Top Handle Bar */}
      <div className="pt-3 pb-1 flex justify-center shrink-0">
        <div className="w-9 h-1 rounded-full bg-[#383838]" />
      </div>

      {currentView === "models" ? (
        <>
          {/* Header section: Title + Subtitle */}
          <div className="px-5 pt-2 pb-3 shrink-0 flex items-start justify-between">
            <div className="space-y-0.5">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Select a model
              </h2>
              <p className="text-xs text-[#8C8C8C]">
                Choose the model for your next response.
              </p>
            </div>

            {/* Quick settings & provider config button with Lucide Setting icon */}
            <button
              type="button"
              onClick={() => setCurrentView("settings")}
              aria-label="Settings & Custom Providers"
              title="Settings, Credits & Add Model"
              className="flex size-9 items-center justify-center rounded-[12px] text-[#8C8C8C] hover:text-white bg-[#191919] hover:bg-[#1F1F1F] border border-[#242424] hover:border-[#333333] transition-colors relative active:scale-[0.97]"
            >
              <Settings className="size-4" strokeWidth={1.75} />
              {savedProviders.length > 0 && (
                <span className="absolute -top-1 -right-1 size-3.5 rounded-full bg-emerald-500 text-[8.5px] font-bold text-black flex items-center justify-center">
                  {savedProviders.length}
                </span>
              )}
            </button>
          </div>

          {/* Search Input Row with Filter Slider Button */}
          <div className="px-5 pb-3 shrink-0 space-y-2.5">
            <div className="flex items-center gap-2">
              {/* Search container */}
              <div className="flex-1 flex items-center bg-[#191919] border border-[#242424] focus-within:border-[#333333] rounded-[18px] px-3.5 h-11 transition-colors">
                <Search className="size-4 text-[#8C8C8C] shrink-0 mr-2.5" strokeWidth={1.75} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search models..."
                  className="w-full bg-transparent text-sm text-white placeholder:text-[#8C8C8C] outline-none"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="text-[#8C8C8C] hover:text-white shrink-0 p-1"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Filter button with sliders */}
              <button
                type="button"
                onClick={() => setShowFilterPills(!showFilterPills)}
                aria-label="Filter models"
                title="Filter by provider or category"
                className={`size-11 rounded-[18px] border flex items-center justify-center transition-all shrink-0 active:scale-[0.97] ${
                  showFilterPills || activeTab !== "All"
                    ? "bg-[#1F1F1F] border-[#333333] text-white"
                    : "bg-[#191919] border-[#242424] text-[#8C8C8C] hover:text-white hover:bg-[#1F1F1F]"
                }`}
              >
                <SlidersHorizontal className="size-4" strokeWidth={1.75} />
              </button>
            </div>

            {/* Collapsible Category Filter Pills */}
            {showFilterPills && (
              <div className="flex items-center gap-1.5 overflow-x-auto pt-1 pb-1 scrollbar-none animate-in fade-in slide-in-from-top-1 duration-150">
                {filterTabs.map((tab) => {
                  const isSelected = activeTab === tab
                  return (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={`h-7 px-2.5 rounded-[10px] text-[11px] font-medium transition-all shrink-0 flex items-center gap-1.5 active:scale-[0.97] ${
                        isSelected
                          ? "bg-white text-black font-semibold"
                          : "bg-[#191919] text-[#8C8C8C] hover:text-white border border-[#242424]"
                      }`}
                    >
                      {tab === "Starred" && (
                        <Star
                          className={`size-3 ${isSelected ? "fill-black text-black" : "fill-[#8C8C8C] text-[#8C8C8C]"}`}
                        />
                      )}
                      {tab === "Custom" && (
                        <Sparkles className={`size-3 ${isSelected ? "text-black" : "text-emerald-400"}`} />
                      )}
                      <span>{tab}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Model Cards List (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 pb-8 sm:pb-5 space-y-2.5">
            {loading && models.length === 0 ? (
              <div className="space-y-2.5 animate-pulse">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 rounded-[18px] bg-[#191919] border border-[#242424]" />
                ))}
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#8C8C8C] space-y-3">
                <p>No models found matching your search.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSettingsTab("add")
                    setCurrentView("settings")
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-[#191919] border border-[#242424] text-xs font-medium text-white hover:border-[#333333]"
                >
                  <Plus className="size-3.5 text-emerald-400" />
                  <span>Add Custom Provider & Model</span>
                </button>
              </div>
            ) : (
              filteredModels.map((model) => {
                const isActive = activeModelId === model.id
                const inCost = model.input_cost !== undefined ? `$${model.input_cost.toFixed(2)}` : "$0.50"
                const outCost = model.output_cost !== undefined ? `$${model.output_cost.toFixed(2)}` : "$1.50"

                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectActiveModel(model)}
                    className={`w-full rounded-[18px] p-3 sm:px-4 sm:py-3.5 flex items-center justify-between gap-3 transition-all border cursor-pointer group active:scale-[0.99] ${
                      isActive
                        ? "bg-[#1F1F1F] border-[#333333]"
                        : "bg-[#191919] hover:bg-[#1F1F1F] border-[#242424] hover:border-[#333333]"
                    }`}
                  >
                    {/* Left: Model brand icon + Title & Subtitle */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-10 shrink-0 flex items-center justify-center rounded-[12px] bg-[#222222] border border-[#2A2A2A]">
                        <ModelIcon provider={model.provider} modelName={model.name} size={22} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate group-hover:text-white transition-colors">
                          {model.name}
                        </div>
                        <div className="text-xs text-[#8C8C8C] truncate mt-0.5">
                          {model.providerDisplay || model.provider_display || model.provider || "Anthropic"}
                        </div>
                      </div>
                    </div>

                    {/* Right: Pricing lines + Radio button indicator */}
                    <div className="flex items-center gap-3.5 shrink-0">
                      <div className="text-right text-[11px] leading-tight text-[#8C8C8C] font-mono tabular-nums">
                        <div>{model.is_custom ? "Custom" : `${inCost} input /`}</div>
                        <div>{model.is_custom ? "Endpoint" : `${outCost} output`}</div>
                      </div>

                      {/* Radio Indicator */}
                      <div
                        className={`size-5 rounded-full flex items-center justify-center transition-colors border ${
                          isActive
                            ? "border-white bg-white"
                            : "border-[#444444] bg-transparent group-hover:border-[#666666]"
                        }`}
                      >
                        {isActive && (
                          <div className="size-2 rounded-full bg-[#111111]" />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </>
      ) : (
        <>
          {/* Header section with Back Button */}
          <div className="px-5 pt-2 pb-3 shrink-0 flex items-center justify-between border-b border-[#242424]">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setCurrentView("models")}
                aria-label="Back to models"
                title="Back to models"
                className="flex size-8 items-center justify-center rounded-[10px] text-[#8C8C8C] hover:text-white bg-[#191919] hover:bg-[#1F1F1F] border border-[#242424] hover:border-[#333333] transition-colors active:scale-[0.97]"
              >
                <ChevronLeft className="size-4" strokeWidth={2} />
              </button>
              <div>
                <h2 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
                  <span>Provider Settings</span>
                </h2>
                <p className="text-xs text-[#8C8C8C]">
                  Account balance & custom endpoints
                </p>
              </div>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-8 items-center justify-center rounded-[10px] text-[#8C8C8C] hover:text-white bg-[#191919] hover:bg-[#1F1F1F] border border-[#242424] transition-colors"
              >
                <X className="size-4" strokeWidth={1.75} />
              </button>
            )}
          </div>

          {/* Scrollable Settings / Onboarding Content */}
          <div className="flex-1 overflow-y-auto px-5 pt-4 pb-8 sm:pb-4 space-y-4">
            {/* Account Credits Balance Section */}
            <div className="p-4 rounded-[18px] bg-[#191919] border border-[#242424] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-[12px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                  <Coins className="size-5" />
                </div>
                <div className="space-y-0.5">
                  <div className="text-xs font-medium text-[#8C8C8C]">Available Balance</div>
                  <div className="text-lg font-semibold text-white flex items-center gap-2">
                    <span>{userCredits !== null ? `${userCredits.credits} Credits` : creditsLoading ? "Loading..." : "5 Credits"}</span>
                    {userCredits?.isPremium && (
                      <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-[6px]">
                        PRO
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={loadUserCredits}
                disabled={creditsLoading}
                title="Refresh credits balance"
                className="flex size-9 items-center justify-center rounded-[10px] bg-[#1F1F1F] hover:bg-[#252525] border border-[#292929] text-[#8C8C8C] hover:text-white transition-all disabled:opacity-50"
              >
                <RefreshCw className={`size-4 ${creditsLoading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Navigation Tabs (Add New vs Saved Providers) */}
            <div className="flex items-center gap-2 border-b border-[#242424] pb-3">
              <button
                type="button"
                onClick={() => setSettingsTab("add")}
                className={`px-3.5 py-1.5 rounded-[12px] text-xs font-medium transition-all ${
                  settingsTab === "add"
                    ? "bg-white text-black font-semibold"
                    : "bg-[#191919] text-[#8C8C8C] hover:text-white border border-[#242424]"
                }`}
              >
                Add Custom Model / Provider
              </button>
              <button
                type="button"
                onClick={() => setSettingsTab("saved")}
                className={`px-3.5 py-1.5 rounded-[12px] text-xs font-medium transition-all flex items-center gap-1.5 ${
                  settingsTab === "saved"
                    ? "bg-white text-black font-semibold"
                    : "bg-[#191919] text-[#8C8C8C] hover:text-white border border-[#242424]"
                }`}
              >
                <span>Configured Providers</span>
                <span className="text-[10px] bg-[#292929] px-1.5 py-0.5 rounded-full text-[#8C8C8C]">
                  {savedProviders.length}
                </span>
              </button>
            </div>

            {/* Tab 1: ADD CUSTOM PROVIDER WIZARD (1 Input Per Page) */}
            {settingsTab === "add" && (
              <div className="space-y-4">
                {/* Stepper Progress Header */}
                <div className="flex items-center justify-between pb-3 border-b border-[#242424]">
                  <div className="flex items-center gap-2">
                    {[
                      { step: 1, label: "Name" },
                      { step: 2, label: "URL" },
                      { step: 3, label: "API Key" },
                      { step: 4, label: "Models" },
                    ].map((s) => {
                      const isActive = wizardStep === s.step
                      const isDone = wizardStep > s.step
                      return (
                        <div key={s.step} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (isDone || (s.step === 2 && cpName.trim()) || (s.step === 3 && cpBaseUrl.trim())) {
                                setWizardStep(s.step as any)
                              }
                            }}
                            className={`flex items-center justify-center size-6 rounded-full text-[11px] font-semibold transition-all ${
                              isActive
                                ? "bg-white text-black ring-2 ring-white/30"
                                : isDone
                                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                                : "bg-[#1C1C1C] text-[#666666] border border-[#2B2B2B]"
                            }`}
                          >
                            {isDone ? <Check className="size-3" strokeWidth={2.5} /> : s.step}
                          </button>
                          <span className={`text-[11px] font-medium hidden xs:inline ${isActive ? "text-white" : "text-[#737373]"}`}>
                            {s.label}
                          </span>
                          {s.step < 4 && <div className="w-3 h-px bg-[#2E2E2E] mx-0.5" />}
                        </div>
                      )
                    })}
                  </div>
                  <span className="text-[11px] text-[#737373] font-mono">
                    Step {wizardStep} of 4
                  </span>
                </div>

                {/* STEP 1: PROVIDER NAME */}
                {wizardStep === 1 && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">Provider Name</h4>
                      <p className="text-xs text-[#8C8C8C]">
                        Choose a name for your custom AI provider or select a preset.
                      </p>
                    </div>

                    <div className="relative flex items-center min-h-[46px] bg-[#191919] border border-[#242424] focus-within:border-[#383838] rounded-[14px] px-3.5 transition-colors">
                      <Server className="size-4 text-[#8C8C8C] mr-2.5 shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={cpName}
                        onChange={(e) => setCpName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && cpName.trim()) {
                            e.preventDefault()
                            setWizardStep(2)
                          }
                        }}
                        placeholder="e.g. Vyce AI, Ollama Local, Groq, Together AI"
                        className="w-full bg-transparent text-xs text-white placeholder:text-[#666666] outline-none font-medium"
                      />
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="space-y-1.5 pt-1">
                      <span className="text-[11px] text-[#737373]">Quick presets:</span>
                      <div className="flex flex-wrap gap-2">
                        {[
                          { name: "Vyce AI", url: "https://vyceai.com/v1" },
                          { name: "Ollama (Local)", url: "http://localhost:11434/v1" },
                          { name: "Groq", url: "https://api.groq.com/openai/v1" },
                          { name: "Together AI", url: "https://api.together.xyz/v1" },
                          { name: "DeepInfra", url: "https://api.deepinfra.com/v1/openai" },
                        ].map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setCpName(preset.name)
                              setCpBaseUrl(preset.url)
                              setWizardStep(2)
                            }}
                            className="px-2.5 py-1 rounded-[10px] bg-[#1A1A1A] hover:bg-[#222222] border border-[#2A2A2A] text-[11px] text-[#A3A3A3] hover:text-white transition-colors"
                          >
                            + {preset.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end pt-3 border-t border-[#242424]">
                      <button
                        type="button"
                        disabled={!cpName.trim()}
                        onClick={() => setWizardStep(2)}
                        className="px-5 py-2.5 rounded-[14px] bg-white hover:bg-[#EAEAEA] text-black font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-[0.97]"
                      >
                        <span>Next: Endpoint URL</span>
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 2: BASE URL */}
                {wizardStep === 2 && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">Base URL / Endpoint</h4>
                      <p className="text-xs text-[#8C8C8C]">
                        Enter the OpenAI-compatible base URL or chat completion endpoint.
                      </p>
                    </div>

                    <div className="relative flex items-center min-h-[46px] bg-[#191919] border border-[#242424] focus-within:border-[#383838] rounded-[14px] px-3.5 transition-colors">
                      <Globe className="size-4 text-[#8C8C8C] mr-2.5 shrink-0" />
                      <input
                        type="text"
                        autoFocus
                        value={cpBaseUrl}
                        onChange={(e) => setCpBaseUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && cpBaseUrl.trim()) {
                            e.preventDefault()
                            setWizardStep(3)
                          }
                        }}
                        placeholder="https://vyceai.com/v1 or http://localhost:11434/v1"
                        className="w-full bg-transparent text-xs text-white placeholder:text-[#666666] outline-none font-mono"
                      />
                    </div>

                    <p className="text-[11px] text-[#737373]">
                      Standard endpoints like <code className="text-[#A3A3A3]">/v1</code>, <code className="text-[#A3A3A3]">/v1/chat/completions</code>, or host root are accepted.
                    </p>

                    <div className="flex items-center justify-between pt-3 border-t border-[#242424]">
                      <button
                        type="button"
                        onClick={() => setWizardStep(1)}
                        className="px-4 py-2.5 rounded-[14px] bg-[#1F1F1F] hover:bg-[#252525] border border-[#2E2E2E] text-white text-xs font-medium transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        disabled={!cpBaseUrl.trim()}
                        onClick={() => setWizardStep(3)}
                        className="px-5 py-2.5 rounded-[14px] bg-white hover:bg-[#EAEAEA] text-black font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-[0.97]"
                      >
                        <span>Next: API Key</span>
                        <ChevronRight className="size-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 3: API KEY */}
                {wizardStep === 3 && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-white">API Key</h4>
                      <p className="text-xs text-[#8C8C8C]">
                        Enter your authorization key (leave blank for local Ollama / non-authenticated endpoints).
                      </p>
                    </div>

                    <div className="relative flex items-center min-h-[46px] bg-[#191919] border border-[#242424] focus-within:border-[#383838] rounded-[14px] px-3.5 transition-colors">
                      <Key className="size-4 text-[#8C8C8C] mr-2.5 shrink-0" />
                      <input
                        type={cpShowKey ? "text" : "password"}
                        autoFocus
                        value={cpApiKey}
                        onChange={(e) => setCpApiKey(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            setWizardStep(4)
                            handleDiscoverModels(cpBaseUrl, cpApiKey)
                          }
                        }}
                        placeholder="sk-... or authorization token"
                        className="w-full bg-transparent text-xs text-white placeholder:text-[#666666] outline-none font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setCpShowKey(!cpShowKey)}
                        className="text-[#8C8C8C] hover:text-white ml-2 shrink-0 p-1"
                      >
                        {cpShowKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-[#242424]">
                      <button
                        type="button"
                        onClick={() => setWizardStep(2)}
                        className="px-4 py-2.5 rounded-[14px] bg-[#1F1F1F] hover:bg-[#252525] border border-[#2E2E2E] text-white text-xs font-medium transition-all"
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setWizardStep(4)
                          handleDiscoverModels(cpBaseUrl, cpApiKey)
                        }}
                        className="px-5 py-2.5 rounded-[14px] bg-white hover:bg-[#EAEAEA] text-black font-semibold text-xs transition-all flex items-center gap-2 active:scale-[0.97]"
                      >
                        <Sparkles className="size-3.5 text-black" />
                        <span>Auto-Fetch Models →</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* STEP 4: AUTO FETCH MODELS (WITH MANUAL INPUT BAR FALLBACK) */}
                {wizardStep === 4 && (
                  <div className="space-y-4 py-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                          <Sparkles className="size-4 text-emerald-400" />
                          Fetch Models for {cpName || "Provider"}
                        </h4>
                        <p className="text-xs text-[#8C8C8C]">
                          Auto-fetching models from endpoint. If not possible, use manual input bar below.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={isDiscovering}
                        onClick={() => handleDiscoverModels(cpBaseUrl, cpApiKey)}
                        className="px-3 py-1.5 rounded-[12px] bg-[#1F1F1F] hover:bg-[#252525] border border-[#2D2D2D] text-xs font-medium text-white disabled:opacity-50 flex items-center gap-1.5 transition-all shrink-0 active:scale-[0.97]"
                      >
                        {isDiscovering ? (
                          <>
                            <Loader2 className="size-3.5 animate-spin text-emerald-400" />
                            <span>Fetching...</span>
                          </>
                        ) : (
                          <>
                            <RefreshCw className="size-3.5 text-emerald-400" />
                            <span>Retry Auto-Fetch</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Discovery Status Banner */}
                    {discoveryStatus.type === "loading" && (
                      <div className="p-3 rounded-[14px] bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs flex items-center gap-2.5">
                        <Loader2 className="size-4 animate-spin shrink-0" />
                        <span>{discoveryStatus.message}</span>
                      </div>
                    )}

                    {discoveryStatus.type === "success" && (
                      <div className="p-3 rounded-[14px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2.5">
                        <CheckCircle2 className="size-4 shrink-0" />
                        <span>{discoveryStatus.message}</span>
                      </div>
                    )}

                    {discoveryStatus.type === "error" && (
                      <div className="p-3 rounded-[14px] bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2.5">
                        <AlertCircle className="size-4 shrink-0" />
                        <span>{discoveryStatus.message}</span>
                      </div>
                    )}

                    {/* Discovered Models Checkbox Selector */}
                    {discoveredModels.length > 0 && (
                      <div className="p-3.5 rounded-[18px] bg-[#191919] border border-[#242424] space-y-2.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-[#8C8C8C]">
                            Auto-discovered ({selectedDiscoveredModels.size}/{discoveredModels.length}):
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
                              className="text-[#8C8C8C] hover:text-white"
                            >
                              Deselect all
                            </button>
                          </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
                          {discoveredModels.map((m) => {
                            const isSelected = selectedDiscoveredModels.has(m.id)
                            return (
                              <div
                                key={m.id}
                                onClick={() => handleToggleDiscoveredModel(m.id)}
                                className={`p-2.5 rounded-[12px] text-xs flex items-center justify-between cursor-pointer border transition-colors ${
                                  isSelected
                                    ? "bg-[#222222] border-emerald-500/30 text-emerald-300"
                                    : "bg-[#161616] border-[#242424] text-[#8C8C8C] hover:text-white"
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

                    {/* Manual Model Input Bar Fallback / Addon */}
                    <div className="p-3.5 rounded-[18px] bg-[#191919] border border-[#242424] space-y-2.5">
                      <div className="space-y-0.5">
                        <span className="text-xs font-medium text-white flex items-center gap-1.5">
                          <Plus className="size-3.5 text-blue-400" />
                          Manual Model Input Bar
                        </span>
                        <p className="text-[11px] text-[#8C8C8C]">
                          If auto-fetch is not possible or missing models, type model IDs manually.
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
                          placeholder="e.g. claude-sonnet-4-6, deepseek-v4.1, agnes-3.0-flash"
                          className="flex-1 bg-[#161616] border border-[#242424] focus:border-[#333333] rounded-[12px] px-3 py-2 text-xs text-white placeholder:text-[#666666] outline-none font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleAddManualModel}
                          className="px-3.5 py-2 rounded-[12px] bg-[#1F1F1F] hover:bg-[#252525] border border-[#2D2D2D] text-xs font-medium text-white transition-all shrink-0 active:scale-[0.97]"
                        >
                          Add
                        </button>
                      </div>

                      {manualModels.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {manualModels.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[8px] bg-[#1F1F1F] border border-blue-500/30 text-blue-300 text-xs font-mono"
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

                    {/* Footer with Back & Save */}
                    <div className="pt-2 flex items-center justify-between border-t border-[#242424]">
                      <button
                        type="button"
                        onClick={() => setWizardStep(3)}
                        className="px-4 py-2.5 rounded-[14px] bg-[#1F1F1F] hover:bg-[#252525] border border-[#2E2E2E] text-white text-xs font-medium transition-all"
                      >
                        Back
                      </button>

                      <div className="flex items-center gap-3">
                        <span className="text-xs text-[#8C8C8C] hidden sm:inline">
                          Ready: <strong className="text-white">{stagedModelsList.length}</strong> models
                        </span>
                        <button
                          type="button"
                          disabled={isSavingProvider || !cpName.trim() || !cpBaseUrl.trim() || stagedModelsList.length === 0}
                          onClick={handleSaveCustomProvider}
                          className="px-5 py-2.5 rounded-[14px] bg-white hover:bg-[#EAEAEA] text-black font-semibold text-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 active:scale-[0.97]"
                        >
                          {isSavingProvider ? (
                            <>
                              <Loader2 className="size-3.5 animate-spin" />
                              <span>Saving...</span>
                            </>
                          ) : (
                            <>
                              <Check className="size-3.5" strokeWidth={2.5} />
                              <span>Save Provider & Add Models ({stagedModelsList.length})</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: CONFIGURED SAVED PROVIDERS LIST */}
            {settingsTab === "saved" && (
              <div className="space-y-4">
                {savedProviders.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#8C8C8C] space-y-2">
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
                        className="p-4 rounded-[18px] bg-[#191919] border border-[#242424] space-y-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-0.5 min-w-0">
                            <h4 className="text-sm font-medium text-white truncate flex items-center gap-2">
                              <span>{provider.name}</span>
                              <span className="text-[9px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-[6px]">
                                Active
                              </span>
                            </h4>
                            <p className="text-xs text-[#8C8C8C] font-mono truncate">{provider.base_url}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteProvider(provider)}
                            title="Remove Provider"
                            className="flex size-8 items-center justify-center rounded-[8px] text-[#8C8C8C] hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>

                        <div className="space-y-1.5">
                          <span className="text-[11px] text-[#8C8C8C]">
                            Models ({provider.models?.length || 0}):
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(provider.models || []).map((m) => (
                              <span
                                key={m}
                                className="px-2 py-0.5 rounded-[6px] bg-[#161616] border border-[#242424] text-[11px] font-mono text-[#8C8C8C]"
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
          </div>
        </>
      )}

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
  initialOpenCustomProvider?: boolean
  initialTab?: string
}

export function SycordOmniRouterModal({
  open,
  onOpenChange,
  selectedModel,
  onSelectModel,
  projectId = "global",
  initialOpenCustomProvider = false,
  initialTab = "All",
}: SycordOmniRouterModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="!bg-transparent data-[state=open]:!bg-transparent !backdrop-blur-none"
        className="!p-0 !gap-0 !bg-transparent !border-0 !shadow-none !w-full !max-w-full sm:!max-w-lg !fixed !inset-x-0 !bottom-0 !top-auto !left-0 !right-0 !translate-x-0 !translate-y-0 sm:!inset-auto sm:!top-1/2 sm:!left-1/2 sm:!bottom-auto sm:!right-auto sm:!-translate-x-1/2 sm:!-translate-y-1/2 z-[9999] rounded-t-[28px] sm:rounded-[28px] overflow-hidden"
        showCloseButton={false}
      >
        <ModelBrowserView
          onClose={() => onOpenChange(false)}
          selectedModel={selectedModel}
          onSelectModel={onSelectModel}
          projectId={projectId}
          initialOpenCustomProvider={initialOpenCustomProvider}
          initialTab={initialTab}
        />
      </DialogContent>
    </Dialog>
  )
}
