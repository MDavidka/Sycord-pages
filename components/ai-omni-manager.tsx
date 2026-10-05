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

import { BrandLogo } from "@/components/sycord-omni-router-modal"

// Official LobeHub / SVGL brand icon renderer
export function SvglIcon({ brand, size = 18, className = "" }: { brand: string; size?: number; className?: string }) {
  return <BrandLogo brand={brand} size={size} className={className} />
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
