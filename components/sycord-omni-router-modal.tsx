"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Search,
  Check,
  Sparkles,
  ExternalLink,
  ChevronRight,
  SlidersHorizontal,
  X,
  Menu,
  Coins,
  FileText,
  Image as ImageIcon,
  Video,
  Layers,
} from "lucide-react"

// Model Interface strictly matching the Sycord AI Router
export interface OmniModelItem {
  id: string
  name: string
  provider: string
  providerDisplay?: string
  swe_bench_score?: number
  swe_score?: number
  input_cost?: number
  output_cost?: number
  context_window?: number
  latency_tier?: string
  supports_vision?: boolean
  supports_tools?: boolean
  supports_cache?: boolean
  supports_video?: boolean
  supports_reasoning?: boolean
  description?: string
  is_active?: boolean
  rank?: number
}

// Brand SVG logos strictly from svgl.app & standard provider brands
export function BrandLogo({ brand, size = 20, className = "" }: { brand: string; size?: number; className?: string }) {
  const key = (brand || "").toLowerCase().trim()

  // Google / Gemini
  if (key.includes("google") || key.includes("gemini") || key.includes("vertex") || key.includes("gemma")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
        <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
        <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
        <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
      </svg>
    )
  }

  // Anthropic / Claude
  if (key.includes("anthropic") || key.includes("claude") || key.includes("sonnet") || key.includes("opus") || key.includes("haiku") || key.includes("fable")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#D97706" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M17.472 3.667h-3.874L20.89 20.333h3.874L17.472 3.667zm-10.944 0L0 20.333h3.874l1.658-4.482h6.988l1.658 4.482h3.874L11.528 3.667H6.528zm.972 9.074l2.028-5.482 2.028 5.482H7.5z" />
      </svg>
    )
  }

  // OpenAI / GPT
  if (key.includes("openai") || key.includes("gpt") || key.includes("o3") || key.includes("o1")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.307 15.356l-2.02-1.164a.08.08 0 0 1-.038-.057V8.552a4.5 4.5 0 0 1 7.37-3.454l-.142.08-4.778 2.758a.795.795 0 0 0-.392.681zm1.092-2.58l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z" />
      </svg>
    )
  }

  // Mistral
  if (key.includes("mistral")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#FF7000" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M3 3h3.6v3.6H3V3zm14.4 0H21v3.6h-3.6V3zM3 10.2h3.6v3.6H3v-3.6zm7.2 0h3.6v3.6h-3.6v-3.6zm7.2 0H21v3.6h-3.6v-3.6zM3 17.4h3.6V21H3v-3.6zm7.2 0h3.6V21h-3.6v-3.6zm7.2 0H21V21h-3.6v-3.6z" />
      </svg>
    )
  }

  // Meta / Llama
  if (key.includes("meta") || key.includes("llama")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#0668E1" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M12 4.5c-4.142 0-7.5 3.358-7.5 7.5 0 2.22 1.01 4.195 2.586 5.514-.035-.558.077-1.127.354-1.632.748-1.365 2.378-2.632 4.56-2.632 2.183 0 3.813 1.267 4.561 2.632.277.505.389 1.074.354 1.632C18.49 16.195 19.5 14.22 19.5 12c0-4.142-3.358-7.5-7.5-7.5zm-5.068 13.978C5.088 17.158 4 14.73 4 12c0-4.418 3.582-8 8-8s8 3.582 8 8c0 2.73-1.088 5.158-2.932 6.478-.125-.436-.347-.847-.668-1.206-.925-1.034-2.38-1.772-4.4-1.772s-3.475.738-4.4 1.772c-.321.359-.543.77-.668 1.206z" />
      </svg>
    )
  }

  // Cohere
  if (key.includes("cohere") || key.includes("command")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path fill="#39594C" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5c-2.48 0-4.5-2.02-4.5-4.5S8.52 7.5 11 7.5s4.5 2.02 4.5 4.5-2.02 4.5-4.5 4.5z" />
        <circle cx="15.5" cy="14.5" r="3.5" fill="#D29A88" />
      </svg>
    )
  }

  // xAI / Grok
  if (key.includes("xai") || key.includes("grok")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }

  // DeepSeek
  if (key.includes("deepseek")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.93V18c0 .55-.45 1-1 1s-1-.45-1-1v-1.07c-2.83-.48-5-2.94-5-5.93 0-.55.45-1 1-1s1 .45 1 1c0 2.21 1.79 4 4 4s4-1.79 4-4c0-.55.45-1 1-1s1 .45 1 1c0 2.99-2.17 5.45-5 5.93zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z" />
      </svg>
    )
  }

  // Qwen / Alibaba
  if (key.includes("qwen") || key.includes("alibaba")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#6366F1" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 14.1l-4.8 2.5.9-5.3-3.8-3.7 5.3-.8L12 2zm0 6.5l-1.3 2.6-2.9.4 2.1 2-.5 2.9 2.6-1.4 2.6 1.4-.5-2.9 2.1-2-2.9-.4L12 8.5z" />
      </svg>
    )
  }

  // Microsoft / Phi
  if (key.includes("microsoft") || key.includes("phi")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <rect x="2" y="2" width="9" height="9" fill="#F25022" />
        <rect x="13" y="2" width="9" height="9" fill="#7FBA00" />
        <rect x="2" y="13" width="9" height="9" fill="#00A4EF" />
        <rect x="13" y="13" width="9" height="9" fill="#FFB900" />
      </svg>
    )
  }

  return <Sparkles className={`w-4 h-4 text-zinc-400 ${className}`} />
}

