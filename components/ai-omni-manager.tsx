"use client"

import React, { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Sparkles,
  Award,
  RefreshCw,
  Plus,
  Save,
  CheckCircle2,
  XCircle,
  Link as LinkIcon,
  Cpu,
  Layers,
  FileCode,
  Shield,
  Eye,
  Wrench,
  Database,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react"

// Official SVGL.app brand icons
export function SvglIcon({ brand, size = 18, className = "" }: { brand: string; size?: number; className?: string }) {
  const key = (brand || "").toLowerCase()

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
  if (key.includes("anthropic") || key.includes("claude") || key.includes("sonnet") || key.includes("opus") || key.includes("haiku")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#D97706" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M17.472 3.667h-3.874L20.89 20.333h3.874L17.472 3.667zm-10.944 0L0 20.333h3.874l1.658-4.482h6.988l1.658 4.482h3.874L11.528 3.667H6.528zm.972 9.074l2.028-5.482 2.028 5.482H7.5z" />
      </svg>
    )
  }
  if (key.includes("openai") || key.includes("gpt") || key.includes("o3") || key.includes("o1")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#10B981" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.307 15.356l-2.02-1.164a.08.08 0 0 1-.038-.057V8.552a4.5 4.5 0 0 1 7.37-3.454l-.142.08-4.778 2.758a.795.795 0 0 0-.392.681zm1.092-2.58l2.6-1.5 2.6 1.5v3l-2.6 1.5-2.6-1.5z" />
      </svg>
    )
  }
  if (key.includes("deepseek")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="#3B82F6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14.93V18c0 .55-.45 1-1 1s-1-.45-1-1v-1.07c-2.83-.48-5-2.94-5-5.93 0-.55.45-1 1-1s1 .45 1 1c0 2.21 1.79 4 4 4s4-1.79 4-4c0-.55.45-1 1-1s1 .45 1 1c0 2.99-2.17 5.45-5 5.93zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3z" />
      </svg>
    )
  }
  if (key.includes("nvidia") || key.includes("nim")) {
    return (
      <svg viewBox="0 0 24 24" width={size} height={size} fill="#76B900" className={className} style={{ display: "inline-block", verticalAlign: "middle" }}>
        <path d="M9.756 16.488a5.534 5.534 0 0 1-1.04-.1 3.513 3.513 0 0 1-2.28-1.748 3.518 3.518 0 0 1-.397-2.678 3.504 3.504 0 0 1 1.764-2.296 5.545 5.545 0 0 1 2.94-.652c.983 0 1.93.245 2.766.716l2.12-2.12A8.528 8.528 0 0 0 9.756 6c-3.13 0-5.918 1.636-7.447 4.14A8.524 8.524 0 0 0 .97 14.86c1.53 2.504 4.317 4.14 7.446 4.14 1.83 0 3.52-.56 4.922-1.52l-2.094-2.094a5.526 5.526 0 0 1-1.488.102zm7.14-8.868A11.517 11.517 0 0 0 9.756 3C4.368 3 .001 7.368.001 12.756c0 5.389 4.367 9.756 9.755 9.756 4.673 0 8.57-3.29 9.516-7.669H16.14a6.544 6.544 0 0 1-6.384 4.669c-3.615 0-6.556-2.94-6.556-6.756 0-3.815 2.941-6.756 6.556-6.756 1.81 0 3.45.735 4.64 1.924l2.49-2.49zM24 12.756C24 5.71 18.29 0 11.244 0c-3.22 0-6.17 1.19-8.42 3.153l2.12 2.12C6.54 3.82 8.76 2.99 11.244 2.99 16.634 2.99 21 7.357 21 12.756c0 5.39-4.366 9.756-9.756 9.756-2.484 0-4.704-.83-6.299-2.283l-2.12 2.12C5.074 24.31 8.024 25.5 11.244 25.5 18.29 25.5 24 19.8 24 12.756z" />
      </svg>
    )
  }
  return <Cpu className={`w-4 h-4 text-zinc-400 ${className}`} />
}

