"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import {
  Activity,
  AlertCircle,
  Cloud,
  Cpu,
  Globe2,
  HardDrive,
  Loader2,
  RotateCcw,
  Server,
  Wrench,
  Play,
  Square,
  RefreshCw,
  Heart,
  Trash2,
  FileText,
  Terminal,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  EyeOff,
  Network,
} from "lucide-react"

type RunnerTabProps = {
  vpsStatus: any
  vpsLoading: boolean
  vpsWebsites: any[]
  vpsAction: string | null
  vpsLogs: string[]
  vpsLogType: string
  vpsLogLines: number
  selectedWebsiteId: string | null
  runnerSetupError: string | null
  runnerSetupLogs: string
  fetchVpsStatus: () => void
  handleVpsAction: (action: "start" | "stop" | "setup" | "destroy") => void
  handleWebsiteAction: (id: string, action: "start" | "stop" | "restart" | "health" | "destroy") => void
  fetchVpsLogs: (id?: string) => void
  runRunnerSetup: () => void
  setVpsLogType: (type: string) => void
  setSelectedWebsiteId: (id: string | null) => void
  openDebugger: (payload: {
    title: string
    message: string
    phase?: string | null
    logs?: string
    details?: Record<string, unknown> | null
  }) => void
  onAutoFix: () => void
}

type SetupStep = {
  id: string
  label: string
  description: string
  status: "pending" | "running" | "success" | "error"
  message: string
}

const SETUP_STEPS: SetupStep[] = [
  { id: "ssh-check", label: "SSH Connectivity", description: "Root SSH to deploy VM", status: "pending", message: "" },
  { id: "runner-check", label: "Runner API", description: "Check if runner is already running", status: "pending", message: "" },
  { id: "bootstrap", label: "Bootstrap", description: "Upload files and run setup scripts", status: "pending", message: "" },
  { id: "diagnostics", label: "Diagnostics", description: "Collect final system diagnostics", status: "pending", message: "" },
  { id: "complete", label: "Complete", description: "Runner is ready to deploy websites", status: "pending", message: "" },
]

