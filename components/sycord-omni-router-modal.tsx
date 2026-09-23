"use client"

import React, { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Search, Check, Sparkles, X, RefreshCw, Cpu, Layers, Zap } from "lucide-react"

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
  supports_tools?: boolean
  supports_cache?: boolean
  supports_video?: boolean
  supports_reasoning?: boolean
  description?: string
  is_active?: boolean
  rank?: number
  tags?: string[]
}

// Brand SVG logos strictly matching svgl.app provider designs
export function BrandLogo({ brand, size = 24, className = "" }: { brand: string; size?: number; className?: string }) {
  const key = (brand || "").toLowerCase().trim()

  // Anthropic / Claude
  if (
    key.includes("anthropic") ||
    key.includes("claude") ||
    key.includes("sonnet") ||
    key.includes("opus") ||
    key.includes("haiku")
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="#E26D46"
        className={className}
        style={{ display: "inline-block", verticalAlign: "middle" }}
      >
        <path d="M13.823 2.1a1.2 1.2 0 0 0-2.396 0l-.582 4.417a.6.6 0 0 1-.51.51l-4.417.582a1.2 1.2 0 0 0 0 2.396l4.417.582a.6.6 0 0 1 .51.51l.582 4.417a1.2 1.2 0 0 0 2.396 0l.582-4.417a.6.6 0 0 1 .51-.51l4.417-.582a1.2 1.2 0 0 0 0-2.396l-4.417-.582a.6.6 0 0 1-.51-.51L13.823 2.1z" opacity="0.95" />
        <path d="M19.74 5.46a1.2 1.2 0 0 0-1.7-.01l-3.535 3.535a.6.6 0 0 1-.722.094l-3.92-2.263a1.2 1.2 0 0 0-1.2 2.078l3.92 2.263a.6.6 0 0 1 .288.666l-1.157 4.382a1.2 1.2 0 1 0 2.318.613l1.157-4.382a.6.6 0 0 1 .536-.442l4.515-.17a1.2 1.2 0 0 0 .49-2.348l-4.515.17a.6.6 0 0 1-.617-.373l-1.848-4.175a1.2 1.2 0 0 0-2.196.972l1.848 4.175a.6.6 0 0 1-.093.722L4.26 18.54a1.2 1.2 0 1 0 1.698 1.698l3.535-3.535a.6.6 0 0 1 .722-.093l3.92 2.263a1.2 1.2 0 0 0 1.2-2.078l-3.92-2.263a.6.6 0 0 1-.288-.666l1.157-4.382a1.2 1.2 0 1 0-2.318-.613l-1.157 4.382a.6.6 0 0 1-.536.442l-4.515.17a1.2 1.2 0 1 0-.49 2.348l4.515-.17a.6.6 0 0 1 .617.373l1.848 4.175a1.2 1.2 0 0 0 2.196-.972l-1.848-4.175a.6.6 0 0 1 .093-.722l9.268-9.268a1.2 1.2 0 0 0-.01-1.7z" />
      </svg>
    )
  }

  // OpenAI / ChatGPT
  if (
    key.includes("openai") ||
    key.includes("gpt") ||
    key.includes("o3") ||
    key.includes("o1") ||
    key.includes("chatgpt")
  ) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`text-emerald-400 ${className}`}
        style={{ display: "inline-block", verticalAlign: "middle" }}
      >
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z" />
        <path d="M13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494z" />
        <path d="M3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646z" />
        <path d="M2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872z" />
      </svg>
    )
  }

  // Google / Gemini
  if (key.includes("google") || key.includes("gemini") || key.includes("vertex") || key.includes("gemma")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <defs>
          <linearGradient id="gemini-svgl-grad-mod" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="50%" stopColor="#9B72CF" />
            <stop offset="100%" stopColor="#D96570" />
          </linearGradient>
        </defs>
        <path fill="url(#gemini-svgl-grad-mod)" d="M11.45 2.1c.2-.5 1-.5 1.2 0l1.9 4.8c.4 1 1.2 1.8 2.2 2.2l4.8 1.9c.5.2.5 1 0 1.2l-4.8 1.9c-1 .4-1.8 1.2-2.2 2.2l-1.9 4.8c-.2.5-1 .5-1.2 0l-1.9-4.8c-.4-1-1.2-1.8-2.2-2.2l-4.8-1.9c-.5-.2-.5-1 0-1.2l4.8-1.9c1-.4 1.8-1.2 2.2-2.2l1.9-4.8z" />
      </svg>
    )
  }

  // DeepSeek
  if (key.includes("deepseek")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#4D6BFE" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588z" />
      </svg>
    )
  }

  // Zhipu / ZAI / GLM
  if (key.includes("zai") || key.includes("zhipu") || key.includes("glm") || key.includes("z-ai")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M4 6h16l-8 12H4l8-12z" fill="#3B82F6" opacity="0.9" />
        <path d="M12 6l8 12h-4l-6-9h2z" fill="#60A5FA" />
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
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#0081FB" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M2.586 16.514C1.01 15.195 0 13.22 0 11c0-4.418 3.582-8 8-8s8 3.582 8 8c0 2.22-1.01 4.195-2.586 5.514.035-.558-.077-1.127-.354-1.632-.748-1.365-2.378-2.632-4.56-2.632-2.183 0-3.813 1.267-4.561 2.632-.277.505-.389 1.074-.354 1.632z" />
      </svg>
    )
  }

  // Alibaba / Qwen
  if (key.includes("qwen") || key.includes("alibaba")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#6366F1" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M12 2l2.4 4.8 5.3.8-3.8 3.7.9 5.3L12 14.1l-4.8 2.5.9-5.3-3.8-3.7 5.3-.8L12 2zm0 6.5l-1.3 2.6-2.9.4 2.1 2-.5 2.9 2.6-1.4 2.6 1.4-.5-2.9 2.1-2-2.9-.4L12 8.5z" />
      </svg>
    )
  }

  // NVIDIA
  if (key.includes("nvidia") || key.includes("nim")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#76B900" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M9.756 16.488a5.534 5.534 0 0 1-1.04-.1 3.513 3.513 0 0 1-2.28-1.748 3.518 3.518 0 0 1-.397-2.678 3.504 3.504 0 0 1 1.764-2.296 5.545 5.545 0 0 1 2.94-.652c.983 0 1.93.245 2.766.716l2.12-2.12A8.528 8.528 0 0 0 9.756 6c-3.13 0-5.918 1.636-7.447 4.14A8.524 8.524 0 0 0 .97 14.86c1.53 2.504 4.317 4.14 7.446 4.14 1.83 0 3.52-.56 4.922-1.52l-2.094-2.094a5.526 5.526 0 0 1-1.488.102zm7.14-8.868A11.517 11.517 0 0 0 9.756 3C4.368 3 .001 7.368.001 12.756c0 5.389 4.367 9.756 9.755 9.756 4.673 0 8.57-3.29 9.516-7.669H16.14a6.544 6.544 0 0 1-6.384 4.669c-3.615 0-6.556-2.94-6.556-6.756 0-3.815 2.941-6.756 6.556-6.756 1.81 0 3.45.735 4.64 1.924l2.49-2.49zM24 12.756C24 5.71 18.29 0 11.244 0c-3.22 0-6.17 1.19-8.42 3.153l2.12 2.12C6.54 3.82 8.76 2.99 11.244 2.99 16.634 2.99 21 7.357 21 12.756c0 5.39-4.366 9.756-9.756 9.756-2.484 0-4.704-.83-6.299-2.283l-2.12 2.12C5.074 24.31 8.024 25.5 11.244 25.5 18.29 25.5 24 19.8 24 12.756z" />
      </svg>
    )
  }

  // Amazon / Bedrock
  if (key.includes("amazon") || key.includes("aws")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#FF9900" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M15.4 12.7c-.1-.1-.3-.2-.5-.1-1.3.8-3.1 1.2-4.9 1.2-3.1 0-5.8-1.5-7.7-3.9-.2-.2-.4-.2-.6 0-.2.2-.1.5 0 .7 2.1 2.6 5 4.2 8.3 4.2 1.9 0 3.8-.5 5.3-1.3.3-.2.3-.4.1-.7z" />
        <path d="M16.4 11.3c-.2-.3-.6-.3-.9 0l-.8.8c-.2.2-.1.5.1.7l1.7 1.2c.2.2.5.1.7-.1l.9-1.9c.1-.3-.1-.6-.4-.7h-.1l-1.2 0z" />
      </svg>
    )
  }

  // Cohere
  if (key.includes("cohere")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#39594C" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 16a6 6 0 1 1 6-6 6 6 0 0 1-6 6z" />
      </svg>
    )
  }

  // MiniMax
  if (key.includes("minimax")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#EC4899" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M4 4h4v16H4V4zm6 6h4v10h-4V10zm6-4h4v14h-4V6z" />
      </svg>
    )
  }

  // Perplexity
  if (key.includes("perplexity")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#22B8CD" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.3l5.8 3.6L12 11.5 6.2 7.9 12 4.3z" />
      </svg>
    )
  }

  return <Sparkles className={`w-4 h-4 text-zinc-400 ${className}`} />
}

