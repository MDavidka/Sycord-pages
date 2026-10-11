"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Cpu,
  Database,
  HardDrive,
  Loader2,
  Orbit,
  RefreshCw,
  ShieldCheck,
  TerminalSquare,
  Workflow,
  XCircle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type VmStatus = {
  success?: boolean
  online?: boolean
  apiOnline?: boolean
  degraded?: boolean
  warning?: string
  error?: string
  runner?: { running?: boolean; port?: number; portOwner?: string | null }
  nginx?: { running?: boolean; port80Available?: boolean; error?: string | null }
  cloudflared?: { running?: boolean }
  cpu?: number | { percent?: number | null; usagePercent?: number | null } | null
  mem?: { percent?: number | null; used?: number | null; total?: number | null } | null
  disk?: { percent?: number | null; used?: number | null; total?: number | null } | null
  diagnostics?: Record<string, unknown> | null
  debug?: Record<string, unknown> | null
  [key: string]: unknown
}

type TelemetryEvent = {
  event_id?: string
  type?: string
  severity?: string
  title?: string
  message?: string
  created_at?: string
  timestamp?: string
  resolution_status?: string
}

function formatPercent(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return `${Math.round(value * 10) / 10}%`
}

function statusLabel(status: VmStatus | null) {
  if (!status) return { label: "Not checked", tone: "neutral" as const }
  if (status.online === false || status.success === false) return { label: "Offline", tone: "danger" as const }
  if (status.degraded || status.apiOnline === false) return { label: "Degraded", tone: "warning" as const }
  if (status.online === true || status.success === true) return { label: "Reachable", tone: "success" as const }
  return { label: "Unknown", tone: "neutral" as const }
}

function StatusBadge({ value }: { value: boolean | undefined }) {
  if (value === undefined) {
    return <Badge variant="outline" className="border-[var(--border)] text-[var(--text-muted)]">Unknown</Badge>
  }
  return value ? (
    <Badge variant="outline" className="border-[var(--success)]/25 bg-[var(--success-muted)] text-[var(--success)]">Active</Badge>
  ) : (
    <Badge variant="outline" className="border-[var(--border)] text-[var(--text-secondary)]">Inactive</Badge>
  )
}

