"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
  Server,
  Play,
  Square,
  RotateCcw,
  Loader2,
  Check,
  X,
  AlertTriangle,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  Globe,
  Power,
  Lock,
  Terminal,
  ScrollText,
  ChevronDown,
  ChevronUp,
  Wifi,
  WifiOff,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type RunnerStatus = {
  online: boolean
  runner: boolean
  tunnel: boolean
  httpOk?: boolean
  uptime?: string | null
  flaskVersion?: string | null
  warnings?: string[]
  error?: string
  envLoaded?: {
    cloudflareApiKey: boolean
    cloudflareZoneId: boolean
  }
  activeDeployments?: string[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SetupPage() {
  // Runner status
  const [status, setStatus] = useState<RunnerStatus | null>(null)
  const [statusLoading, setStatusLoading] = useState(true)

  // Action loading states
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Live logs
  const [logs, setLogs] = useState<string[]>([])
  const [logsOpen, setLogsOpen] = useState(false)
  const [logType, setLogType] = useState<"runner" | "tunnel" | "all">("runner")
  const logRef = useRef<HTMLDivElement>(null)

  // Setup wizard state
  const [wizardOpen, setWizardOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [loadingStep, setLoadingStep] = useState<number | null>(null)
  const [authUrl, setAuthUrl] = useState<string | null>(null)
  const [tunnelId, setTunnelId] = useState<string | null>(null)
  const [sslCert, setSslCert] = useState("")
  const [sslKey, setSslKey] = useState("")

  // ── Fetch status ────────────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/vps/status")
      const data = await res.json()
      setStatus(data)
    } catch {
      setStatus({ online: false, runner: false, tunnel: false, error: "Network error" })
    } finally {
      setStatusLoading(false)
    }
  }, [])

  // ── Fetch logs ──────────────────────────────────────────────────────────
  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/vps/logs?type=${logType}&lines=100`)
      const data = await res.json()
      if (data.logs) setLogs(data.logs)
    } catch {
      // silent
    }
  }, [logType])

  // ── Auto-refresh status every 15s and logs every 5s ─────────────────────
  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [fetchStatus])

  useEffect(() => {
    if (logsOpen) {
      fetchLogs()
      const interval = setInterval(fetchLogs, 5000)
      return () => clearInterval(interval)
    }
  }, [logsOpen, fetchLogs])

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  // ── Runner actions ──────────────────────────────────────────────────────
  const runAction = async (action: "start" | "stop" | "restart") => {
    try {
      setActionLoading(action)
      const res = await fetch("/api/vps/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      toast.success(data.message)
      // Refresh status after action
      setTimeout(fetchStatus, 1500)
    } catch (err: any) {
      toast.error(err.message || "Failed to execute action")
    } finally {
      setActionLoading(null)
    }
  }

  // ── Setup wizard step execution ─────────────────────────────────────────
  const runStep = async (stepNumber: number, action: string) => {
    try {
      setLoadingStep(stepNumber)
      toast(`Running Step ${stepNumber + 1}...`)

      const body = action === "start_server"
        ? { action, pythonRunnerScript: "", sslCert, sslKey }
        : { action }

      const res = await fetch("/api/vps/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || `Failed step ${stepNumber + 1}.`)
      }

      if (action === "auth") {
        if (data.alreadyAuthorized) {
          toast.success(data.message)
          setCurrentStep(stepNumber + 1)
        } else if (data.authUrl) {
          setAuthUrl(data.authUrl)
          toast.success(data.message)
        }
      } else {
        if (action === "config" && data.tunnelId) {
          setTunnelId(data.tunnelId)
        }
        toast.success(data.message)
        setCurrentStep(stepNumber + 1)
      }

    } catch (error: any) {
      toast.error(error.message || "An error occurred during VPS setup.")
    } finally {
      setLoadingStep(null)
    }
  }

  const handleAuthCompleted = () => setCurrentStep(2)

  // ── Status display helpers ──────────────────────────────────────────────
  const runnerOnline = status?.runner === true
  const tunnelOnline = status?.tunnel === true

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link href="/admin">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Server className="h-6 w-6 text-primary" />
                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                  statusLoading ? "bg-yellow-500 animate-pulse" :
                  runnerOnline ? "bg-green-500" : "bg-red-500"
                }`} />
              </div>
              <span className="text-lg font-semibold">Runner</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {runnerOnline && (
              <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/5">
                <Wifi className="h-3 w-3 mr-1" /> Online
              </Badge>
            )}
            {!runnerOnline && !statusLoading && (
              <Badge variant="outline" className="text-red-500 border-red-500/30 bg-red-500/5">
                <WifiOff className="h-3 w-3 mr-1" /> Offline
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">

        {/* ── Status Card ──────────────────────────────────────────────── */}
        <Card className="border-border">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className={`h-14 w-14 rounded-xl flex items-center justify-center ${
                  runnerOnline ? "bg-green-500/10" : "bg-red-500/10"
                }`}>
                  <Server className={`h-7 w-7 ${runnerOnline ? "text-green-500" : "text-red-500"}`} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">
                    {statusLoading ? "Checking…" : runnerOnline ? "Runner is Online" : "Runner is Offline"}
                  </h2>
                  <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                    {status?.uptime && <span>Uptime: {status.uptime}</span>}
                    {status?.httpOk ? <span className="text-green-400">Flask Serving ✓</span> : status?.runner ? <span className="text-yellow-500">Flask Starting...</span> : <span className="text-red-500">Flask Down</span>}
                    {tunnelOnline && <span className="text-blue-400">Tunnel ✓</span>}
                    {status?.online && !tunnelOnline && <span className="text-yellow-500">No tunnel</span>}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {!runnerOnline && (
                  <Button
                    onClick={() => runAction("start")}
                    disabled={!!actionLoading}
                    className="bg-green-600 hover:bg-green-700"
                    size="sm"
                  >
                    {actionLoading === "start" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Play className="h-4 w-4 mr-1" />}
                    Start
                  </Button>
                )}
                {runnerOnline && (
                  <>
                    <Button
                      onClick={() => runAction("restart")}
                      disabled={!!actionLoading}
                      variant="outline"
                      size="sm"
                    >
                      {actionLoading === "restart" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1" />}
                      Restart
                    </Button>
                    <Button
                      onClick={() => runAction("stop")}
                      disabled={!!actionLoading}
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:text-red-400 border-red-500/30"
                    >
                      {actionLoading === "stop" ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Square className="h-4 w-4 mr-1" />}
                      Stop
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ── Warnings ─────────────────────────────────────────────────── */}
        {status?.warnings && status.warnings.length > 0 && (
          <Card className="border-yellow-500/30 bg-yellow-500/5">
            <CardContent className="p-4 space-y-2">
              {status.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-sm">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
                  <span className="text-yellow-200">{w}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── Live Logs ────────────────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setLogsOpen(!logsOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <ScrollText className="h-4 w-4" />
                Live Logs
              </CardTitle>
              <div className="flex items-center gap-2">
                {logsOpen && (
                  <div className="flex gap-1">
                    {(["runner", "tunnel", "all"] as const).map(t => (
                      <button
                        key={t}
                        onClick={(e) => { e.stopPropagation(); setLogType(t) }}
                        className={`px-2 py-0.5 rounded text-xs ${logType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                )}
                {logsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </div>
            </div>
          </CardHeader>
          {logsOpen && (
            <CardContent className="pt-0">
              <div
                ref={logRef}
                className="bg-black/50 rounded-lg p-3 font-mono text-xs leading-relaxed max-h-80 overflow-auto border border-border"
              >
                {logs.length === 0 ? (
                  <span className="text-muted-foreground">No logs available</span>
                ) : (
                  logs.map((line, i) => (
                    <div key={i} className={`${
                      line.includes("[ERROR]") || line.includes("[FATAL]") ? "text-red-400" :
                      line.includes("[WARN]") ? "text-yellow-400" :
                      line.includes("[INFO]") ? "text-zinc-400" : "text-zinc-500"
                    }`}>
                      {line}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          )}
        </Card>

        {/* ── Active Deployments ───────────────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Active Deployments
            </CardTitle>
            <CardDescription className="text-xs">
              List of currently running mini-servers
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status?.activeDeployments && status.activeDeployments.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {status.activeDeployments.map((domain) => (
                  <Badge key={domain} variant="outline" className="text-green-400 border-green-500/30">
                    {domain}
                  </Badge>
                ))}
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No active deployments found.</span>
            )}
          </CardContent>
        </Card>

        {/* ── Setup Wizard (collapsible) ───────────────────────────────── */}
        <Card className="border-border">
          <CardHeader className="pb-2 cursor-pointer" onClick={() => setWizardOpen(!wizardOpen)}>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="h-4 w-4" />
                Setup Wizard
                {currentStep >= 4 && <Badge variant="outline" className="text-green-500 border-green-500/30 ml-2 text-xs">Completed</Badge>}
              </CardTitle>
              {wizardOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
            <CardDescription className="text-xs mt-1">
              First-time setup: install dependencies, authorize Cloudflare, configure tunnel, and start the runner.
            </CardDescription>
          </CardHeader>
          {wizardOpen && (
            <CardContent className="space-y-4 pt-2">

              {/* Step 1: Init */}
              <div className={`p-4 rounded-lg border transition-all ${currentStep === 0 ? "border-primary bg-primary/5" : currentStep > 0 ? "border-border opacity-60" : "border-border opacity-40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep >= 0 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>1</span>
                    <span className="text-sm font-medium">Load .env & Initialize VPS</span>
                  </div>
                  {currentStep > 0 ? <Check className="h-4 w-4 text-green-500" /> : currentStep === 0 && (
                    <Button onClick={() => runStep(0, "init")} disabled={loadingStep === 0} size="sm" variant="outline">
                      {loadingStep === 0 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                {currentStep === 0 && status?.envLoaded && (
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className={status.envLoaded.cloudflareZoneId ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}>
                      Zone ID: {status.envLoaded.cloudflareZoneId ? "Loaded" : "Missing"}
                    </Badge>
                    <Badge variant="outline" className={status.envLoaded.cloudflareApiKey ? "text-green-500 border-green-500/30" : "text-yellow-500 border-yellow-500/30"}>
                      API Key: {status.envLoaded.cloudflareApiKey ? "Loaded" : "Missing"}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Step 2: Auth */}
              <div className={`p-4 rounded-lg border transition-all ${currentStep === 1 ? "border-primary bg-primary/5" : currentStep > 1 ? "border-border opacity-60" : "border-border opacity-40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep >= 1 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>2</span>
                    <span className="text-sm font-medium">Authorize Cloudflare</span>
                  </div>
                  {currentStep > 1 ? <Check className="h-4 w-4 text-green-500" /> : currentStep === 1 && !authUrl && (
                    <Button onClick={() => runStep(1, "auth")} disabled={loadingStep === 1} size="sm" variant="outline">
                      {loadingStep === 1 ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldCheck className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                {currentStep === 1 && authUrl && (
                  <div className="mt-3 flex gap-2">
                    <a href={authUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs text-primary hover:underline">
                      Open auth link <ExternalLink className="ml-1 h-3 w-3" />
                    </a>
                    <Button variant="outline" size="sm" onClick={handleAuthCompleted} className="text-xs h-7">
                      Done
                    </Button>
                  </div>
                )}
              </div>

              {/* Step 3: Config */}
              <div className={`p-4 rounded-lg border transition-all ${currentStep === 2 ? "border-primary bg-primary/5" : currentStep > 2 ? "border-border opacity-60" : "border-border opacity-40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep >= 2 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>3</span>
                    <span className="text-sm font-medium">Configure Tunnel & DNS</span>
                  </div>
                  {currentStep > 2 ? <Check className="h-4 w-4 text-green-500" /> : currentStep === 2 && (
                    <Button onClick={() => runStep(2, "config")} disabled={loadingStep === 2} size="sm" variant="outline">
                      {loadingStep === 2 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Globe className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
              </div>

              {/* Step 4: Start */}
              <div className={`p-4 rounded-lg border transition-all ${currentStep === 3 ? "border-primary bg-primary/5" : currentStep > 3 ? "border-border opacity-60" : "border-border opacity-40"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${currentStep >= 3 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>4</span>
                    <span className="text-sm font-medium">Start Server</span>
                  </div>
                  {currentStep > 3 ? <Check className="h-4 w-4 text-green-500" /> : currentStep === 3 && (
                    <Button onClick={() => runStep(3, "start_server")} disabled={loadingStep === 3} size="sm" className="bg-green-600 hover:bg-green-700 text-white">
                      {loadingStep === 3 ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
                    </Button>
                  )}
                </div>
                {currentStep === 3 && (
                  <div className="mt-3 space-y-3">
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer flex items-center gap-1">
                        <Lock className="h-3 w-3" /> Optional: SSL certificates
                      </summary>
                      <div className="grid gap-2 md:grid-cols-2 mt-2">
                        <Textarea placeholder="cert.pem" className="font-mono text-xs h-20 resize-none" value={sslCert} onChange={e => setSslCert(e.target.value)} />
                        <Textarea placeholder="privkey.pem" className="font-mono text-xs h-20 resize-none" value={sslKey} onChange={e => setSslKey(e.target.value)} />
                      </div>
                    </details>
                  </div>
                )}
              </div>

              {/* Completed */}
              {currentStep >= 4 && (
                <div className="flex items-center justify-between p-4 rounded-lg border border-green-500/30 bg-green-500/5">
                  <div className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-500" />
                    <span className="text-sm font-medium text-green-400">Setup Complete</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <a href="https://server.sycord.site" target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
                      Test <ExternalLink className="h-3 w-3" />
                    </a>
                    <Button variant="ghost" size="sm" onClick={() => { setCurrentStep(0); setAuthUrl(null) }} className="text-xs h-7 text-muted-foreground">
                      Reset
                    </Button>
                  </div>
                </div>
              )}

            </CardContent>
          )}
        </Card>

      </main>
    </div>
  )
}
