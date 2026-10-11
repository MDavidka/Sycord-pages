"use client"

import React, { useState, useEffect } from "react"
import { Cpu, HardDrive, Activity, ArrowRight, RefreshCw, AlertCircle } from "lucide-react"
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

interface ServerPerformanceOverviewProps {
  onScrollToDetails?: () => void
}

export function ServerPerformanceOverview({ onScrollToDetails }: ServerPerformanceOverviewProps) {
  const [metrics, setMetrics] = useState<VmMetrics | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchMetrics = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/vps-runner/metrics")
      const data = await res.json()
      setMetrics(data)
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
  }, [])

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes <= 0) return "—"
    const gb = bytes / (1024 * 1024 * 1024)
    return `${gb.toFixed(1)} GB`
  }

  return (
    <div className="border border-[var(--border)] rounded-[var(--radius-panel)] bg-[var(--surface)] p-5 space-y-4 shadow-[var(--shadow-card)]">
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
      )}
    </div>
  )
}
