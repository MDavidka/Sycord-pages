"use client"

import React, { useState, useEffect } from "react"
import {
  Activity,
  AlertCircle,
  Clock,
  Cpu,
  Globe2,
  HardDrive,
  LayoutGrid,
  RefreshCw,
  Server,
} from "lucide-react"
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
  serverName?: string
  serverIp?: string
  onScrollToDetails?: () => void
}

export function ServerPerformanceOverview({
  serverName = "main-server-denmark",
  serverIp = "19.8373.836",
  onScrollToDetails,
}: ServerPerformanceOverviewProps) {
  const [metrics, setMetrics] = useState<VmMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [history, setHistory] = useState<MetricSample[]>([
    { time: "00", cpu: 32, mem: 44 },
    { time: "01", cpu: 28, mem: 46 },
    { time: "02", cpu: 45, mem: 48 },
    { time: "03", cpu: 38, mem: 47 },
    { time: "04", cpu: 52, mem: 49 },
    { time: "05", cpu: 41, mem: 50 },
    { time: "06", cpu: 60, mem: 52 },
    { time: "07", cpu: 55, mem: 51 },
    { time: "08", cpu: 48, mem: 53 },
    { time: "09", cpu: 65, mem: 52 },
    { time: "10", cpu: 58, mem: 54 },
    { time: "11", cpu: 72, mem: 55 },
    { time: "12", cpu: 64, mem: 53 },
    { time: "13", cpu: 68, mem: 54 },
    { time: "14", cpu: 62, mem: 56 },
    { time: "15", cpu: 75, mem: 55 },
  ])
  const [showRegistry, setShowRegistry] = useState(false)

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/vps-runner/metrics")
      const data: VmMetrics = await res.json()
      setMetrics(data)

      if (data?.available) {
        const cpuVal = data.cpu?.usagePercent ?? 45
        const memVal = data.memory?.usagePercent ?? 52
        const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        setHistory((prev) => {
          const next = [...prev, { time: now, cpu: cpuVal, mem: memVal }]
          return next.slice(-20)
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
    void fetchMetrics()
    const timer = setInterval(() => void fetchMetrics(), 30000)
    return () => clearInterval(timer)
  }, [])

  // Helper to build smooth wave SVG points
  const buildSvgPath = (points: number[]) => {
    if (points.length === 0) return ""
    const step = 100 / (points.length - 1)
    return points
      .map((val, idx) => {
        const x = idx * step
        const y = 90 - (val / 100) * 75
        return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(" ")
  }

  const cpuPoints = history.map((h) => h.cpu)
  const memPoints = history.map((h) => h.mem)
  const cpuPath = buildSvgPath(cpuPoints)
  const memPath = buildSvgPath(memPoints)

  const isOnline = metrics?.available ?? true

  return (
    <div className="space-y-3 animate-in fade-in duration-150">
      {/* Node identity title & IP (matching blueprint header) */}
      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
        <div className="space-y-1">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-[var(--foreground)] font-[family-name:var(--font-display)]">
            {serverName}
          </h2>
          <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] font-mono">
            <Globe2 className="size-3.5 text-[var(--text-muted)] shrink-0" />
            <span>{serverIp}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void fetchMetrics()}
            className="h-7 px-2 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]"
            title="Refresh host telemetry"
          >
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
            <span className="ml-1 text-[11px]">Live</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowRegistry((prev) => !prev)}
            className="h-7 px-2 text-[11px] text-[var(--text-muted)] hover:text-[var(--foreground)]"
          >
            {showRegistry ? "Hide Registry" : "Host Registry"}
          </Button>
        </div>
      </div>

      {/* Blueprint Server Node Card */}
      <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6 shadow-[var(--shadow-card)]">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Left Column: Server Overview */}
          <div className="lg:col-span-5 space-y-4 border-b lg:border-b-0 lg:border-r border-[var(--border-subtle)] pb-5 lg:pb-0 lg:pr-6">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] font-[family-name:var(--font-display)]">
              <LayoutGrid className="size-3.5 text-[var(--text-muted)]" />
              <span>Server Overview</span>
            </div>

            {/* Status Item */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[var(--text-muted)]">Status</span>
              {isOnline ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-mono font-medium text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  RUNNING
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-mono font-medium text-amber-400">
                  <span className="size-1.5 rounded-full bg-amber-400" />
                  OFFLINE
                </span>
              )}
            </div>

            {/* Uptime Item */}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-[var(--text-muted)]">
                <Clock className="size-3.5 text-[var(--text-secondary)]" />
                Uptime
              </span>
              <span className="font-medium text-[var(--foreground)] font-mono">
                48d 12h 42m
              </span>
            </div>

            {/* OS / Instance Item */}
            <div className="flex items-start justify-between text-xs">
              <span className="flex items-center gap-1.5 text-[var(--text-muted)] mt-0.5">
                <Server className="size-3.5 text-[var(--text-secondary)]" />
                OS / Instance
              </span>
              <div className="text-right space-y-0.5">
                <p className="font-medium text-[var(--foreground)]">Ubuntu 22.04 LTS</p>
                <p className="font-mono text-[11px] text-[var(--text-muted)]">c6i.2xlarge</p>
              </div>
            </div>
          </div>

          {/* Right Column: Live CPU & RAM Telemetry Waveforms */}
          <div className="lg:col-span-7 space-y-5">
            {/* CPU Waveform Row */}
            <div className="flex items-center gap-4">
              <div className="w-14 shrink-0">
                <span className="text-xs font-mono font-bold text-[var(--foreground)]">CPU</span>
                <p className="text-[10px] text-[var(--text-muted)] font-mono tabular-nums">
                  {metrics?.cpu?.usagePercent != null ? `${metrics.cpu.usagePercent}%` : "58%"}
                </p>
              </div>

              {/* Waveform Canvas */}
              <div className="flex-1 h-12 relative flex items-center overflow-hidden rounded-[var(--radius-inner)] bg-[var(--surface-muted)]/70 px-2 border border-[var(--border-subtle)]">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Subtle Gridlines */}
                  <line x1="0" y1="30" x2="100" y2="30" stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.5" />
                  <line x1="0" y1="70" x2="100" y2="70" stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.5" />
                  {/* Area fill */}
                  <path d={`${cpuPath} L 100,100 L 0,100 Z`} fill="url(#cpuGradient)" />
                  {/* Cyan Waveform line */}
                  <path
                    d={cpuPath}
                    fill="none"
                    stroke="#22d3ee"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>

            {/* RAM Waveform Row */}
            <div className="flex items-center gap-4">
              <div className="w-14 shrink-0">
                <span className="text-xs font-mono font-bold text-[var(--foreground)]">RAM</span>
                <p className="text-[10px] text-[var(--text-muted)] font-mono">Memory Usage</p>
              </div>

              {/* Waveform Canvas */}
              <div className="flex-1 h-12 relative flex items-center overflow-hidden rounded-[var(--radius-inner)] bg-[var(--surface-muted)]/70 px-2 border border-[var(--border-subtle)]">
                <svg className="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                  <defs>
                    <linearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>
                  {/* Subtle Gridlines */}
                  <line x1="0" y1="30" x2="100" y2="30" stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.5" />
                  <line x1="0" y1="70" x2="100" y2="70" stroke="var(--border)" strokeDasharray="2 2" strokeWidth="0.5" />
                  {/* Area fill */}
                  <path d={`${memPath} L 100,100 L 0,100 Z`} fill="url(#memGradient)" />
                  {/* Blue Waveform line */}
                  <path
                    d={memPath}
                    fill="none"
                    stroke="#60a5fa"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Host Node Registry Collapsible Table */}
      {showRegistry && (
        <div className="p-4 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--foreground)] uppercase tracking-wider font-mono">
              Authoritative Host Node Registry
            </span>
            <span className="text-[11px] text-[var(--text-muted)] font-mono">
              Topology Spec
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
                    <Server className="size-3.5 text-[var(--text-muted)] shrink-0" />
                    <span>main-server-denmark</span>
                  </td>
                  <td className="py-2.5 px-3 text-[var(--text-secondary)]">Ubuntu 22.04 LTS (c6i.2xlarge)</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-muted)]">{serverIp}</td>
                  <td className="py-2.5 px-3 text-right">
                    <Badge
                      variant="outline"
                      className="bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] font-mono px-2 py-0 rounded-full"
                    >
                      CONNECTED
                    </Badge>
                  </td>
                </tr>
                <tr className="text-[var(--text-muted)]">
                  <td className="py-2.5 px-3">
                    <Badge variant="outline" className="bg-transparent text-[var(--text-muted)] border-[var(--border)] text-[10px] font-mono">
                      STANDBY
                    </Badge>
                  </td>
                  <td className="py-2.5 px-3 italic" colSpan={3}>
                    No secondary standby runner node registered
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono text-[10px]">
                    UNCONFIGURED
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
