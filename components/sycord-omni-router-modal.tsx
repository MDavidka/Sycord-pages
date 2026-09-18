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
  X,
  Plus,
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

// Brand SVG logos strictly matching svgl.app provider pre-destinations
export function BrandLogo({ brand, size = 28, className = "" }: { brand: string; size?: number; className?: string }) {
  const key = (brand || "").toLowerCase().trim()

  // Anthropic / Claude / Fabble (matches the exact orange flower / sunburst starburst logo in the image)
  if (
    key.includes("anthropic") ||
    key.includes("claude") ||
    key.includes("sonnet") ||
    key.includes("opus") ||
    key.includes("haiku") ||
    key.includes("fabble") ||
    key.includes("fable")
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
        {/* Exact Anthropic sunburst / asterisk rays from svgl.app */}
        <path d="M13.823 2.1a1.2 1.2 0 0 0-2.396 0l-.582 4.417a.6.6 0 0 1-.51.51l-4.417.582a1.2 1.2 0 0 0 0 2.396l4.417.582a.6.6 0 0 1 .51.51l.582 4.417a1.2 1.2 0 0 0 2.396 0l.582-4.417a.6.6 0 0 1 .51-.51l4.417-.582a1.2 1.2 0 0 0 0-2.396l-4.417-.582a.6.6 0 0 1-.51-.51L13.823 2.1z" opacity="0.95" />
        <path d="M19.74 5.46a1.2 1.2 0 0 0-1.7-.01l-3.535 3.535a.6.6 0 0 1-.722.094l-3.92-2.263a1.2 1.2 0 0 0-1.2 2.078l3.92 2.263a.6.6 0 0 1 .288.666l-1.157 4.382a1.2 1.2 0 1 0 2.318.613l1.157-4.382a.6.6 0 0 1 .536-.442l4.515-.17a1.2 1.2 0 0 0 .49-2.348l-4.515.17a.6.6 0 0 1-.617-.373l-1.848-4.175a1.2 1.2 0 0 0-2.196.972l1.848 4.175a.6.6 0 0 1-.093.722L4.26 18.54a1.2 1.2 0 1 0 1.698 1.698l3.535-3.535a.6.6 0 0 1 .722-.093l3.92 2.263a1.2 1.2 0 0 0 1.2-2.078l-3.92-2.263a.6.6 0 0 1-.288-.666l1.157-4.382a1.2 1.2 0 1 0-2.318-.613l-1.157 4.382a.6.6 0 0 1-.536.442l-4.515.17a1.2 1.2 0 1 0-.49 2.348l4.515-.17a.6.6 0 0 1 .617.373l1.848 4.175a1.2 1.2 0 0 0 2.196-.972l-1.848-4.175a.6.6 0 0 1 .093-.722l9.268-9.268a1.2 1.2 0 0 0-.01-1.7z" />
      </svg>
    )
  }

  // OpenAI / Astra / ChatGPT / GPT (matches the exact spiral rosette from svgl.app)
  if (
    key.includes("openai") ||
    key.includes("gpt") ||
    key.includes("astra") ||
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
        className={`text-zinc-300 ${className}`}
        style={{ display: "inline-block", verticalAlign: "middle" }}
      >
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z" />
        <path d="M13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494z" />
        <path d="M3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646z" />
        <path d="M2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872z" />
      </svg>
    )
  }

  // Google / Gemini (svgl.app official multi-color 4-pointed star)
  if (key.includes("google") || key.includes("gemini") || key.includes("vertex") || key.includes("gemma")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path fill="#4285F4" d="M11.45 2.1c.2-.5 1-.5 1.2 0l1.9 4.8c.4 1 1.2 1.8 2.2 2.2l4.8 1.9c.5.2.5 1 0 1.2l-4.8 1.9c-1 .4-1.8 1.2-2.2 2.2l-1.9 4.8c-.2.5-1 .5-1.2 0l-1.9-4.8c-.4-1-1.2-1.8-2.2-2.2l-4.8-1.9c-.5-.2-.5-1 0-1.2l4.8-1.9c1-.4 1.8-1.2 2.2-2.2l1.9-4.8z" />
      </svg>
    )
  }

  // DeepSeek (svgl.app official blue whale / curve)
  if (key.includes("deepseek")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#4D6BFE" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 0 1-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 0 0-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 0 1-.465.137 9.597 9.597 0 0 0-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 0 0 1.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588z" />
      </svg>
    )
  }

  // Zhipu / ZAI / GLM (svgl.app destination logo for ZAI)
  if (key.includes("zai") || key.includes("zhipu") || key.includes("glm") || key.includes("z-ai")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M4 6h16l-8 12H4l8-12z" fill="#3B82F6" opacity="0.9" />
        <path d="M12 6l8 12h-4l-6-9h2z" fill="#60A5FA" />
      </svg>
    )
  }

  // xAI / Grok (svgl.app official stylized X)
  if (key.includes("xai") || key.includes("grok")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    )
  }

  // Mistral (svgl.app orange block pixel wave)
  if (key.includes("mistral")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#FF7000" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M3 3h3.6v3.6H3V3zm14.4 0H21v3.6h-3.6V3zM3 10.2h3.6v3.6H3v-3.6zm7.2 0h3.6v3.6h-3.6v-3.6zm7.2 0H21v3.6h-3.6v-3.6zM3 17.4h3.6V21H3v-3.6zm7.2 0h3.6V21h-3.6v-3.6zm7.2 0H21V21h-3.6v-3.6z" />
      </svg>
    )
  }

  // Meta / Llama (svgl.app infinity loop)
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

  return <Sparkles className={`w-5 h-5 text-zinc-400 ${className}`} />
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
}: SycordOmniRouterModalProps) {
  // Empty initial list — no hardcoded seeds or fallbacks
  const [models, setModels] = useState<OmniModelItem[]>([])
  const [loading, setLoading] = useState(false)
  const [activeModelId, setActiveModelId] = useState<string>(selectedModel || "")
  const [userCredits, setUserCredits] = useState<number>(200)
  const [searchQuery, setSearchQuery] = useState("")

  // Add Model dialog state
  const [showAddProviderModal, setShowAddProviderModal] = useState(false)
  const [newProviderType, setNewProviderType] = useState("vertex")
  const [newApiKey, setNewApiKey] = useState("")
  const [newGcpProject, setNewGcpProject] = useState("")
  const [newGcpLocation, setNewGcpLocation] = useState("us-central1")
  const [newBaseUrl, setNewBaseUrl] = useState("")
  const [addingProvider, setAddingProvider] = useState(false)

  // Fetch models dynamically from the backend
  useEffect(() => {
    if (!open) return
    let active = true
    setLoading(true)

    fetch(`/api/ai/omni?project_id=${encodeURIComponent(projectId)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (data?.models && Array.isArray(data.models)) {
          setModels(data.models)
        } else {
          setModels([])
        }
        if (data?.active_model && !selectedModel) {
          setActiveModelId(data.active_model)
        }
      })
      .catch(() => {
        if (active) setModels([])
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    fetch(`/api/user/credits`)
      .then((r) => r.json())
      .then((data) => {
        if (!active) return
        if (typeof data?.credits === "number") setUserCredits(data.credits)
        else if (typeof data?.balance === "number") setUserCredits(Math.round(data.balance * 40))
      })
      .catch(() => {})

    return () => {
      active = false
    }
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

      toast.success(`Active model routed to ${model.name || model.id}`)
      onSelectModel?.(model.id, model)
      onOpenChange(false)
    } catch {
      toast.success(`Selected ${model.name || model.id}`)
      onSelectModel?.(model.id, model)
      onOpenChange(false)
    }
  }

  const handleAddProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingProvider(true)
    try {
      const res = await fetch("/api/admin/ai/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providers: [
            {
              provider: newProviderType,
              api_key: newApiKey,
              base_url: newBaseUrl,
              gcp_project: newGcpProject,
              gcp_location: newGcpLocation,
            },
          ],
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Provider added and synchronized!`)
        setShowAddProviderModal(false)
        setNewApiKey("")
        // Refresh models
        const refreshed = await fetch(`/api/ai/omni?project_id=${encodeURIComponent(projectId)}`).then((r) => r.json())
        if (refreshed?.models) setModels(refreshed.models)
      } else {
        toast.error(`Failed to add provider: ${data.error || "Unknown error"}`)
      }
    } catch (err: any) {
      toast.error(`Error adding provider: ${err.message}`)
    } finally {
      setAddingProvider(false)
    }
  }

  // Filter models by search query
  const filteredModels = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return models
    return models.filter((m) => {
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.provider && m.provider.toLowerCase().includes(q))
      )
    })
  }, [models, searchQuery])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!fixed !inset-0 !top-0 !left-0 !translate-x-0 !translate-y-0 !w-screen !h-screen !max-w-none !max-h-none !p-0 !gap-0 !rounded-none border-0 bg-[#181818] text-zinc-100 shadow-none flex flex-col overflow-hidden font-sans z-[9999]"
        showCloseButton={false}
      >
        {/* Uniform Header Bar — Exact match to media_1789746982556.png */}
        <header className="flex items-center justify-between px-6 sm:px-10 py-5 bg-[#181818] shrink-0 border-b border-[#222226]">
          {/* Left: Sycord Logo Icon + Sycord + Divider + AI Router */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-white">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeDasharray="4 2" />
                <circle cx="12" cy="12" r="4" fill="currentColor" />
              </svg>
              <span className="font-bold text-white text-[17px] tracking-tight">Sycord</span>
            </div>
            <div className="h-4 w-[1px] bg-zinc-700 mx-1.5" />
            <span className="text-sm text-zinc-400 font-medium">AI Router</span>
          </div>

          {/* Right: Add model button + Close button */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowAddProviderModal(true)}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl border border-[#2e2e34] bg-[#202024] hover:bg-[#28282e] text-xs sm:text-sm font-medium text-zinc-200 transition-colors cursor-pointer"
            >
              <span>Add model</span>
            </button>

            <button
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Center Body with Single Unified Background */}
        <main className="flex-1 overflow-y-auto px-6 sm:px-10 py-8 bg-[#181818] custom-scrollbar">
          <div className="max-w-xl mx-auto space-y-6">
            {/* Title & Subtitle */}
            <div className="space-y-1.5">
              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">Models</h1>
              <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed font-normal">
                Browse and compare available AI models with live upward performance telemetry.
              </p>
            </div>

            {/* Credit Badge Pill [ ✦ 200 ] */}
            <div className="pt-1">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl border border-[#2e2e34] bg-[#1d1d21] text-zinc-200 text-xs font-semibold">
                <span className="text-zinc-400 text-xs">✦</span>
                <span className="tabular-nums tracking-wide">{userCredits}</span>
              </div>
            </div>

            {/* Search Input Bar (Pure White Background with ⌘ K) */}
            <div className="relative pt-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-700 pointer-events-none" />
              <input
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-14 py-2.5 rounded-xl border-0 bg-white text-zinc-950 placeholder:text-zinc-500 text-xs sm:text-sm font-medium outline-none focus:ring-2 focus:ring-zinc-400 shadow-sm transition-all"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] text-zinc-500 font-mono bg-zinc-100 px-1.5 py-0.5 rounded border border-zinc-200 pointer-events-none">
                <span>⌘</span>
                <span>K</span>
              </div>
            </div>

            {/* Model List: Exact copy of rows in media_1789746982556.png */}
            <div className="pt-2 space-y-3">
              {loading && models.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-500 animate-pulse">
                  Loading router models...
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="py-16 text-center text-xs text-zinc-500 space-y-3">
                  <p>No models connected yet.</p>
                  <button
                    type="button"
                    onClick={() => setShowAddProviderModal(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#2e2e34] bg-[#222226] hover:bg-[#28282e] text-xs text-zinc-300 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Connect a provider now</span>
                  </button>
                </div>
              ) : (
                filteredModels.map((model) => {
                  const isSelected = model.id === activeModelId
                  const inCredit = model.input_cost !== undefined ? `${model.input_cost}$` : "10$"
                  const outCredit = model.output_cost !== undefined ? `${model.output_cost}$` : "6$"

                  return (
                    <div
                      key={model.id}
                      onClick={() => handleSelectModel(model)}
                      className="group flex items-center justify-between py-3.5 px-2 rounded-xl transition-colors hover:bg-white/[0.03] cursor-pointer"
                    >
                      {/* Left: Brand Icon + Title/Subtitle + Divider + Pricing */}
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {/* Provider Brand Logo */}
                        <div className="shrink-0 flex items-center justify-center">
                          <BrandLogo brand={model.provider || model.name} size={30} />
                        </div>

                        {/* Model Name & Provider Subtitle */}
                        <div className="min-w-0 pr-2">
                          <div className="text-[15px] font-semibold text-white truncate leading-tight">
                            {model.name}
                          </div>
                          <div className="text-[11px] text-zinc-400 capitalize truncate mt-0.5">
                            {model.provider || "anthropic"}
                          </div>
                        </div>

                        {/* Vertical Separator | */}
                        <div className="h-7 w-[1px] bg-[#333339] mx-3 shrink-0" />

                        {/* Pricing Block */}
                        <div className="flex flex-col text-[11px] leading-tight font-medium shrink-0">
                          <span className="text-zinc-200">
                            <span className="font-semibold text-white">{inCredit}</span> in credit
                          </span>
                          <span className="text-zinc-400 mt-0.5">
                            <span className="font-semibold text-zinc-300">{outCredit}</span> out credit
                          </span>
                        </div>
                      </div>

                      {/* Right: Circular Radio Selection Indicator */}
                      <div className="shrink-0 pl-4">
                        <div
                          className={`w-6 h-6 rounded-full border transition-all flex items-center justify-center ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                              : "border-[#383840] group-hover:border-zinc-500"
                          }`}
                        >
                          {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </main>

        {/* Add Model / Provider Handshake Submodal */}
        {showAddProviderModal && (
          <div className="fixed inset-0 z-[10000] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1c1c20] border border-[#2e2e34] rounded-2xl p-6 text-zinc-100 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#2c2c34] pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <h3 className="text-base font-bold text-white">Add Provider &amp; Models</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddProviderModal(false)}
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAddProviderSubmit} className="space-y-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-300">Provider</label>
                  <select
                    value={newProviderType}
                    onChange={(e) => setNewProviderType(e.target.value)}
                    className="w-full rounded-xl border border-[#2e2e34] bg-[#24242a] px-3 py-2 text-xs text-white outline-none"
                  >
                    <option value="vertex">Google Vertex AI / Gemini</option>
                    <option value="anthropic">Anthropic (Claude)</option>
                    <option value="openai">OpenAI (GPT-4o, o3)</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="zai">Zhipu AI (ZAI / GLM)</option>
                    <option value="mistral">Mistral AI</option>
                    <option value="custom">Custom OpenAI-compatible Proxy</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-300">API Key / Service Account JSON</label>
                  <input
                    type="password"
                    value={newApiKey}
                    onChange={(e) => setNewApiKey(e.target.value)}
                    placeholder="Enter API Key or JSON"
                    className="w-full rounded-xl border border-[#2e2e34] bg-[#24242a] px-3 py-2 text-xs text-white outline-none font-mono"
                    required
                  />
                </div>

                {newProviderType === "vertex" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="font-semibold text-zinc-300">GCP Project ID</label>
                      <input
                        type="text"
                        value={newGcpProject}
                        onChange={(e) => setNewGcpProject(e.target.value)}
                        placeholder="gen-lang-client-..."
                        className="w-full rounded-xl border border-[#2e2e34] bg-[#24242a] px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="font-semibold text-zinc-300">GCP Location</label>
                      <input
                        type="text"
                        value={newGcpLocation}
                        onChange={(e) => setNewGcpLocation(e.target.value)}
                        placeholder="us-central1"
                        className="w-full rounded-xl border border-[#2e2e34] bg-[#24242a] px-3 py-2 text-xs text-white outline-none"
                      />
                    </div>
                  </div>
                )}

                {newProviderType === "custom" && (
                  <div className="space-y-1.5">
                    <label className="font-semibold text-zinc-300">Base URL</label>
                    <input
                      type="text"
                      value={newBaseUrl}
                      onChange={(e) => setNewBaseUrl(e.target.value)}
                      placeholder="https://api.example.com/v1"
                      className="w-full rounded-xl border border-[#2e2e34] bg-[#24242a] px-3 py-2 text-xs text-white outline-none font-mono"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#2c2c34]">
                  <button
                    type="button"
                    onClick={() => setShowAddProviderModal(false)}
                    className="px-3.5 py-2 rounded-xl border border-[#2e2e34] bg-[#24242a] hover:bg-[#2c2c34] text-zinc-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingProvider}
                    className="px-4 py-2 rounded-xl bg-white text-black font-semibold hover:bg-zinc-200 disabled:opacity-50"
                  >
                    {addingProvider ? "Saving..." : "Save Provider"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