export function AstroControlCenter() {
  const [vmStatus, setVmStatus] = useState<VmStatus | null>(null)
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [telemetryUnavailable, setTelemetryUnavailable] = useState(false)
  const [copied, setCopied] = useState(false)

  const runPreflight = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCopied(false)
    try {
      const [statusResponse, telemetryResponse] = await Promise.all([
        fetch("/api/admin/vps-runner/status", { cache: "no-store" }),
        fetch("/api/moderator/telemetry?limit=10", { cache: "no-store" }),
      ])

      const statusData = (await statusResponse.json().catch(() => ({}))) as VmStatus
      if (!statusResponse.ok && !statusData.online) {
        setVmStatus(statusData)
        throw new Error(statusData.error || `VM status check failed (${statusResponse.status})`)
      }
      setVmStatus(statusData)

      const telemetryData = await telemetryResponse.json().catch(() => ({}))
      if (telemetryResponse.ok && telemetryData?.ok && Array.isArray(telemetryData.events)) {
        setEvents(telemetryData.events)
        setTelemetryUnavailable(false)
      } else {
        setEvents([])
        setTelemetryUnavailable(true)
      }
      setLastChecked(new Date().toISOString())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the VM preflight.")
      setLastChecked(new Date().toISOString())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void runPreflight()
  }, [runPreflight])

  const status = statusLabel(vmStatus)
  const cpuPercent = formatPercent(
    typeof vmStatus?.cpu === "number"
      ? vmStatus.cpu
      : vmStatus?.cpu?.percent ?? vmStatus?.cpu?.usagePercent,
  )
  const memoryPercent = formatPercent(vmStatus?.mem?.percent)
  const diskPercent = formatPercent(vmStatus?.disk?.percent)

  const report = useMemo(
    () =>
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          checkedAt: lastChecked,
          vm: vmStatus,
          telemetry: {
            available: !telemetryUnavailable,
            recentEvents: events,
          },
          uiError: error,
        },
        null,
        2,
      ),
    [vmStatus, events, lastChecked, telemetryUnavailable, error],
  )

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
    } catch {
      setError("Clipboard access was blocked. You can still inspect the diagnostic snapshot below.")
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-150">
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
              <Orbit className="size-5 text-[var(--foreground)]" />
            </div>
            <div>
              <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
                Astro
              </h1>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                VM diagnostics, controlled recovery, and agent benchmarks
              </p>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            A dedicated workspace for inspecting the Ubuntu runner and building safe, verifiable maintenance workflows.
          </p>
        </div>
        <Button
          onClick={() => void runPreflight()}
          disabled={loading}
          className="h-11 shrink-0 gap-2 rounded-[var(--radius-control)] bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] hover:opacity-90"
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
          {loading ? "Checking VM…" : "Run preflight"}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-[var(--danger)]/25 bg-[var(--danger-muted)] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)]">Preflight needs attention</p>
            <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{error}</p>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div className="min-w-0">
              <p className="text-xs text-[var(--text-muted)]">Ubuntu VM</p>
              <p className="mt-2 text-lg font-semibold">{status.label}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">
                {vmStatus?.apiOnline === false ? "Runner API unavailable" : vmStatus?.warning || "Status from authenticated control-plane endpoint"}
              </p>
            </div>
            {status.tone === "success" ? (
              <CheckCircle2 className="size-5 text-[var(--success)]" />
            ) : status.tone === "danger" ? (
              <XCircle className="size-5 text-[var(--danger)]" />
            ) : (
              <Activity className="size-5 text-[var(--text-secondary)]" />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Runner service</p>
              <div className="mt-2"><StatusBadge value={vmStatus?.runner?.running} /></div>
              <p className="mt-2 text-xs text-[var(--text-secondary)]">
                {vmStatus?.runner?.port ? `Observed port ${vmStatus.runner.port}` : "Port not reported"}
              </p>
            </div>
            <TerminalSquare className="size-5 text-[var(--text-secondary)]" />
          </CardContent>
        </Card>

        <Card className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-xs text-[var(--text-muted)]">CPU / Memory</p>
              <p className="mt-2 text-lg font-semibold tabular-nums">{cpuPercent ?? "—"} <span className="text-sm font-normal text-[var(--text-muted)]">/ {memoryPercent ?? "—"}</span></p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Only values returned by the VM API are shown.</p>
            </div>
            <Cpu className="size-5 text-[var(--text-secondary)]" />
          </CardContent>
        </Card>

        <Card className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
          <CardContent className="flex items-start justify-between gap-3 p-5">
            <div>
              <p className="text-xs text-[var(--text-muted)]">Disk / Recent events</p>
              <p className="mt-2 text-lg font-semibold tabular-nums">{diskPercent ?? "—"} <span className="text-sm font-normal text-[var(--text-muted)]">/ {telemetryUnavailable ? "Unavailable" : events.length}</span></p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{telemetryUnavailable ? "Telemetry endpoint did not return event data." : "Recent telemetry events returned by the API."}</p>
            </div>
            <HardDrive className="size-5 text-[var(--text-secondary)]" />
          </CardContent>
        </Card>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-5 sm:p-6">
            <div>
              <CardTitle className="text-base font-semibold">Service inspection</CardTitle>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Read-only checks from the existing VM status endpoint.</p>
            </div>
            <ShieldCheck className="size-5 shrink-0 text-[var(--text-secondary)]" />
          </CardHeader>
          <CardContent className="space-y-0 px-5 pb-5 sm:px-6 sm:pb-6">
            {[
              { label: "Runner", detail: "Sycord VM runner", active: vmStatus?.runner?.running },
              { label: "Nginx", detail: "Reverse proxy service", active: vmStatus?.nginx?.running },
              { label: "Cloudflared", detail: "Tunnel process", active: vmStatus?.cloudflared?.running },
            ].map((service) => (
              <div key={service.label} className="flex items-center justify-between gap-4 border-t border-[var(--border)] py-3 first:border-t-0">
                <div>
                  <p className="text-sm font-medium">{service.label}</p>
                  <p className="mt-0.5 text-xs text-[var(--text-muted)]">{service.detail}</p>
                </div>
                <StatusBadge value={service.active} />
              </div>
            ))}
            <div className="mt-3 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Clock3 className="size-4 text-[var(--text-secondary)]" />
                Last checked
              </div>
              <p className="mt-1 font-mono text-xs text-[var(--text-secondary)]">
                {lastChecked ? new Date(lastChecked).toLocaleString() : "Not checked yet"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
          <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-5 sm:p-6">
            <div>
              <CardTitle className="text-base font-semibold">Self-healing workflow</CardTitle>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">The first milestone establishes observability before any repair command can run.</p>
            </div>
            <Workflow className="size-5 shrink-0 text-[var(--text-secondary)]" />
          </CardHeader>
          <CardContent className="space-y-3 px-5 pb-5 sm:px-6 sm:pb-6">
            {[
              { title: "Inspect", description: "Collect authenticated VM and service status.", complete: Boolean(vmStatus) },
              { title: "Classify", description: "Separate runner, network, and telemetry failures.", complete: Boolean(vmStatus && !error) },
              { title: "Propose repair", description: "Next milestone: allowlisted, reviewed repair plans.", complete: false },
              { title: "Verify & benchmark", description: "Next milestone: repeatable workload profiles and post-fix verification.", complete: false },
            ].map((step, index) => (
              <div key={step.title} className="flex gap-3">
                <div className={cn(
                  "mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border",
                  step.complete ? "border-[var(--success)]/25 bg-[var(--success-muted)] text-[var(--success)]" : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
                )}>
                  {step.complete ? <CheckCircle2 className="size-4" /> : <span className="text-xs tabular-nums">{index + 1}</span>}
                </div>
                <div className="min-w-0 flex-1 pb-2">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{step.description}</p>
                </div>
              </div>
            ))}
            <div className="rounded-[var(--radius-panel)] border border-[var(--warning)]/20 bg-[var(--warning-muted)] p-3 text-xs leading-5 text-[var(--text-secondary)]">
              No arbitrary shell commands or automatic changes are enabled in this first pass. The repair and benchmark runner must be added server-side with an explicit command allowlist, timeouts, audit logs, and verification.
            </div>
          </CardContent>
        </Card>
      </section>

      <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
        <CardHeader className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <CardTitle className="text-base font-semibold">Diagnostic snapshot</CardTitle>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Current API response and recent event context for debugging.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => void copyReport()}
            disabled={!vmStatus}
            className="h-10 gap-2 rounded-[var(--radius-control)] border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] hover:bg-[var(--surface-raised)]"
          >
            {copied ? <CheckCircle2 className="size-4" /> : <Database className="size-4" />}
            {copied ? "Copied report" : "Copy diagnostic report"}
          </Button>
        </CardHeader>
        <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
          {vmStatus ? (
            <pre className="max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 font-mono text-xs leading-5 text-[var(--text-secondary)]">
              {report}
            </pre>
          ) : (
            <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--text-muted)]">
              {loading ? "Collecting the first diagnostic snapshot…" : "No diagnostic snapshot is available yet."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