// Fallback image-accurate model list
const DEFAULT_IMAGE_MODELS: OmniModelItem[] = [
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    provider: "OpenAI",
    input_cost: 10.0,
    output_cost: 30.0,
    context_window: 128000,
    supports_vision: true,
    swe_bench_score: 72.0,
    rank: 1,
  },
  {
    id: "claude-3-5-sonnet",
    name: "Claude 3.5 Sonnet",
    provider: "Anthropic",
    input_cost: 3.0,
    output_cost: 15.0,
    context_window: 200000,
    supports_vision: true,
    swe_bench_score: 70.3,
    rank: 2,
  },
  {
    id: "gemini-1-5-pro",
    name: "Gemini 1.5 Pro",
    provider: "Google",
    input_cost: 0.75,
    output_cost: 4.5,
    context_window: 1000000,
    supports_vision: true,
    supports_video: true,
    swe_bench_score: 64.0,
    rank: 3,
  },
  {
    id: "mistral-medium-3-5",
    name: "Mistral Medium 3.5",
    provider: "Mistral",
    input_cost: 1.5,
    output_cost: 7.5,
    context_window: 256600,
    supports_vision: true,
  },
  {
    id: "llama-3-1-70b",
    name: "Llama 3.1 70B",
    provider: "Meta",
    input_cost: 0.7,
    output_cost: 0.9,
    context_window: 128000,
  },
  {
    id: "command-r-plus",
    name: "Command R+",
    provider: "Cohere",
    input_cost: 3.0,
    output_cost: 15.0,
    context_window: 128000,
    supports_vision: true,
  },
  {
    id: "grok-2",
    name: "Grok 2",
    provider: "xAI",
    input_cost: 5.0,
    output_cost: 15.0,
    context_window: 128000,
    supports_vision: true,
  },
  {
    id: "deepseek-v3",
    name: "DeepSeek V3",
    provider: "DeepSeek",
    input_cost: 0.27,
    output_cost: 1.1,
    context_window: 128000,
  },
  {
    id: "qwen-2-5-72b",
    name: "Qwen 2.5 72B",
    provider: "Alibaba",
    input_cost: 0.35,
    output_cost: 1.2,
    context_window: 128000,
    supports_vision: true,
  },
  {
    id: "phi-3-medium",
    name: "Phi 3 Medium",
    provider: "Microsoft",
    input_cost: 0.15,
    output_cost: 0.6,
    context_window: 128000,
  },
  {
    id: "gemini-1-5-flash",
    name: "Gemini 1.5 Flash",
    provider: "Google",
    input_cost: 0.075,
    output_cost: 0.3,
    context_window: 1000000,
    supports_vision: true,
    supports_video: true,
  },
  {
    id: "fable-5-1",
    name: "Fable 5.1",
    provider: "Anthropic",
    input_cost: 10.0,
    output_cost: 50.0,
    context_window: 1000000,
    supports_vision: true,
  },
]

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
}: SycordOmniRouterModalProps) {
  const [models, setModels] = useState<OmniModelItem[]>(DEFAULT_IMAGE_MODELS)
  const [activeModelId, setActiveModelId] = useState<string>(selectedModel || "gpt-4-turbo")
  const [userCredits, setUserCredits] = useState<number>(5.0)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedProviderFilter, setSelectedProviderFilter] = useState<string>("All")
  const [sortField, setSortField] = useState<"input" | "output" | null>(null)
  const [sortAsc, setSortAsc] = useState<boolean>(true)

  // Fetch live models if available
  useEffect(() => {
    if (!open) return
    let active = true

    fetch(`/api/ai/omni?project_id=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
          // Merge with default image accurate models
          setModels(data.models)
        }
        if (data?.active_model) {
          setActiveModelId(data.active_model)
        }
      })
      .catch(() => {})

    fetch(`/api/user/credits`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (typeof data?.balance_usd === "number") setUserCredits(data.balance_usd)
        else if (typeof data?.credits === "number") setUserCredits(data.credits)
      })
      .catch(() => {})

    return () => {
      active = false
    }
  }, [open, projectId])

  const handleSelectModel = async (model: OmniModelItem) => {
    setActiveModelId(model.id)
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

      toast.success(`Active model updated to ${model.name || model.id}`)
      onSelectModel?.(model.id, model)
      onOpenChange(false)
    } catch {
      toast.success(`Selected ${model.name || model.id}`)
      onSelectModel?.(model.id, model)
      onOpenChange(false)
    }
  }

  // Filter logic
  const filteredModels = useMemo(() => {
    return models.filter((m) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.provider && m.provider.toLowerCase().includes(q))

      if (!matchesSearch) return false

      if (selectedProviderFilter === "All") return true
      const p = (m.provider || "").toLowerCase()
      if (selectedProviderFilter === "OpenAI") return p.includes("openai") || m.id.toLowerCase().includes("gpt")
      if (selectedProviderFilter === "Anthropic") return p.includes("anthropic") || m.id.toLowerCase().includes("claude")
      if (selectedProviderFilter === "Google") return p.includes("google") || m.id.toLowerCase().includes("gemini")
      if (selectedProviderFilter === "Mistral") return p.includes("mistral")
      if (selectedProviderFilter === "Meta") return p.includes("meta") || m.id.toLowerCase().includes("llama")
      if (selectedProviderFilter === "Cohere") return p.includes("cohere") || m.id.toLowerCase().includes("command")
      if (selectedProviderFilter === "xAI") return p.includes("xai") || m.id.toLowerCase().includes("grok")
      if (selectedProviderFilter === "Other") {
        return !["openai", "anthropic", "google", "mistral", "meta", "cohere", "xai"].some((brand) => p.includes(brand))
      }

      return true
    })
  }, [models, searchQuery, selectedProviderFilter])

  // Top 3 featured cards
  const top3 = useMemo(() => {
    return models.slice(0, 3)
  }, [models])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl p-0 gap-0 border border-[#232328] bg-[#0c0c0e] text-zinc-100 shadow-2xl rounded-[20px] sm:max-w-4xl max-h-[92vh] flex flex-col overflow-hidden font-sans"
        showCloseButton={false}
      >
        {/* Top Navbar: Sycord | AI Router | Models Status Pricing | Dashboard button & Hamburger */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1c20] bg-[#0c0c0e]">
          {/* Logo & Section Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
              <span className="font-bold text-white text-[15px] tracking-tight">Sycord</span>
            </div>
            <div className="h-4 w-[1px] bg-zinc-700/60 mx-1" />
            <span className="text-xs text-zinc-400 font-medium">AI Router</span>
          </div>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-6 text-xs text-zinc-400 font-medium">
            <span className="text-white border-b-2 border-white pb-1 font-semibold cursor-pointer">Models</span>
            <span className="hover:text-white transition-colors cursor-pointer">Status</span>
            <span className="hover:text-white transition-colors cursor-pointer">Pricing</span>
          </div>

          {/* Right Action: Dashboard link + Close */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenChange(false)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-800 bg-[#16161a] hover:bg-[#202026] text-xs font-medium text-zinc-200 transition-colors cursor-pointer"
            >
              <span>Dashboard</span>
              <ExternalLink className="h-3 w-3 text-zinc-400" />
            </button>

            <button
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-xl flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-800/60 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Scrollable Main Area */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 custom-scrollbar">
          {/* Header Title + Count */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Models</h1>
              <p className="text-xs text-zinc-400 mt-1">
                Browse and compare available AI models.
              </p>
            </div>
            <span className="text-xs text-zinc-500 font-medium tabular-nums">
              {models.length} models
            </span>
          </div>

          {/* Top Models Row */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-amber-400 text-sm">★</span>
                <span className="text-sm font-semibold text-white">Top models</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProviderFilter("All")}
                className="text-xs text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                <span>View all</span>
                <span className="text-xs">→</span>
              </button>
            </div>

            {/* 3 Top Model Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {top3.map((model, idx) => {
                const rankPillStyles = [
                  "bg-[#3d3215] text-[#facc15] border-[#854d0e]",
                  "bg-[#27272a] text-[#e4e4e7] border-[#3f3f46]",
                  "bg-[#3b2314] text-[#fb923c] border-[#9a3412]",
                ]

                return (
                  <div
                    key={model.id}
                    onClick={() => handleSelectModel(model)}
                    className="relative flex flex-col justify-between p-4 rounded-[14px] border border-[#232328] bg-[#141416] hover:border-zinc-600 transition-all cursor-pointer group"
                  >
                    {/* Top Row: Rank badge */}
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${rankPillStyles[idx] || rankPillStyles[1]}`}>
                        <span>👑</span>
                        <span>#{idx + 1}</span>
                      </span>

                      {/* Pricing right-aligned */}
                      <div className="text-right text-[11px]">
                        <div className="font-semibold text-white">
                          ${model.input_cost ? model.input_cost.toFixed(2) : "0.00"}
                        </div>
                        <div className="text-[10px] text-zinc-500">input / 1M</div>
                      </div>
                    </div>

                    {/* Middle: Icon + Model Name & Provider */}
                    <div className="flex items-center gap-3 my-3">
                      <div className="h-9 w-9 rounded-xl bg-[#1c1c20] flex items-center justify-center shrink-0">
                        <BrandLogo brand={model.provider || model.id} size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="text-xs font-semibold text-white truncate leading-tight group-hover:text-indigo-300 transition-colors">
                          {model.name}
                        </h4>
                        <p className="text-[11px] text-zinc-500 truncate mt-0.5">
                          {model.provider}
                        </p>
                      </div>

                      <div className="text-right text-[11px]">
                        <div className="font-semibold text-white">
                          ${model.output_cost ? model.output_cost.toFixed(2) : "0.00"}
                        </div>
                        <div className="text-[10px] text-zinc-500">output / 1M</div>
                      </div>
                    </div>

                    {/* Capabilities Tags */}
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="px-2 py-0.5 rounded-md bg-[#1f1f23] text-[10px] text-zinc-400 font-medium">
                        Text
                      </span>
                      {model.supports_vision && (
                        <span className="px-2 py-0.5 rounded-md bg-[#1f1f23] text-[10px] text-zinc-400 font-medium">
                          Image
                        </span>
                      )}
                      {model.supports_video && (
                        <span className="px-2 py-0.5 rounded-md bg-[#1f1f23] text-[10px] text-zinc-400 font-medium">
                          Video
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Search Bar (Only White) + Filter Button */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-12 py-2.5 rounded-xl border border-[#232328] bg-white text-zinc-950 placeholder:text-zinc-500 text-xs font-medium outline-none focus:ring-2 focus:ring-zinc-400 transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-zinc-400 font-mono bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 pointer-events-none">
                <span>⌘</span>
                <span>K</span>
              </div>
            </div>

            {/* Filter Dropdown Button */}
            <button
              type="button"
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-[#232328] bg-[#141416] hover:bg-[#1a1a1e] text-xs font-medium text-white transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-zinc-400" />
              <span>Filter</span>
              <span className="text-zinc-500 text-[10px]">▼</span>
            </button>
          </div>

          {/* Provider Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {[
              { id: "All", label: "All" },
              { id: "OpenAI", label: "OpenAI" },
              { id: "Anthropic", label: "Anthropic" },
              { id: "Google", label: "Google" },
              { id: "Mistral", label: "Mistral" },
              { id: "Meta", label: "Meta" },
              { id: "Cohere", label: "Cohere" },
              { id: "xAI", label: "xAI" },
              { id: "Other", label: "Other" },
            ].map((chip) => {
              const isSelected = selectedProviderFilter === chip.id
              return (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setSelectedProviderFilter(chip.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? "bg-white text-black font-semibold"
                      : "bg-[#141416] border border-[#232328] text-zinc-300 hover:text-white hover:bg-[#1a1a1e]"
                  }`}
                >
                  {chip.id !== "All" && chip.id !== "Other" && (
                    <BrandLogo brand={chip.id} size={14} />
                  )}
                  {chip.id === "Other" && <span className="text-[10px] text-zinc-400">•••</span>}
                  <span>{chip.label}</span>
                </button>
              )
            })}
          </div>

          {/* Models Table View */}
          <div className="border border-[#1f1f24] rounded-xl overflow-hidden bg-[#0e0e11]">
            {/* Table Header */}
            <div className="grid grid-cols-12 px-4 py-2.5 text-[11px] font-medium text-zinc-500 border-b border-[#1f1f24] bg-[#121215]">
              <div className="col-span-4">Model</div>
              <div className="col-span-3">Modalities</div>
              <div className="col-span-2">Context</div>
              <div className="col-span-1.5 cursor-pointer hover:text-zinc-300">
                Input (1M) ↓
              </div>
              <div className="col-span-1.5 text-right cursor-pointer hover:text-zinc-300">
                Output (1M) ⇅
              </div>
            </div>

            {/* Table Rows */}
            <div className="divide-y divide-[#18181c]">
              {filteredModels.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  No models found matching your search.
                </div>
              ) : (
                filteredModels.map((m) => {
                  const isCurrent = m.id === activeModelId

                  return (
                    <div
                      key={m.id}
                      onClick={() => handleSelectModel(m)}
                      className={`grid grid-cols-12 items-center px-4 py-3 text-xs transition-colors cursor-pointer group ${
                        isCurrent
                          ? "bg-white/[0.04]"
                          : "hover:bg-white/[0.02]"
                      }`}
                    >
                      {/* Model Icon + Name + Provider */}
                      <div className="col-span-4 flex items-center gap-3 min-w-0 pr-2">
                        <div className="h-8 w-8 rounded-lg bg-[#18181c] flex items-center justify-center shrink-0">
                          <BrandLogo brand={m.provider || m.id} size={18} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                            {m.name}
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate">
                            {m.provider}
                          </div>
                        </div>
                      </div>

                      {/* Modalities (Text, Image, Video) */}
                      <div className="col-span-3 flex items-center gap-2 text-zinc-400 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-3 w-3 text-zinc-500" />
                          <span>Text</span>
                        </span>
                        {m.supports_vision && (
                          <span className="inline-flex items-center gap-1">
                            <ImageIcon className="h-3 w-3 text-zinc-500" />
                            <span>Image</span>
                          </span>
                        )}
                        {m.supports_video && (
                          <span className="inline-flex items-center gap-1">
                            <Video className="h-3 w-3 text-zinc-500" />
                            <span>Video</span>
                          </span>
                        )}
                      </div>

                      {/* Context Limit */}
                      <div className="col-span-2 text-zinc-400 font-mono text-[11px] tabular-nums">
                        {m.context_window ? m.context_window.toLocaleString() : "128,000"}
                      </div>

                      {/* Input Cost */}
                      <div className="col-span-1.5 text-zinc-300 font-mono text-[11px] tabular-nums">
                        ${m.input_cost !== undefined ? m.input_cost.toFixed(m.input_cost < 0.1 ? 3 : 2) : "0.00"}
                      </div>

                      {/* Output Cost + Chevron */}
                      <div className="col-span-1.5 flex items-center justify-end gap-2 text-right">
                        <span className="text-zinc-300 font-mono text-[11px] tabular-nums">
                          ${m.output_cost !== undefined ? m.output_cost.toFixed(m.output_cost < 0.1 ? 3 : 2) : "0.00"}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0" />
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer: © 2026 Sycord | Status (green dot) Docs Pricing */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-[#1c1c20] bg-[#0c0c0e] text-[11px] text-zinc-500">
          <div>© 2026 Sycord</div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              <span>Status</span>
            </div>
            <span className="hover:text-zinc-300 transition-colors cursor-pointer">Docs</span>
            <span className="hover:text-zinc-300 transition-colors cursor-pointer">Pricing</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
