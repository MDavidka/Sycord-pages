"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Activity,
  AlertCircle,
  Cloud,
  Cpu,
  Globe2,
  HardDrive,
  RotateCcw,
  Server,
  Play,
  Square,
  RefreshCw,
  Heart,
  Trash2,
  FileText,
  CheckCircle2,
  XCircle,
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
  fetchVpsStatus: () => void
  handleVpsAction: (action: "start" | "stop" | "destroy") => void
  handleWebsiteAction: (id: string, action: "start" | "stop" | "restart" | "health" | "destroy") => void
  fetchVpsLogs: (id?: string) => void
  setVpsLogType: (type: string) => void
  setSelectedWebsiteId: (id: string | null) => void
  openDebugger: (payload: {
    title: string
    message: string
    phase?: string | null
    logs?: string
    details?: Record<string, unknown> | null
  }) => void
}

export function RunnerTabContent(props: RunnerTabProps) {
  const {
    vpsStatus,
    vpsLoading,
    vpsWebsites,
    vpsAction,
    vpsLogs,
    vpsLogType,
    selectedWebsiteId,
    fetchVpsStatus,
    handleVpsAction,
    handleWebsiteAction,
    fetchVpsLogs,
    setVpsLogType,
    setSelectedWebsiteId,
    openDebugger,
  } = props

  useEffect(() => {
    fetchVpsStatus()
  }, [])

  const isOnline = !!vpsStatus?.online
  const isDegraded = !isOnline && !!(vpsStatus?.degraded || vpsStatus?.debug?.sshReachable)

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