export interface SycordOmniRouterModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedModel?: string
  onSelectModel?: (modelId: string, modelObj?: OmniModelItem) => void
  projectId?: string
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
  const [loading, setLoading] = useState(false)
  const [activeModelId, setActiveModelId] = useState<string>(selectedModel || "anthropic/claude-3.5-sonnet")
  const [userCredits, setUserCredits] = useState<number>(200)
  const [searchQuery, setSearchQuery] = useState("")

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
      .catch((err) => {
        toast.error("Failed to load models from Vercel AI Gateway")
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

      toast.success(`Active model set to ${model.name || model.id}`)
      onSelectModel?.(model.id, model)
      onOpenChange(false)
    } catch {
      toast.success(`Selected ${model.name || model.id}`)
      onSelectModel?.(model.id, model)
      onOpenChange(false)
    }
  }

  // Filter models by provider category & search query
  const filteredModels = useMemo(() => {
    let list = models
    if (selectedProvider !== "all") {
      list = list.filter((m) => (m.provider || "").toLowerCase() === selectedProvider.toLowerCase())
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
  }, [models, selectedProvider, searchQuery])

  // Group filtered models by provider for categorized rendering
  const categorizedModels = useMemo(() => {
    const groups = new Map<string, OmniModelItem[]>()
    for (const model of filteredModels) {
      const p = model.provider || "other"
      if (!groups.has(p)) groups.set(p, [])
      groups.get(p)!.push(model)
    }
    return Array.from(groups.entries()).map(([provider, items]) => ({
      provider,
      providerDisplay: items[0]?.provider_display || items[0]?.providerDisplay || provider.toUpperCase(),
      items,
    }))
  }, [filteredModels])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="!bg-black/70 data-[state=open]:!bg-black/70 backdrop-blur-sm"
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !min-h-[100dvh] !max-w-none !max-h-none !p-0 !gap-0 !rounded-none border-0 bg-[#121214] text-zinc-100 shadow-none flex flex-col overflow-hidden font-sans z-[9999]"
        showCloseButton={false}
      >
        {/* Top Header Bar */}
        <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 bg-[#121214] shrink-0 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <span className="font-bold text-white text-base tracking-tight">Sycord</span>
            </div>
            <div className="h-4 w-[1px] bg-zinc-800 mx-1" />
            <span className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
              <span>Vercel AI Gateway</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500/30 text-emerald-400 bg-emerald-500/10">
                Live Gateway
              </Badge>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => loadModels(true)}
              title="Refresh models"
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="p-1.5 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Category Horizontal Filter Bar */}
        <div className="px-4 sm:px-8 py-2 bg-[#161619] border-b border-zinc-800/60 overflow-x-auto custom-scrollbar flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedProvider("all")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
              selectedProvider === "all"
                ? "bg-zinc-100 text-zinc-900 font-semibold"
                : "bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800"
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
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all shrink-0 flex items-center gap-1.5 ${
                selectedProvider === p.id
                  ? "bg-zinc-100 text-zinc-900 font-semibold"
                  : "bg-zinc-800/60 text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              <BrandLogo brand={p.id} size={14} />
              <span>{p.name}</span>
              <span className="text-[10px] opacity-70">({p.count})</span>
            </button>
          ))}
        </div>

        {/* Scrollable Model Browser Surface */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 custom-scrollbar bg-[#121214]">
          <div className="max-w-4xl mx-auto space-y-5">
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search by model name, provider, tags (e.g. reasoning, vision)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-zinc-800 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-500 text-xs sm:text-sm font-medium outline-none focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Models list grouped by provider */}
            {loading && models.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500 animate-pulse">
                Fetching live models from Vercel AI Gateway...
              </div>
            ) : categorizedModels.length === 0 ? (
              <div className="py-16 text-center text-xs text-zinc-500 space-y-2">
                <p>No matching models found.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedProvider("all")
                    setSearchQuery("")
                  }}
                  className="text-emerald-400 hover:underline text-xs"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              categorizedModels.map((group) => (
                <div key={group.provider} className="space-y-2">
                  {/* Category Header with SVGL Icon */}
                  <div className="flex items-center gap-2 px-1 pt-2 pb-1 border-b border-zinc-800/60">
                    <BrandLogo brand={group.provider} size={18} />
                    <h2 className="text-xs font-bold text-zinc-300 uppercase tracking-wider">
                      {group.providerDisplay}
                    </h2>
                    <span className="text-[10px] text-zinc-500 font-mono">({group.items.length})</span>
                  </div>

                  {/* Models in Provider */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {group.items.map((model) => {
                      const isSelected = model.id === activeModelId
                      return (
                        <div
                          key={model.id}
                          onClick={() => handleSelectModel(model)}
                          className={`group relative p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 ${
                            isSelected
                              ? "bg-zinc-800/80 border-emerald-500/60 shadow-sm"
                              : "bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900/80 hover:border-zinc-700"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="w-8 h-8 rounded-lg bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center shrink-0 mt-0.5">
                                <BrandLogo brand={model.provider || model.name} size={18} />
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs sm:text-sm font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                                  {model.name}
                                </div>
                                <p className="text-[10px] font-mono text-zinc-500 truncate">{model.id}</p>
                              </div>
                            </div>

                            {/* Checkmark */}
                            <div
                              className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all ${
                                isSelected
                                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-400"
                                  : "border-zinc-700 bg-transparent group-hover:border-zinc-500"
                              }`}
                            >
                              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>

                          {model.description && (
                            <p className="text-[11px] text-zinc-400 line-clamp-2 leading-relaxed">
                              {model.description}
                            </p>
                          )}

                          {/* Pricing & Context Details */}
                          <div className="pt-1.5 border-t border-zinc-800/60 flex items-center justify-between text-[10px] text-zinc-400">
                            <div className="flex items-center gap-2">
                              <span>
                                In: <strong className="text-zinc-200">{model.inputCostDisplay || `$${model.input_cost}`}</strong>
                              </span>
                              <span>•</span>
                              <span>
                                Out: <strong className="text-zinc-200">{model.outputCostDisplay || `$${model.output_cost}`}</strong>
                              </span>
                            </div>
                            <div className="font-mono text-zinc-500">
                              {model.context_window ? `${Math.round(model.context_window / 1000)}k ctx` : ""}
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
