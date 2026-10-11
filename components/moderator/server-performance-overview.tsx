"use client"

import React, { useState, useEffect } from "react"
import { Cpu, HardDrive, Activity, ArrowRight, RefreshCw, AlertCircle, Server, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface VmMetrics {
  available: boolean
  error?: string
  cpu?: {
    loadAvg: number
    cores?: number
    usagePercent?: number
  }
  memory?: {
    totalBytes: number
    freeBytes: number
    usedBytes: number
    usagePercent: number
  }
  disk?: {
    usagePercent: number | null
    raw?: string
  }
  bandwidth?: {
    status: string
  }
  timestamp?: string
}

interface MetricSample {
  time: string
  cpu: number
  mem: number
}

interface ServerPerformanceOverviewProps {
  onScrollToDetails?: () => void
}

export function ServerPerformanceOverview({ onScrollToDetails }: ServerPerformanceOverviewProps) {
  const [metrics, setMetrics] = useState<VmMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<MetricSample[]>([])

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/vps-runner/metrics")
      const data: VmMetrics = await res.json()
      setMetrics(data)

      if (data?.available) {
        const cpuVal = data.cpu?.usagePercent ?? 0
        const memVal = data.memory?.usagePercent ?? 0
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
        setHistory((prev) => {
          const next = [...prev, { time: now, cpu: cpuVal, mem: memVal }]
          return next.slice(-12)
        })
      }
    } catch {
      setMetrics({
        available: false,
        error: "Failed to connect to host metrics endpoint",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
    const timer = setInterval(fetchMetrics, 30000)
    return () => clearInterval(timer)
  }, [])

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "—"
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }

  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 space-y-5 shadow-[var(--shadow-card)]">
      {/* Header bar matching reference layout */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)] font-[family-name:var(--font-display)]">
              System Performance Overview
            </h2>
            {metrics?.available ? (
              <Badge
                variant="outline"
                className="bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] font-mono px-2 py-0 rounded-[var(--radius-full)]"
              >
                Host Active
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)] text-[10px] font-mono px-2 py-0 rounded-[var(--radius-full)]"
              >
                Telemetry Offline
              </Badge>
            )}
          </div>
          <p className="text-xs text-[var(--text-muted)]">
            Continuous real-time telemetry directly from host control plane
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={fetchMetrics}
            className="h-8 px-2 text-[var(--text-muted)] hover:text-[var(--foreground)]"
            title="Refresh host metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>

          {onScrollToDetails && (
            <Button
              size="sm"
              variant="outline"
              onClick={onScrollToDetails}
              className="h-8 px-3 text-xs border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)] hover:bg-[var(--surface-raised)] rounded-[var(--radius-control)] gap-1.5"
            >
              <span>Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Grid of Gauges: CPU, RAM, Disk, Bandwidth */}
      {!metrics?.available ? (
        <div className="py-6 px-4 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-muted)]">
          <div className="flex items-center gap-2 text-[var(--text-secondary)]">
            <AlertCircle className="w-4 h-4 text-[var(--warning)] shrink-0" />
            <span>
              {metrics?.error || "Host performance metrics unavailable. VM runner service is not broadcasting telemetry."}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchMetrics}
            className="h-7 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-[var(--radius-control)] shrink-0"
          >
            Retry Connection
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Gauge 1: CPU Load */}
            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  CPU Load
                </span>
                <span className="font-mono tabular-nums text-[var(--foreground)]">
                  {metrics.cpu?.usagePercent != null ? `${metrics.cpu.usagePercent}%` : "—"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--foreground)] transition-all duration-300"
                  style={{ width: `${Math.min(100, metrics.cpu?.usagePercent || 0)}%` }}
                />
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono">
                Load avg: {metrics.cpu?.loadAvg?.toFixed(2) ?? "—"}
              </div>
            </div>

            {/* Gauge 2: Memory */}
            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  Memory
                </span>
                <span className="font-mono tabular-nums text-[var(--foreground)]">
                  {metrics.memory?.usagePercent != null ? `${metrics.memory.usagePercent}%` : "—"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--foreground)] transition-all duration-300"
                  style={{ width: `${Math.min(100, metrics.memory?.usagePercent || 0)}%` }}
                />
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono">
                {formatBytes(metrics.memory?.usedBytes)} / {formatBytes(metrics.memory?.totalBytes)}
              </div>
            </div>

            {/* Gauge 3: Disk */}
            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <HardDrive className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  Storage
                </span>
                <span className="font-mono tabular-nums text-[var(--foreground)]">
                  {metrics.disk?.usagePercent != null ? `${metrics.disk.usagePercent}%` : "—"}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[var(--foreground)] transition-all duration-300"
                  style={{ width: `${Math.min(100, metrics.disk?.usagePercent || 0)}%` }}
                />
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono">
                Volume: {metrics.disk?.raw || "Primary disk"}
              </div>
            </div>

            {/* Gauge 4: Bandwidth */}
            <div className="p-3.5 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-2">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                  Network / Ingress
                </span>
                <Badge
                  variant="outline"
                  className="text-[9px] font-mono px-1.5 py-0 bg-[var(--surface)] border-[var(--border)]"
                >
                  {metrics.bandwidth?.status || "Live"}
                </Badge>
              </div>
              <div className="h-1.5 w-full bg-[var(--surface)] rounded-full overflow-hidden">
                <div className="h-full bg-[var(--foreground)] w-1/3" />
              </div>
              <div className="text-[10px] text-[var(--text-muted)] font-mono">
                Cloudflare Edge Routed
              </div>
            </div>
          </div>

          {/* Real-time Line Chart: CPU & Memory Telemetry Curves */}
          <div className="p-4 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-[var(--foreground)] font-[family-name:var(--font-display)]">
                Telemetry Load History
              </span>
              <div className="flex items-center gap-3 text-[11px] font-mono">
                <span className="flex items-center gap-1.5 text-[var(--foreground)]">
                  <span className="w-2 h-0.5 bg-[var(--foreground)] inline-block" />
                  CPU %
                </span>
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span className="w-2 h-0.5 bg-[var(--text-muted)] inline-block" />
                  Memory %
                </span>
              </div>
            </div>

            <div className="h-20 w-full relative flex items-end">
              <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                <line x1="0" y1="25" x2="100" y2="25" stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.5" />
                <line x1="0" y1="50" x2="100" y2="50" stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.5" />
                <line x1="0" y1="75" x2="100" y2="75" stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.5" />

                {history.length > 1 && (
                  <>
                    {/* CPU Path */}
                    <polyline
                      fill="none"
                      stroke="var(--foreground)"
                      strokeWidth="1.5"
                      points={history
                        .map((pt, idx) => {
                          const x = (idx / (history.length - 1)) * 100
                          const y = 100 - Math.min(100, pt.cpu)
                          return `${x},${y}`
                        })
                        .join(" ")}
                    />
                    {/* Memory Path */}
                    <polyline
                      fill="none"
                      stroke="var(--text-muted)"
                      strokeWidth="1.5"
                      strokeDasharray="2 1"
                      points={history
                        .map((pt, idx) => {
                          const x = (idx / (history.length - 1)) * 100
                          const y = 100 - Math.min(100, pt.mem)
                          return `${x},${y}`
                        })
                        .join(" ")}
                    />
                  </>
                )}
              </svg>
            </div>
            <div className="flex items-center justify-between text-[10px] text-[var(--text-muted)] font-mono">
              <span>{history[0]?.time || "Live"}</span>
              <span>100% capacity</span>
              <span>{history[history.length - 1]?.time || "Current"}</span>
            </div>
          </div>
        </>
      )}

      {/* VM Host Registry (Primary Host vs. Standby Architecture) */}
      <div className="pt-2 border-t border-[var(--border-subtle)] space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider font-mono">
            Host Node Registry
          </span>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">
            Single Authoritative Host Architecture
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[var(--text-muted)] border-b border-[var(--border)] font-medium">
              <tr>
                <th className="py-2 px-3">Role</th>
                <th className="py-2 px-3">Host Node</th>
                <th className="py-2 px-3">Operating System</th>
                <th className="py-2 px-3">Endpoint</th>
                <th className="py-2 px-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              <tr className="hover:bg-[var(--surface-raised)]/40 transition-colors">
                <td className="py-2.5 px-3">
                  <Badge variant="outline" className="bg-[var(--foreground)] text-[var(--background)] font-medium text-[10px] font-mono">
                    PRIMARY
                  </Badge>
                </td>
                <td className="py-2.5 px-3 font-semibold text-[var(--foreground)] flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                  <span>Syte VM Runner</span>
                </td>
                <td className="py-2.5 px-3 text-[var(--text-secondary)]">Ubuntu 24.04 LTS (x86_64)</td>
                <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-muted)]">sycord.site:443</td>
                <td className="py-2.5 px-3 text-right">
                  <Badge
                    variant="outline"
                    className="bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] font-mono px-2 py-0 rounded-[var(--radius-full)]"
                  >
                    CONNECTED
                  </Badge>
                </td>
              </tr>
              <tr className="text-[var(--text-muted)] bg-[var(--surface-muted)]/50">
                <td className="py-2.5 px-3">
                  <Badge variant="outline" className="bg-transparent text-[var(--text-muted)] border-[var(--border)] text-[10px] font-mono">
                    STANDBY
                  </Badge>
                </td>
                <td className="py-2.5 px-3 italic" colSpan={3}>
                  No secondary standby / replica runners configured
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-[10px]">
                  UNCONFIGURED
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