export function AiOmniManager() {
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [handshakeStatus, setHandshakeStatus] = useState<any>(null)
  const [omniData, setOmniData] = useState<any>(null)
  const [bulkJson, setBulkJson] = useState("")

  // Global Provider form
  const [globalProvider, setGlobalProvider] = useState("vertex")
  const [globalModel, setGlobalModel] = useState("gemini-2.5-flash")
  const [globalApiKey, setGlobalApiKey] = useState("")
  const [globalBaseUrl, setGlobalBaseUrl] = useState("")
  const [globalGcpProject, setGlobalGcpProject] = useState("")
  const [globalGcpLocation, setGlobalGcpLocation] = useState("us-central1")

  const loadData = async () => {
    setLoading(true)
    try {
      const [omniRes, hsRes] = await Promise.all([
        fetch("/api/ai/omni").then((r) => r.json()).catch(() => null),
        fetch("/api/ai/handshake").then((r) => r.json()).catch(() => null),
      ])

      if (omniRes?.ok) {
        setOmniData(omniRes)
        if (!bulkJson && Array.isArray(omniRes.models)) {
          setBulkJson(JSON.stringify(omniRes.models.slice(0, 5), null, 2))
        }
      }
      if (hsRes?.ok || hsRes?.status === "connected") {
        setHandshakeStatus(hsRes)
      }
    } catch (err: any) {
      toast.error(`Error loading Omni settings: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleSyncHandshake = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/ai/handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: "global" }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Handshake Sync complete! ${data.synced_models_count || 14} models synchronized to VM.`)
        await loadData()
      } else {
        toast.error(`Handshake failed: ${data.error || "Unknown error"}`)
      }
    } catch (err: any) {
      toast.error(`Handshake error: ${err.message}`)
    } finally {
      setSyncing(false)
    }
  }

  const handleSaveGlobalProvider = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const payload = {
        providers: [
          {
            provider: globalProvider,
            model: globalModel,
            api_key: globalApiKey,
            base_url: globalBaseUrl,
            gcp_project: globalGcpProject,
            gcp_location: globalGcpLocation,
          },
        ],
      }
      let res = await fetch("/api/ai/handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      if (res.status === 403 || res.status === 404) {
        res = await fetch("/api/admin/ai/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }
      const data = await res.json()
      if (data.ok) {
        toast.success(`Global provider ${globalProvider.toUpperCase()} saved & synced!`)
        await loadData()
      } else {
        toast.error(`Save failed: ${data.error}`)
      }
    } catch (err: any) {
      toast.error(`Save error: ${err.message}`)
    }
  }

  const handleApplyBulkJson = async () => {
    if (!bulkJson.trim()) return toast.error("Please enter valid JSON")
    try {
      const parsed = JSON.parse(bulkJson)
      let res = await fetch("/api/ai/handshake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      })
      if (res.status === 403 || res.status === 404) {
        res = await fetch("/api/admin/ai/models", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(parsed),
        })
      }
      const data = await res.json()
      if (data.ok) {
        toast.success(data.message || "Models catalog updated & synced to VM!")
        await loadData()
      } else {
        toast.error(`Import failed: ${data.error}`)
      }
    } catch (err: any) {
      toast.error(`JSON parse error: ${err.message}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & VM Handshake Status */}
      <Card className="border-zinc-800 bg-zinc-950/80 text-zinc-100 shadow-xl backdrop-blur-md">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-indigo-400" />
              <CardTitle className="text-lg font-bold text-white">Sycord Omni AI Router &amp; Handshake</CardTitle>
            </div>
            <CardDescription className="text-zinc-400">
              Manage global AI providers, SWE-bench frontier models, and synchronize credentials securely to the VM.
            </CardDescription>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
              </span>
              <span className="font-medium text-zinc-300">VM Handshake Active</span>
            </div>
            <Button
              onClick={handleSyncHandshake}
              disabled={syncing}
              size="sm"
              className="bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing..." : "Sync to VM"}
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* SWE Benchmark Visual Bar Grid */}
      {omniData?.top_swe_models && omniData.top_swe_models.length > 0 && (
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-400" />
                <CardTitle className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
                  Live SWE-Bench Verified Leaderboard
                </CardTitle>
              </div>
              <Badge variant="outline" className="border-emerald-800 bg-emerald-950/40 text-xs text-emerald-400">
                Frontier Evaluated
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
              {omniData.top_swe_models.map((m: any) => {
                const score = m.swe_bench_score || m.swe_score || 0
                const pct = Math.max(25, Math.min(100, Math.round((score / 75) * 100)))
                return (
                  <div
                    key={m.model_id || m.id}
                    className="flex flex-col items-center justify-between rounded-xl border border-zinc-800/80 bg-zinc-900/50 p-3 text-center transition-all hover:border-zinc-700"
                  >
                    <span className="text-xs font-bold text-emerald-400">{score ? `${score}%` : "Top"}</span>
                    <div className="my-2 flex h-20 w-10 flex-col justify-end overflow-hidden rounded-full bg-zinc-950 p-1">
                      <div
                        style={{ height: `${pct}%` }}
                        className="flex w-full items-start justify-center rounded-full bg-gradient-to-t from-indigo-600 via-indigo-500 to-sky-400 p-1 transition-all"
                      >
                        <SvglIcon brand={m.provider || m.id} size={14} />
                      </div>
                    </div>
                    <span className="truncate text-[11px] font-medium text-zinc-300">{m.name || m.id}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Grid: Global Provider Adder & JSON Bulk Importer */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left: Global Provider Setup */}
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white">Save Global Provider</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Configure root provider credentials (Google Vertex AI, Anthropic, OpenAI, DeepSeek). Models belong purely to the central Omni Router catalog.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-indigo-800/40 bg-indigo-950/30 text-[10px] text-indigo-400">
                Credentials Only
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveGlobalProvider} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-300">Provider Connection</label>
                <select
                  value={globalProvider}
                  onChange={(e) => {
                    const p = e.target.value
                    setGlobalProvider(p)
                    if (p === "vertex") setGlobalModel("gemini-2.5-flash")
                    else if (p === "nim") setGlobalModel("meta/llama-3.3-70b-instruct")
                    else if (p === "openai") setGlobalModel("gpt-4o")
                    else if (p === "anthropic") setGlobalModel("claude-3-7-sonnet")
                    else if (p === "deepseek") setGlobalModel("deepseek-chat")
                  }}
                  className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-zinc-100 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="vertex">Google Cloud Vertex AI (Primary Global Provider)</option>
                  <option value="nim">NVIDIA NIM (Llama 3.3, Nemotron)</option>
                  <option value="anthropic">Anthropic Claude</option>
                  <option value="openai">OpenAI</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="custom">Custom Endpoint / Proxy</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-zinc-300">API Key / Service Account JSON</label>
                <Input
                  type="password"
                  value={globalApiKey}
                  onChange={(e) => setGlobalApiKey(e.target.value)}
                  placeholder="Paste Service Account JSON or API Key"
                  className="border-zinc-800 bg-zinc-900 text-zinc-100 font-mono"
                />
              </div>

              {globalProvider === "vertex" && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-zinc-300">GCP Project ID</label>
                    <Input
                      value={globalGcpProject}
                      onChange={(e) => setGlobalGcpProject(e.target.value)}
                      placeholder="e.g. gen-lang-client-..."
                      className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="font-semibold text-zinc-300">GCP Location</label>
                    <Input
                      value={globalGcpLocation}
                      onChange={(e) => setGlobalGcpLocation(e.target.value)}
                      placeholder="us-central1"
                      className="border-zinc-800 bg-zinc-900 text-zinc-100"
                    />
                  </div>
                </div>
              )}

              {globalProvider === "custom" && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-zinc-300">Base URL</label>
                  <Input
                    value={globalBaseUrl}
                    onChange={(e) => setGlobalBaseUrl(e.target.value)}
                    placeholder="https://your-api.com/v1"
                    className="border-zinc-800 bg-zinc-900 text-zinc-100 font-mono"
                  />
                </div>
              )}

              <Button type="submit" size="sm" className="w-full bg-indigo-600 text-white hover:bg-indigo-500">
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save &amp; Sync Global Provider
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Right: JSON Top Model List & Benchmarks Importer */}
        <Card className="border-zinc-800 bg-zinc-950 text-zinc-100">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-white">Top Models JSON Catalog</CardTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Batch import or update models, SWE benchmarks, token pricing, and capabilities.
                </CardDescription>
              </div>
              <Badge variant="outline" className="border-zinc-700 bg-zinc-900 text-[11px] text-zinc-300">
                JSON Handshake
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Textarea
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              rows={9}
              className="font-mono text-xs border-zinc-800 bg-zinc-900 text-zinc-100"
              placeholder={`[
  {
    "id": "gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "provider": "google",
    "swe_score": 56.2,
    "input_cost": 0.075,
    "output_cost": 0.30
  }
]`}
            />
            <Button
              onClick={handleApplyBulkJson}
              size="sm"
              className="w-full border border-zinc-700 bg-zinc-900 text-zinc-100 hover:bg-zinc-800"
            >
              <FileCode className="mr-1.5 h-3.5 w-3.5 text-indigo-400" />
              Import &amp; Broadcast JSON to VM
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