export function RunnerTabContent(props: RunnerTabProps) {
  const {
    vpsStatus,
    vpsLoading,
    vpsWebsites,
    vpsAction,
    vpsLogs,
    vpsLogType,
    selectedWebsiteId,
    runnerSetupError,
    runnerSetupLogs,
    fetchVpsStatus,
    handleVpsAction,
    handleWebsiteAction,
    fetchVpsLogs,
    runRunnerSetup,
    setVpsLogType,
    setSelectedWebsiteId,
    openDebugger,
    onAutoFix,
  } = props

  const [setupStreaming, setSetupStreaming] = useState(false)
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>(SETUP_STEPS.map(s => ({ ...s })))
  const [setupLogs, setSetupLogs] = useState<string[]>([])
  const [setupResult, setSetupResult] = useState<any>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [setupPanelOpen, setSetupPanelOpen] = useState(false)
  const logRef = useRef<HTMLDivElement | null>(null)

  // VM Configuration state
  const [vmConfigOpen, setVmConfigOpen] = useState(false)
  const [vmHost, setVmHost] = useState("")
  const [vmPort, setVmPort] = useState("22")
  const [vmPassword, setVmPassword] = useState("")
  const [vmBaseDomain, setVmBaseDomain] = useState("sycord.site")
  const [showPassword, setShowPassword] = useState(false)
  const [testingSsh, setTestingSsh] = useState(false)
  const [sshTestResult, setSshTestResult] = useState<{ success: boolean; error?: string } | null>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [setupLogs])

  useEffect(() => {
    fetchVpsStatus()
  }, [])

  // Test SSH connection to a custom VM
  const testSshConnection = async () => {
    if (!vmHost || !vmPassword) {
      toast.error("Please enter VM IP and root password")
      return
    }
    setTestingSsh(true)
    setSshTestResult(null)
    try {
      const res = await fetch("/api/admin/vps-runner/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: vmHost,
          port: parseInt(vmPort) || 22,
          rootPassword: vmPassword,
          baseDomain: vmBaseDomain,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setSshTestResult({ success: true })
        toast.success("SSH connection successful!")
      } else {
        setSshTestResult({ success: false, error: data.error || "SSH connection failed" })
        toast.error(data.error || "SSH connection failed")
      }
    } catch (err: any) {
      setSshTestResult({ success: false, error: err?.message || "Test failed" })
      toast.error(err?.message || "Test failed")
    } finally {
      setTestingSsh(false)
    }
  }

  const startStreamingSetup = async (useCustomVm = false) => {
    setSetupStreaming(true)
    setSetupPanelOpen(true)
    setSetupLogs([])
    setSetupResult(null)
    setSetupError(null)
    setSetupSteps(SETUP_STEPS.map(s => ({ ...s, message: "" })))

    try {
      // If custom VM credentials are provided, use POST with body
      const fetchOptions: RequestInit = useCustomVm && vmHost && vmPassword
        ? {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              host: vmHost,
              port: parseInt(vmPort) || 22,
              rootPassword: vmPassword,
              baseDomain: vmBaseDomain,
            }),
          }
        : { method: "GET" }

      const res = await fetch("/api/admin/vps-runner/setup/stream", fetchOptions)
      if (!res.ok || !res.body) throw new Error("Setup stream failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split("\n\n")
        buffer = blocks.pop() || ""

        for (const block of blocks) {
          const eventLine = block.split("\n").find(l => l.startsWith("event:"))
          const dataLine = block.split("\n").find(l => l.startsWith("data:"))
          if (!eventLine || !dataLine) continue
          const eventType = eventLine.slice(6).trim()
          try {
            const data = JSON.parse(dataLine.slice(5).trim())
            if (eventType === "stage") {
              setSetupSteps(prev => prev.map(s =>
                s.id === data.stage ? { ...s, status: data.status, message: data.message } : s
              ))
            } else if (eventType === "log") {
              setSetupLogs(prev => [...prev, data.line || ""])
            } else if (eventType === "result") {
              setSetupResult(data)
              toast.success("Runner setup completed")
            } else if (eventType === "error") {
              setSetupError(data.error || "Setup failed")
              toast.error(data.error || "Setup failed")
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setSetupError(err?.message || "Setup stream failed")
      toast.error(err?.message || "Setup stream failed")
    } finally {
      setSetupStreaming(false)
      fetchVpsStatus()
    }
  }

  const isOnline = !!vpsStatus?.online
  const isDegraded = !isOnline && !!(vpsStatus?.degraded || vpsStatus?.debug?.sshReachable)
  const needsSetup = !isOnline && !isDegraded && !vpsStatus?.apiOnline && !vpsStatus?.nginx?.running

  const runningSites = vpsWebsites.filter(s => s?.status === "running" || s?.running).length
  const failedSites = vpsWebsites.filter(s => s?.status === "failed" || s?.health === "unhealthy").length

  const statusCards = [
    {
      label: "CPU",
      value: vpsStatus?.cpu != null ? `${(Number(vpsStatus.cpu)).toFixed(1)} load` : "—",
      icon: Cpu,
      ok: vpsStatus?.cpu != null && Number(vpsStatus.cpu) < 4,
    },
    {
      label: "Memory",
      value: vpsStatus?.mem?.percent != null ? `${vpsStatus.mem.percent}%` : "—",
      icon: Activity,
      ok: vpsStatus?.mem?.percent != null && Number(vpsStatus.mem.percent) < 90,
    },
    {
      label: "Disk",
      value: vpsStatus?.disk?.percent || "—",
      icon: HardDrive,
      ok: vpsStatus?.disk?.percent != null && parseInt(vpsStatus.disk.percent) < 90,
    },
    {
      label: "Nginx :80",
      value: vpsStatus?.nginx?.running
        ? "Active" : vpsStatus?.nginx?.port80Available === false ? "Port blocked" : "Down",
      icon: Server,
      ok: !!vpsStatus?.nginx?.running,
    },
    {
      label: "Runner :5050",
      value: vpsStatus?.runner?.running ? "Active" : "Down",
      icon: Activity,
      ok: !!vpsStatus?.runner?.running,
    },
    {
      label: "Cloudflare Tunnel",
      value: vpsStatus?.cloudflared?.running
        ? "Connected" : vpsStatus?.tunnel?.status || "Disconnected",
      icon: Cloud,
      ok: !!(vpsStatus?.cloudflared?.running || vpsStatus?.tunnel?.ok),
    },
    {
      label: "Running sites",
      value: `${runningSites}`,
      icon: Globe2,
      ok: true,
    },
    {
      label: "Failed sites",
      value: `${failedSites}`,
      icon: AlertCircle,
      ok: failedSites === 0,
    },
  ]

  const setupChecklist = [
    { label: "Runner API reachable", ok: !!vpsStatus?.apiOnline || isOnline },
    { label: "Runner listening on 5050", ok: !!vpsStatus?.runner?.running },
    { label: "Port 80 free for Nginx", ok: vpsStatus?.nginx?.port80Available !== false },
    { label: "Nginx active on :80", ok: !!vpsStatus?.nginx?.running },
    { label: "Cloudflare Tunnel connected", ok: !!(vpsStatus?.cloudflared?.running || vpsStatus?.tunnel?.ok) },
    { label: "Sites directory ready", ok: !!(vpsStatus?.setup?.sitesDirReady || vpsStatus?.setupComplete) },
  ]
  const allSetupOk = setupChecklist.every(i => i.ok)

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Runner</h2>
            <p className="text-sm text-white/50 mt-1">
              Ubuntu mini-server — builds and runs generated Next.js websites
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isOnline ? (
              <Badge className="rounded-full border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs px-3 py-1">
                <CheckCircle2 className="h-3 w-3 mr-1.5" />
                Online
              </Badge>
            ) : isDegraded ? (
              <Badge className="rounded-full border-amber-500/30 bg-amber-500/10 text-amber-400 text-xs px-3 py-1">
                <AlertCircle className="h-3 w-3 mr-1.5" />
                Degraded
              </Badge>
            ) : (
              <Badge className="rounded-full border-red-500/30 bg-red-500/10 text-red-400 text-xs px-3 py-1">
                <XCircle className="h-3 w-3 mr-1.5" />
                Offline
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={() => { fetchVpsStatus(); fetchVpsLogs() }} className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl">
              <RotateCcw className="h-4 w-4 mr-1.5" />Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Warning banner */}
      {vpsStatus?.warning && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-semibold">
            <AlertCircle className="h-4 w-4" />
            Warning
          </div>
          <p>{vpsStatus.warning}</p>
          {vpsStatus?.nginx?.port80Owner && (
            <pre className="whitespace-pre-wrap rounded-lg border border-amber-400/20 bg-black/30 p-3 text-xs text-amber-100/90 max-h-32 overflow-y-auto">
              {vpsStatus.nginx.port80Owner}
            </pre>
          )}
        </div>
      )}

      {/* Port 80 conflict banner */}
      {vpsStatus?.nginx?.port80Available === false && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100 space-y-3">
          <div className="flex items-center gap-2 font-semibold">
            <XCircle className="h-4 w-4" />
            Port 80 is in use — Nginx cannot bind
          </div>
          {vpsStatus?.nginx?.port80Owner && (
            <pre className="whitespace-pre-wrap rounded-lg border border-red-400/20 bg-black/30 p-3 text-xs text-red-100/90 max-h-32 overflow-y-auto">
              {vpsStatus.nginx.port80Owner}
            </pre>
          )}
          <div className="flex flex-wrap gap-2">
            <Button onClick={onAutoFix} disabled={!!vpsAction || setupStreaming} className="bg-red-500 text-white hover:bg-red-400 rounded-xl">
              <Wrench className="h-4 w-4 mr-1.5" />
              Fix port 80 conflict
            </Button>
            <Button
              variant="outline"
              className="border-red-400/30 text-red-100 hover:bg-red-500/20 rounded-xl"
              onClick={() => openDebugger({
                title: "Port 80 conflict",
                message: vpsStatus?.nginx?.error || "Port 80 conflict detected",
                phase: "nginx-port-80",
                logs: vpsStatus?.nginx?.port80Owner || "",
                details: vpsStatus?.diagnostics || null,
              })}
            >
              Open debugger
            </Button>
          </div>
        </div>
      )}

      {/* Status cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
        {statusCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs uppercase tracking-wide text-white/40">{card.label}</p>
                <div className="flex items-center gap-1.5">
                  <Icon className="h-4 w-4 text-white/40" />
                  {card.ok !== undefined && (
                    <div className={`h-1.5 w-1.5 rounded-full ${card.ok ? "bg-emerald-500" : "bg-red-500"}`} />
                  )}
                </div>
              </div>
              <p className="text-lg font-semibold text-white">{card.value}</p>
            </div>
          )
        })}
      </div>

      {/* Action bar */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-5">
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs uppercase tracking-wide text-white/40 mr-2">Actions</p>
          <Button
            onClick={() => startStreamingSetup(false)}
            disabled={!!vpsAction || setupStreaming}
            className="bg-blue-600 hover:bg-blue-700 rounded-xl"
          >
            {setupStreaming ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wrench className="h-4 w-4 mr-1.5" />}
            Setup Runner
          </Button>
          <Button
            onClick={() => setVmConfigOpen(!vmConfigOpen)}
            variant="outline"
            className="border-purple-500/30 text-purple-300 hover:bg-purple-500/10 rounded-xl"
          >
            <Network className="h-4 w-4 mr-1.5" />
            Custom VM
          </Button>
          <Button onClick={() => handleVpsAction("start")} disabled={!!vpsAction} variant="outline" className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 rounded-xl">
            <Play className="h-4 w-4 mr-1.5" />Start
          </Button>
          <Button onClick={() => handleVpsAction("stop")} disabled={!!vpsAction} variant="outline" className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 rounded-xl">
            <Square className="h-4 w-4 mr-1.5" />Stop
          </Button>
          <Button
            onClick={() => { if (prompt('Type DESTROY to confirm') === 'DESTROY') handleVpsAction("destroy") }}
            disabled={!!vpsAction}
            variant="outline"
            className="border-red-500/30 text-red-300 hover:bg-red-500/10 rounded-xl"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />Destroy
          </Button>
        </div>
      </div>

      {/* Custom VM Configuration Panel */}
      {vmConfigOpen && (
        <div className="rounded-2xl bg-white/[0.03] border border-purple-500/20 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Network className="h-4 w-4 text-purple-400" />
                Custom VM Configuration
              </h3>
              <p className="text-sm text-white/40 mt-1">Connect to your own VPS with root access to deploy websites</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setVmConfigOpen(false)} className="text-white/60">
              Hide
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Form fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">VM IP Address</label>
                <Input
                  type="text"
                  placeholder="e.g., 192.168.1.100 or server.example.com"
                  value={vmHost}
                  onChange={(e) => setVmHost(e.target.value)}
                  className="bg-black/40 border-white/10 text-white placeholder:text-white/30"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">SSH Port</label>
                <Input
                  type="number"
                  placeholder="22"
                  value={vmPort}
                  onChange={(e) => setVmPort(e.target.value)}
                  className="bg-black/40 border-white/10 text-white placeholder:text-white/30 w-32"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">Root Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Root password for SSH"
                    value={vmPassword}
                    onChange={(e) => setVmPassword(e.target.value)}
                    className="bg-black/40 border-white/10 text-white placeholder:text-white/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/60"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-white/30">Password is only used during setup and never stored</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-white/70">Base Domain</label>
                <Input
                  type="text"
                  placeholder="sycord.site"
                  value={vmBaseDomain}
                  onChange={(e) => setVmBaseDomain(e.target.value)}
                  className="bg-black/40 border-white/10 text-white placeholder:text-white/30"
                />
                <p className="text-[10px] text-white/30">Sites will be deployed as subdomain.{vmBaseDomain || "yourdomain.com"}</p>
              </div>
            </div>

            {/* Status and actions */}
            <div className="space-y-4">
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <h4 className="text-sm font-medium text-white/70 mb-3">Connection Status</h4>
                {sshTestResult ? (
                  <div className={`flex items-center gap-2 text-sm ${sshTestResult.success ? "text-emerald-400" : "text-red-400"}`}>
                    {sshTestResult.success ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        SSH connection successful
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4" />
                        {sshTestResult.error || "Connection failed"}
                      </>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-white/40">Not tested yet</p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={testSshConnection}
                  disabled={testingSsh || !vmHost || !vmPassword}
                  variant="outline"
                  className="border-white/10 text-white hover:bg-white/10 rounded-xl"
                >
                  {testingSsh ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Activity className="h-4 w-4 mr-1.5" />}
                  Test SSH
                </Button>
                <Button
                  onClick={() => startStreamingSetup(true)}
                  disabled={setupStreaming || !vmHost || !vmPassword}
                  className="bg-purple-600 hover:bg-purple-700 rounded-xl"
                >
                  {setupStreaming ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wrench className="h-4 w-4 mr-1.5" />}
                  Install Sycord Runner
                </Button>
              </div>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-200/80">
                  <AlertCircle className="h-3.5 w-3.5 inline mr-1.5" />
                  Ensure your VM has a fresh Ubuntu 22.04+ installation with root access and ports 22, 80, and 5050 open.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup wizard panel */}
      {setupPanelOpen && (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-white flex items-center gap-2">
                <Wrench className="h-4 w-4 text-blue-400" />
                Runner Setup
              </h3>
              <p className="text-sm text-white/40 mt-1">Installing dependencies and configuring the deploy VM</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSetupPanelOpen(false)} className="text-white/60">
              Hide
            </Button>
          </div>

          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            {/* Steps */}
            <div className="space-y-2">
              {setupSteps.map((step) => {
                const Icon =
                  step.status === "success" ? CheckCircle2 :
                  step.status === "running" ? Loader2 :
                  step.status === "error" ? XCircle :
                  Clock
                return (
                  <div key={step.id} className={`rounded-xl border px-3 py-3 text-sm transition-colors ${
                    step.status === "running" ? "border-amber-500/40 bg-amber-500/5" :
                    step.status === "success" ? "border-emerald-500/20 bg-emerald-500/5" :
                    step.status === "error" ? "border-red-500/40 bg-red-500/5" :
                    "border-white/[0.06] bg-black/10"
                  }`}>
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 shrink-0 ${
                        step.status === "success" ? "text-emerald-400" :
                        step.status === "running" ? "text-amber-300 animate-spin" :
                        step.status === "error" ? "text-red-400" :
                        "text-zinc-600"
                      }`} />
                      <span className={`font-medium ${
                        step.status === "running" ? "text-amber-200" :
                        step.status === "success" ? "text-emerald-200" :
                        step.status === "error" ? "text-red-200" :
                        "text-zinc-500"
                      }`}>{step.label}</span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1 ml-6">{step.description}</p>
                    {step.message && (
                      <p className="text-xs text-zinc-400 mt-1 ml-6">{step.message}</p>
                    )}
                  </div>
                )
              })}

              {setupResult && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                  <p className="text-emerald-300 font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Setup complete
                  </p>
                  <Button onClick={() => setSetupPanelOpen(false)} variant="ghost" size="sm" className="mt-2 text-emerald-300">
                    Close panel
                  </Button>
                </div>
              )}
              {setupError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm">
                  <p className="text-red-300 font-medium flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Setup failed
                  </p>
                  <p className="text-xs text-red-200 mt-1">{setupError}</p>
                  <Button onClick={() => startStreamingSetup()} variant="outline" size="sm" className="mt-2 border-red-500/30 text-red-300 hover:bg-red-500/10">
                    Retry
                  </Button>
                </div>
              )}
            </div>

            {/* Live terminal */}
            <div className="rounded-xl border border-white/[0.08] bg-black/40 flex flex-col min-h-[300px]">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <Terminal className="h-3.5 w-3.5" />
                  Setup output
                </div>
                {setupStreaming && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />}
              </div>
              <div ref={logRef} className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-5 max-h-[360px]">
                {setupLogs.length === 0 ? (
                  <p className="text-zinc-600 text-center py-8">
                    {setupStreaming ? "Waiting for output..." : "No output yet"}
                  </p>
                ) : (
                  setupLogs.map((line, i) => (
                    <p key={i} className={`${
                      /error|fail|ERR/i.test(line) ? "text-red-300" :
                      /warn/i.test(line) ? "text-amber-300" :
                      /success|complete|ok|active/i.test(line) ? "text-emerald-300" :
                      "text-zinc-400"
                    }`}>{line}</p>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Setup checklist (collapsible, shown when runner is offline) */}
      {!allSetupOk && !setupPanelOpen && (
        <div className="rounded-2xl bg-white/[0.03] border border-amber-500/20 bg-amber-500/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              Runner needs setup
            </h3>
            <Button onClick={() => startStreamingSetup(false)} disabled={setupStreaming} className="bg-blue-600 hover:bg-blue-700 rounded-xl" size="sm">
              {setupStreaming ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Wrench className="h-4 w-4 mr-1.5" />}
              Setup now
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {setupChecklist.map((item) => (
              <div key={item.label} className="flex items-center gap-2 rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
                {item.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <div className="h-3.5 w-3.5 rounded-full border border-zinc-600 shrink-0" />
                )}
                <span className={`text-xs ${item.ok ? "text-emerald-300" : "text-zinc-500"}`}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error display */}
      {(runnerSetupError || runnerSetupLogs) && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-2">
          {runnerSetupError && <p className="text-sm text-red-200 font-medium">Setup error: {runnerSetupError}</p>}
          {runnerSetupLogs && (
            <pre className="text-xs text-red-100/90 whitespace-pre-wrap max-h-48 overflow-y-auto rounded-lg border border-red-400/20 bg-black/30 p-3">
              {runnerSetupLogs}
            </pre>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-red-400/30 text-red-100 hover:bg-red-500/20"
            onClick={() => openDebugger({
              title: "Runner setup error",
              message: runnerSetupError || "Setup logs",
              phase: "setup",
              logs: runnerSetupLogs,
              details: null,
            })}
          >
            Open debugger
          </Button>
        </div>
      )}

      {/* Website table */}
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.08] overflow-hidden">
        <div className="px-5 py-4 border-b border-white/[0.06]">
          <h3 className="text-base font-semibold text-white">
            Websites
            {vpsWebsites.length > 0 && (
              <span className="ml-2 text-sm text-white/40">({vpsWebsites.length})</span>
            )}
          </h3>
        </div>

        {vpsWebsites.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <Globe2 className="h-8 w-8 text-white/10 mx-auto mb-3" />
            <p className="text-sm text-white/40">No websites deployed yet</p>
            <p className="text-xs text-white/20 mt-1">Generated sites will appear here after deployment</p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {vpsWebsites.map((site) => (
              <div key={site.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-white/[0.02]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-white font-medium text-sm truncate">{site.domain || site.subdomain || site.id}</p>
                    <Badge className={`rounded-full text-[10px] px-1.5 py-0 h-5 ${
                      site.health === "healthy" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                      site.health === "unhealthy" || site.status === "failed" ? "border-red-500/30 bg-red-500/10 text-red-400" :
                      "border-white/10 bg-white/5 text-white/40"
                    }`}>
                      {site.status || "unknown"}
                    </Badge>
                    <Badge className={`rounded-full text-[10px] px-1.5 py-0 h-5 ${
                      site.health === "healthy" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" :
                      "border-red-500/30 bg-red-500/10 text-red-400"
                    }`}>
                      <Heart className="h-2.5 w-2.5 mr-1" />
                      {site.health || "unknown"}
                    </Badge>
                  </div>
                  <p className="text-xs text-white/30">
                    Port {site.port || "—"} · {site.processName || "—"}
                    {site.lastDeployAt && ` · Last deploy ${new Date(site.lastDeployAt).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/10" onClick={() => handleWebsiteAction(site.id, "start")}>
                    <Play className="h-3 w-3 mr-1" />Start
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/10" onClick={() => handleWebsiteAction(site.id, "stop")}>
                    <Square className="h-3 w-3 mr-1" />Stop
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/10" onClick={() => handleWebsiteAction(site.id, "restart")}>
                    <RefreshCw className="h-3 w-3 mr-1" />Restart
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/10" onClick={() => handleWebsiteAction(site.id, "health")}>
                    <Heart className="h-3 w-3 mr-1" />Health
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-red-500/20 text-red-300 hover:bg-red-500/10" onClick={() => handleWebsiteAction(site.id, "destroy")}>
                    <Trash2 className="h-3 w-3 mr-1" />Destroy
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs border-white/10 hover:bg-white/10" onClick={() => { setSelectedWebsiteId(site.id); fetchVpsLogs(site.id) }}>
                    <FileText className="h-3 w-3 mr-1" />Logs
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Log viewer */}
      <div className="rounded-2xl bg-black/40 border border-white/[0.08] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
          <p className="text-xs font-medium text-white/50 uppercase tracking-wider">
            {selectedWebsiteId ? `Logs · ${selectedWebsiteId.slice(-12)}` : "Website logs"}
          </p>
          <div className="flex items-center gap-2">
            <select
              value={vpsLogType}
              onChange={(e) => setVpsLogType(e.target.value)}
              className="bg-black/40 border border-white/10 text-xs text-white/60 rounded-lg px-2 py-1.5 appearance-none cursor-pointer hover:border-white/20"
            >
              <option value="deploy">deploy</option>
              <option value="build">build</option>
              <option value="runtime">runtime</option>
              <option value="error">error</option>
              <option value="health">health</option>
            </select>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => fetchVpsLogs()}>
              <RotateCcw className="h-3 w-3 mr-1" />Refresh
            </Button>
          </div>
        </div>
        <div className="max-h-[400px] overflow-y-auto font-mono text-[11px] leading-5 p-4">
          {vpsLogs.length === 0 ? (
            <p className="text-zinc-600 text-center py-12">
              {selectedWebsiteId ? "No logs available" : "Select a website and click Logs to view output"}
            </p>
          ) : (
            vpsLogs.map((line, i) => (
              <p key={i} className={`${
                /error|fail|exception/i.test(line) ? "text-red-300" :
                /warn/i.test(line) ? "text-amber-300" :
                /success|complete|ready|healthy/i.test(line) ? "text-emerald-300" :
                "text-zinc-400"
              }`}>{line}</p>
            ))
          )}
        </div>
      </div>
    </div>
  )
}


