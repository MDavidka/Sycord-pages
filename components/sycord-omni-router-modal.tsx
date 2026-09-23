"use client"

import React, { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import Link from "next/link"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
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
  ArrowUpDown,
  CircleDot,
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
export function BrandLogo({ brand, size = 20, className = "" }: { brand: string; size?: number; className?: string }) {
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
          <linearGradient id="gemini-svgl-mod" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#4285F4" />
            <stop offset="50%" stopColor="#9B72CF" />
            <stop offset="100%" stopColor="#D96570" />
          </linearGradient>
        </defs>
        <path fill="url(#gemini-svgl-mod)" d="M11.45 2.1c.2-.5 1-.5 1.2 0l1.9 4.8c.4 1 1.2 1.8 2.2 2.2l4.8 1.9c.5.2.5 1 0 1.2l-4.8 1.9c-1 .4-1.8 1.2-2.2 2.2l-1.9 4.8c-.2.5-1 .5-1.2 0l-1.9-4.8c-.4-1-1.2-1.8-2.2-2.2l-4.8-1.9c-.5-.2-.5-1 0-1.2l4.8-1.9c1-.4 1.8-1.2 2.2-2.2l1.9-4.8z" />
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

  return <Sparkles className={`w-4 h-4 text-muted-foreground ${className}`} />
}

export type PriceFilter = "all" | "free" | "low" | "medium" | "high"

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
  const [loading, setLoading] = useState(false)
  const [activeModelId, setActiveModelId] = useState<string>(selectedModel || "gemini-2.5-flash")
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

  // Filter models by provider category, price bracket, and search query
  const filteredModels = useMemo(() => {
    let list = models

    // Provider filter
    if (selectedProvider !== "all") {
      list = list.filter((m) => (m.provider || "").toLowerCase() === selectedProvider.toLowerCase())
    }

    // Price tier filter (per 1M input tokens)
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
  }, [models, selectedProvider, priceFilter, searchQuery])

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
        overlayClassName="!bg-black/60 data-[state=open]:!bg-black/60 backdrop-blur-md"
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-[100dvh] !min-h-[100dvh] !max-w-none !max-h-none !p-0 !gap-0 !rounded-none border-0 bg-background text-foreground shadow-none flex flex-col overflow-hidden font-sans z-[9999]"
        showCloseButton={false}
      >
        {/* Modern Dashboard Header */}
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50 shrink-0">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            {/* Left: Brand, Logo & Breadcrumb */}
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
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold text-foreground tracking-tight">Sycord</span>
                  <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 gap-1">
                    <CircleDot className="w-2 h-2 text-primary fill-primary" />
                    AI Models
                  </Badge>
                </div>
              </div>
            </div>

            {/* Right: Credits, Refresh & Close */}
            <div className="flex items-center gap-2 sm:gap-3">
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

        {/* Filter Controls Bar (Search, Price Brackets, Providers) */}
        <div className="border-b border-border bg-card/50 px-4 sm:px-6 py-3 shrink-0">
          <div className="max-w-6xl mx-auto space-y-3">
            {/* Search and Price Filter Row */}
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

              {/* Price Filter Pills (Matching card background, border & roundness) */}
              <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar pb-0.5">
                <span className="text-[11px] font-medium text-muted-foreground mr-1 hidden sm:inline flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3" />
                  <span>Price:</span>
                </span>
                {(
                  [
                    { id: "all", label: "All Prices" },
                    { id: "free", label: "Free" },
                    { id: "low", label: "Economy (<$0.5)" },
                    { id: "medium", label: "Standard ($0.5-$2.5)" },
                    { id: "high", label: "Frontier (>$2.5)" },
                  ] as const
                ).map((tier) => (
                  <button
                    key={tier.id}
                    type="button"
                    onClick={() => setPriceFilter(tier.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
                      priceFilter === tier.id
                        ? "bg-primary text-primary-foreground border-primary shadow-xs"
                        : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {tier.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Provider Horizontal Scrolling Filter */}
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pt-0.5">
              <button
                type="button"
                onClick={() => setSelectedProvider("all")}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors shrink-0 flex items-center gap-1.5 ${
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
          </div>
        </div>

        {/* Minimalist Models Grid Surface */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 custom-scrollbar bg-background">
          <div className="max-w-6xl mx-auto space-y-6">
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
                <div key={group.provider} className="space-y-3">
                  {/* Category Header with Brand Logo */}
                  <div className="flex items-center gap-2 px-0.5 border-b border-border/60 pb-1.5">
                    <BrandLogo brand={group.provider} size={16} />
                    <h2 className="text-xs font-bold text-foreground uppercase tracking-wider">
                      {group.providerDisplay}
                    </h2>
                    <span className="text-[11px] text-muted-foreground font-mono">({group.items.length})</span>
                  </div>

                  {/* Clean, minimalist cards matching dashboard card & background styling */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {group.items.map((model) => {
                      const isSelected = model.id === activeModelId
                      return (
                        <div
                          key={model.id}
                          onClick={() => handleSelectModel(model)}
                          className={`group relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-3 shadow-xs ${
                            isSelected
                              ? "bg-card border-primary/70 ring-1 ring-primary/40"
                              : "bg-card border-border hover:border-border/80 hover:bg-card/90"
                          }`}
                        >
                          <div className="space-y-1.5">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-muted/60 border border-border flex items-center justify-center shrink-0">
                                  <BrandLogo brand={model.provider || model.name} size={16} />
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs sm:text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                                    {model.name}
                                  </div>
                                  <p className="text-[10px] font-mono text-muted-foreground truncate">{model.id}</p>
                                </div>
                              </div>

                              {/* Selection Indicator */}
                              <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-all ${
                                  isSelected
                                    ? "border-primary bg-primary text-primary-foreground"
                                    : "border-border bg-transparent group-hover:border-muted-foreground"
                                }`}
                              >
                                {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                              </div>
                            </div>

                            {model.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                                {model.description}
                              </p>
                            )}
                          </div>

                          {/* Pricing & Context Details */}
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
                            {model.context_window && (
                              <div className="font-mono text-muted-foreground text-[10px]">
                                {Math.round(model.context_window / 1000)}k ctx
                              </div>
                            )}
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
