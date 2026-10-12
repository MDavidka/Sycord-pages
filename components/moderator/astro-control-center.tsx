"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle2,
  Clock3,
  Copy,
  Cpu,
  Database,
  FileText,
  Gauge,
  GitBranch,
  HardDrive,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  TerminalSquare,
  Wrench,
  XCircle,
  Zap,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

type AstroTask = {
  id: string
  name: string
  description: string
  category: "diagnostic" | "repair" | "benchmark"
  requiresApproval: boolean
  riskLevel: "none" | "low" | "medium" | "high"
  timeoutMs: number
}

type AstroTaskExecutionResult = {
  taskId: string
  taskName: string
  category: "diagnostic" | "repair" | "benchmark"
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
  executedAt: string
  error?: string | null
  metrics?: Record<string, unknown>
}

type SelfHealingProposal = {
  id: string
  taskId: string
  title: string
  category: "diagnostic" | "repair" | "benchmark"
  riskLevel: "none" | "low" | "medium" | "high"
  severity: "critical" | "warning" | "info"
  issueSummary: string
  recommendedFix: string
  requiresApproval: boolean
}

type BenchmarkProfile = {
  id: string
  name: string
  profile: string
  description: string
  target: string
  expectedDuration: string
}

type BenchmarkHistoryItem = {
  id: string
  profile: string
  name: string
  status: "queued" | "running" | "completed" | "failed"
  score: string | null
  durationMs: number
  executedAt: string
  logs?: string
  error?: string | null
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
    return (
      <Badge variant="outline" className="border-[var(--border)] text-[var(--text-muted)]">
        Unknown
      </Badge>
    )
  }
  return value ? (
    <Badge variant="outline" className="border-[var(--success)]/25 bg-[var(--success-muted)] text-[var(--success)]">
      Active
    </Badge>
  ) : (
    <Badge variant="outline" className="border-[var(--border)] text-[var(--text-secondary)]">
      Inactive
    </Badge>
  )
}

function RiskBadge({ risk }: { risk: "none" | "low" | "medium" | "high" }) {
  if (risk === "none") {
    return (
      <Badge variant="outline" className="border-[var(--border)] text-[var(--text-muted)]">
        Read-only
      </Badge>
    )
  }
  if (risk === "low") {
    return (
      <Badge variant="outline" className="border-blue-500/20 bg-blue-500/10 text-blue-400">
        Low risk
      </Badge>
    )
  }
  if (risk === "medium") {
    return (
      <Badge variant="outline" className="border-amber-500/20 bg-amber-500/10 text-amber-400">
        Medium risk
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="border-red-500/20 bg-red-500/10 text-red-400">
      High risk
    </Badge>
  )
}

export function AstroControlCenter() {
  const [activeTab, setActiveTab] = useState<"overview" | "healing" | "tasks" | "benchmarks" | "snapshot">("overview")
  const [vmStatus, setVmStatus] = useState<VmStatus | null>(null)
  const [events, setEvents] = useState<TelemetryEvent[]>([])
  const [loading, setLoading] = useState(false)
  const [lastChecked, setLastChecked] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [telemetryUnavailable, setTelemetryUnavailable] = useState(false)
  const [copied, setCopied] = useState(false)

  // Task runner state
  const [tasks, setTasks] = useState<AstroTask[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [taskResult, setTaskResult] = useState<AstroTaskExecutionResult | null>(null)
  const [approvalModalTask, setApprovalModalTask] = useState<AstroTask | null>(null)
  const [approvalConfirmed, setApprovalConfirmed] = useState(false)

  // Self-healing state
  const [proposals, setProposals] = useState<SelfHealingProposal[]>([])
  const [executingProposalId, setExecutingProposalId] = useState<string | null>(null)
  const [proposalApprovalModal, setProposalApprovalModal] = useState<SelfHealingProposal | null>(null)
  const [healingStepStatus, setHealingStepStatus] = useState<{
    step: "idle" | "inspecting" | "classified" | "approving" | "executing" | "verifying" | "complete" | "failed"
    detail?: string
  }>({ step: "idle" })

  // Benchmarks state
  const [benchmarks, setBenchmarks] = useState<BenchmarkProfile[]>([])
  const [benchmarkHistory, setBenchmarkHistory] = useState<BenchmarkHistoryItem[]>([])
  const [runningBenchmarkId, setRunningBenchmarkId] = useState<string | null>(null)
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null)

  // Main preflight fetch
  const runPreflight = useCallback(async () => {
    setLoading(true)
    setError(null)
    setCopied(false)
    setHealingStepStatus({ step: "inspecting", detail: "Querying authenticated VM control plane…" })

    try {
      const statusResponse = await fetch("/api/admin/vps-runner/status", { cache: "no-store" })
      const statusData = (await statusResponse.json().catch(() => ({}))) as VmStatus
      setVmStatus(statusData)

      if (!statusResponse.ok && !statusData.online) {
        throw new Error(statusData.error || `VM status check failed (${statusResponse.status})`)
      }

      // Telemetry fetch
      try {
        const telemetryResponse = await fetch("/api/moderator/telemetry?limit=10", { cache: "no-store" })
        const telemetryData = await telemetryResponse.json().catch(() => ({}))
        if (telemetryResponse.ok && telemetryData?.ok && Array.isArray(telemetryData.events)) {
          setEvents(telemetryData.events)
          setTelemetryUnavailable(false)
        } else {
          setEvents([])
          setTelemetryUnavailable(true)
        }
      } catch {
        setEvents([])
        setTelemetryUnavailable(true)
      }

      // Self-healing proposals fetch
      try {
        const proposalsResponse = await fetch("/api/moderator/astro/proposals", { cache: "no-store" })
        const proposalsData = await proposalsResponse.json().catch(() => ({}))
        if (proposalsResponse.ok && Array.isArray(proposalsData.proposals)) {
          setProposals(proposalsData.proposals)
        }
      } catch {
        // Fallback
      }

      setHealingStepStatus({ step: "classified", detail: "Diagnostics evaluated. Ready for inspection." })
      setLastChecked(new Date().toISOString())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not complete the VM preflight.")
      setHealingStepStatus({ step: "failed", detail: "Preflight failed to contact host." })
      setLastChecked(new Date().toISOString())
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    void runPreflight()
  }, [runPreflight])

  // Load allowlisted tasks
  const loadTasks = useCallback(async () => {
    setTasksLoading(true)
    try {
      const res = await fetch("/api/moderator/astro/tasks", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (res.ok && Array.isArray(data.tasks)) {
        setTasks(data.tasks)
      }
    } catch {
      // Fallback
    } finally {
      setTasksLoading(false)
    }
  }, [])

  // Load benchmarks
  const loadBenchmarks = useCallback(async () => {
    try {
      const res = await fetch("/api/moderator/astro/benchmark", { cache: "no-store" })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        if (Array.isArray(data.profiles)) setBenchmarks(data.profiles)
        if (Array.isArray(data.history)) setBenchmarkHistory(data.history)
      }
    } catch {
      // Fallback
    }
  }, [])

  useEffect(() => {
    void loadTasks()
    void loadBenchmarks()
  }, [loadTasks, loadBenchmarks])

  // Execute an allowlisted task
  const runTask = async (task: AstroTask, approved = false) => {
    if (task.requiresApproval && !approved) {
      setApprovalModalTask(task)
      setApprovalConfirmed(false)
      return
    }

    setApprovalModalTask(null)
    setRunningTaskId(task.id)
    setTaskResult(null)

    try {
      const res = await fetch("/api/moderator/astro/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: task.id, approved: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.result) {
        setTaskResult(data.result)
      } else {
        setTaskResult({
          taskId: task.id,
          taskName: task.name,
          category: task.category,
          success: false,
          stdout: "",
          stderr: data.error || "Execution failed",
          exitCode: -1,
          durationMs: 0,
          executedAt: new Date().toISOString(),
          error: data.error,
        })
      }
    } catch (err: any) {
      setTaskResult({
        taskId: task.id,
        taskName: task.name,
        category: task.category,
        success: false,
        stdout: "",
        stderr: err?.message || "Network request failed",
        exitCode: -1,
        durationMs: 0,
        executedAt: new Date().toISOString(),
        error: err?.message,
      })
    } finally {
      setRunningTaskId(null)
    }
  }

  // Execute self-healing proposal with verification
  const executeProposal = async (proposal: SelfHealingProposal) => {
    setProposalApprovalModal(null)
    setExecutingProposalId(proposal.id)
    setHealingStepStatus({
      step: "executing",
      detail: `Executing repair task '${proposal.title}'...`,
    })

    try {
      const res = await fetch("/api/moderator/astro/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId: proposal.taskId,
          approved: true,
          reason: `Self-healing execution: ${proposal.recommendedFix}`,
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (data.result?.success) {
        // Step: Post-flight verification
        setHealingStepStatus({
          step: "verifying",
          detail: "Repair command succeeded. Running verification preflight…",
        })

        // Re-run preflight
        await runPreflight()

        setHealingStepStatus({
          step: "complete",
          detail: `Repair '${proposal.title}' executed and verified.`,
        })

        // Remove from local active proposals
        setProposals((prev) => prev.filter((p) => p.id !== proposal.id))
      } else {
        setHealingStepStatus({
          step: "failed",
          detail: data.result?.error || data.error || "Repair command returned non-zero status.",
        })
      }
    } catch (err: any) {
      setHealingStepStatus({
        step: "failed",
        detail: err?.message || "Failed to trigger repair action.",
      })
    } finally {
      setExecutingProposalId(null)
    }
  }

  // Run a benchmark profile
  const runBenchmark = async (profileId: string) => {
    setRunningBenchmarkId(profileId)
    setBenchmarkError(null)

    try {
      const res = await fetch("/api/moderator/astro/benchmark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: profileId }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data.benchmark) {
        setBenchmarkHistory((prev) => [data.benchmark, ...prev])
      } else {
        setBenchmarkError(data.error || "Benchmark run failed")
      }
    } catch (err: any) {
      setBenchmarkError(err?.message || "Failed to invoke benchmark API")
    } finally {
      setRunningBenchmarkId(null)
    }
  }

  const status = statusLabel(vmStatus)
  const cpuValue = vmStatus?.cpu
  const cpuPercent = formatPercent(
    typeof cpuValue === "number"
      ? cpuValue
      : cpuValue && typeof cpuValue === "object"
        ? cpuValue.percent ?? cpuValue.usagePercent
        : null,
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
          proposals,
          uiError: error,
        },
        null,
        2,
      ),
    [vmStatus, events, proposals, lastChecked, telemetryUnavailable, error],
  )

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError("Clipboard access was blocked. You can still inspect the diagnostic snapshot below.")
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col gap-4 border-b border-[var(--border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
              <Gauge className="size-5 text-[var(--foreground)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight text-[var(--foreground)] sm:text-2xl">
                  Astro
                </h1>
                <Badge variant="outline" className="border-[var(--border)] text-[var(--text-muted)] text-[10px] uppercase tracking-wider">
                  Control Center
                </Badge>
              </div>
              <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
                VM diagnostics, safe self-healing, and reproducible benchmarks
              </p>
            </div>
          </div>
          <p className="max-w-2xl text-sm leading-6 text-[var(--text-muted)]">
            A dedicated observability and operations interface for the Ubuntu runner. All actions are allowlisted, audited, and strictly bounded.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => void runPreflight()}
            disabled={loading}
            className="h-10 shrink-0 gap-2 rounded-[var(--radius-control)] bg-[var(--foreground)] px-4 text-sm font-medium text-[var(--background)] hover:opacity-90"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {loading ? "Checking VM…" : "Run preflight"}
          </Button>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-[var(--border)] pb-2 text-sm">
        {[
          { id: "overview" as const, label: "Overview & Health", icon: Activity },
          {
            id: "healing" as const,
            label: "Self-Healing",
            icon: GitBranch,
            badge: proposals.length > 0 ? proposals.length : undefined,
          },
          { id: "tasks" as const, label: "Task Runner", icon: TerminalSquare },
          { id: "benchmarks" as const, label: "Benchmarks", icon: BarChart3 },
          { id: "snapshot" as const, label: "Diagnostic Snapshot", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-xs font-medium transition-colors sm:text-sm",
                active
                  ? "bg-[var(--surface-raised)] text-[var(--foreground)] border border-[var(--border)]"
                  : "text-[var(--text-muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]",
              )}
            >
              <Icon className="size-4" />
              <span>{tab.label}</span>
              {typeof tab.badge === "number" && (
                <span className="flex size-4 items-center justify-center rounded-full bg-[var(--danger)] text-[10px] font-bold text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Global Preflight Error Banner */}
      {error && (
        <div className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-[var(--danger)]/25 bg-[var(--danger-muted)] p-4">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--foreground)]">Preflight needs attention</p>
            <p className="mt-1 break-words text-sm text-[var(--text-secondary)]">{error}</p>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW & HEALTH */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div className="min-w-0">
                  <p className="text-xs text-[var(--text-muted)]">Ubuntu VM Host</p>
                  <p className="mt-2 text-lg font-semibold">{status.label}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {vmStatus?.apiOnline === false
                      ? "Runner API unavailable"
                      : vmStatus?.warning || "Authenticated control-plane status"}
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
                  <p className="text-xs text-[var(--text-muted)]">Runner Service</p>
                  <div className="mt-2">
                    <StatusBadge value={vmStatus?.runner?.running} />
                  </div>
                  <p className="mt-2 text-xs text-[var(--text-secondary)]">
                    {vmStatus?.runner?.port ? `Listening on port ${vmStatus.runner.port}` : "Port not reported"}
                  </p>
                </div>
                <TerminalSquare className="size-5 text-[var(--text-secondary)]" />
              </CardContent>
            </Card>

            <Card className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">CPU / Memory</p>
                  <p className="mt-2 text-lg font-semibold tabular-nums">
                    {cpuPercent ?? "—"}{" "}
                    <span className="text-sm font-normal text-[var(--text-muted)]">/ {memoryPercent ?? "—"}</span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">Values returned by VM diagnostic probe.</p>
                </div>
                <Cpu className="size-5 text-[var(--text-secondary)]" />
              </CardContent>
            </Card>

            <Card className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
              <CardContent className="flex items-start justify-between gap-3 p-5">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">Disk / Recent Events</p>
                  <p className="mt-2 text-lg font-semibold tabular-nums">
                    {diskPercent ?? "—"}{" "}
                    <span className="text-sm font-normal text-[var(--text-muted)]">
                      / {telemetryUnavailable ? "Unavailable" : events.length}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {telemetryUnavailable
                      ? "Telemetry endpoint offline."
                      : "Recent system telemetry events."}
                  </p>
                </div>
                <HardDrive className="size-5 text-[var(--text-secondary)]" />
              </CardContent>
            </Card>
          </section>

          {/* Active Proposals Quick Alert if any */}
          {proposals.length > 0 && (
            <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-[var(--warning)]/30 bg-[var(--warning-muted)] p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ShieldAlert className="mt-0.5 size-5 shrink-0 text-[var(--warning)]" />
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">
                    {proposals.length} Self-Healing {proposals.length === 1 ? "Proposal" : "Proposals"} Available
                  </p>
                  <p className="text-xs text-[var(--text-secondary)]">
                    Astro detected anomalies requiring attention. Review proposed repairs in the Self-Healing tab.
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab("healing")}
                className="h-8 shrink-0 gap-1.5 border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--surface-raised)]"
              >
                <span>Review Proposals</span>
                <GitBranch className="size-3.5" />
              </Button>
            </div>
          )}

          {/* Service Inspection Checklist */}
          <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 p-5 sm:p-6">
              <div>
                <CardTitle className="text-base font-semibold">Service Inspection</CardTitle>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  Live verification of essential server background units and ports.
                </p>
              </div>
              <ShieldCheck className="size-5 shrink-0 text-[var(--text-secondary)]" />
            </CardHeader>
            <CardContent className="space-y-0 px-5 pb-5 sm:px-6 sm:pb-6">
              {[
                { label: "Sycord VM Runner", detail: "Flask/Python runtime orchestrator on port 5050", active: vmStatus?.runner?.running },
                { label: "Nginx Reverse Proxy", detail: "Public ingress HTTP daemon on port 80/443", active: vmStatus?.nginx?.running },
                { label: "Cloudflare Tunnel", detail: "Zero-trust ingress daemon (cloudflared)", active: vmStatus?.cloudflared?.running },
              ].map((service) => (
                <div
                  key={service.label}
                  className="flex items-center justify-between gap-4 border-t border-[var(--border)] py-3 first:border-t-0"
                >
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
        </div>
      )}

      {/* TAB 2: SELF-HEALING WORKFLOW */}
      {activeTab === "healing" && (
        <div className="space-y-6">
          {/* 6-step workflow lifecycle banner */}
          <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
            <CardHeader className="p-5 sm:p-6">
              <CardTitle className="text-base font-semibold">Self-Healing Execution Cycle</CardTitle>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Every repair follows an audited and bounded loop: Inspect → Classify → Propose → Approve → Execute → Verify.
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { title: "1. Inspect", active: Boolean(vmStatus), current: healingStepStatus.step === "inspecting" },
                  { title: "2. Classify", active: Boolean(vmStatus && !error), current: healingStepStatus.step === "classified" },
                  { title: "3. Propose", active: proposals.length > 0 || Boolean(vmStatus), current: false },
                  { title: "4. Approve", active: false, current: healingStepStatus.step === "approving" },
                  { title: "5. Execute", active: false, current: healingStepStatus.step === "executing" },
                  { title: "6. Verify", active: healingStepStatus.step === "complete", current: healingStepStatus.step === "verifying" },
                ].map((st, i) => (
                  <div
                    key={st.title}
                    className={cn(
                      "flex flex-col items-center justify-center rounded-[var(--radius-panel)] border p-3 text-center transition-all",
                      st.current
                        ? "border-[var(--foreground)] bg-[var(--surface-raised)]"
                        : st.active
                          ? "border-[var(--success)]/30 bg-[var(--success-muted)] text-[var(--success)]"
                          : "border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
                    )}
                  >
                    <span className="text-xs font-semibold">{st.title}</span>
                    <span className="mt-1 text-[10px]">
                      {st.current ? "In progress" : st.active ? "Ready / Passed" : "Pending"}
                    </span>
                  </div>
                ))}
              </div>

              {healingStepStatus.detail && (
                <div className="mt-4 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs text-[var(--text-secondary)]">
                  <span className="font-medium text-[var(--foreground)]">Current Lifecycle State: </span>
                  {healingStepStatus.detail}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Active Proposals List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-tight text-[var(--foreground)]">
                Active Anomaly Proposals ({proposals.length})
              </h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runPreflight()}
                disabled={loading}
                className="h-8 gap-1.5 text-xs border-[var(--border)] text-[var(--foreground)]"
              >
                <RefreshCw className={cn("size-3.5", loading && "animate-spin")} />
                <span>Re-evaluate</span>
              </Button>
            </div>

            {proposals.length === 0 ? (
              <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
                <CardContent className="flex flex-col items-center justify-center p-8 text-center">
                  <CheckCircle2 className="size-8 text-[var(--success)]" />
                  <p className="mt-3 text-sm font-medium">No Anomalies Detected</p>
                  <p className="mt-1 max-w-md text-xs text-[var(--text-muted)]">
                    All supervised services (runner daemon, nginx reverse proxy, system memory, and storage volumes) are within normal operational thresholds.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {proposals.map((proposal) => (
                  <Card
                    key={proposal.id}
                    className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none"
                  >
                    <CardContent className="p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-[var(--foreground)]">{proposal.title}</h3>
                            <RiskBadge risk={proposal.riskLevel} />
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                proposal.severity === "critical"
                                  ? "border-red-500/25 bg-red-500/10 text-red-400"
                                  : "border-amber-500/25 bg-amber-500/10 text-amber-400",
                              )}
                            >
                              {proposal.severity}
                            </Badge>
                          </div>
                          <p className="text-xs text-[var(--danger)]">
                            <span className="font-medium text-[var(--text-secondary)]">Observed Issue: </span>
                            {proposal.issueSummary}
                          </p>
                          <p className="text-xs text-[var(--text-muted)]">
                            <span className="font-medium text-[var(--text-secondary)]">Recommended Action: </span>
                            {proposal.recommendedFix}
                          </p>
                        </div>

                        <Button
                          size="sm"
                          disabled={executingProposalId === proposal.id}
                          onClick={() => setProposalApprovalModal(proposal)}
                          className="h-9 shrink-0 gap-1.5 rounded-[var(--radius-control)] bg-[var(--foreground)] text-xs font-medium text-[var(--background)] hover:opacity-90"
                        >
                          {executingProposalId === proposal.id ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Wrench className="size-3.5" />
                          )}
                          <span>Approve & Execute</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SECURE TASK RUNNER */}
      {activeTab === "tasks" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Allowlisted Task Registry</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Strict allowlist of predefined diagnostic and maintenance operations. Arbitrary shell inputs are strictly rejected.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {tasks.map((task) => {
              const isRunning = runningTaskId === task.id
              return (
                <Card
                  key={task.id}
                  className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{task.name}</p>
                        <p className="mt-1 text-xs text-[var(--text-muted)]">{task.description}</p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <RiskBadge risk={task.riskLevel} />
                        <span className="text-[10px] text-[var(--text-muted)]">
                          {(task.timeoutMs / 1000).toFixed(0)}s max
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                      <span className="text-[10px] text-[var(--text-muted)]">
                        {task.requiresApproval ? "Requires approval confirmation" : "Read-only inspection"}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isRunning || runningTaskId !== null}
                        onClick={() => void runTask(task)}
                        className="h-8 gap-1.5 border-[var(--border)] text-xs text-[var(--foreground)] hover:bg-[var(--surface-raised)]"
                      >
                        {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Play className="size-3.5" />}
                        <span>{isRunning ? "Running…" : "Run Task"}</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Task Output Terminal Viewer */}
          {taskResult && (
            <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
              <CardHeader className="flex flex-row items-center justify-between p-5 pb-3">
                <div className="flex items-center gap-2">
                  <TerminalSquare className="size-4 text-[var(--text-secondary)]" />
                  <CardTitle className="text-sm font-semibold">
                    Execution Output: {taskResult.taskName}
                  </CardTitle>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      taskResult.success
                        ? "border-[var(--success)]/25 bg-[var(--success-muted)] text-[var(--success)]"
                        : "border-[var(--danger)]/25 bg-[var(--danger-muted)] text-[var(--danger)]",
                    )}
                  >
                    {taskResult.success ? "Success (0)" : `Failed (${taskResult.exitCode ?? "ERR"})`}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-muted)] tabular-nums">{taskResult.durationMs}ms</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setTaskResult(null)}
                    className="h-7 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]"
                  >
                    Dismiss
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-5 pt-0">
                <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 font-mono text-xs leading-5 text-[var(--text-secondary)]">
                  {taskResult.stdout || taskResult.stderr || "No output returned by command."}
                </pre>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* TAB 4: BENCHMARKS */}
      {activeTab === "benchmarks" && (
        <div className="space-y-6">
          <div className="flex flex-col gap-2 border-b border-[var(--border)] pb-4">
            <h2 className="text-base font-semibold text-[var(--foreground)]">Reproducible Workload Benchmarks</h2>
            <p className="text-xs text-[var(--text-muted)]">
              Empirical server benchmarks measuring raw CPU throughput, synchronous disk write speeds, and runner loopback roundtrip latency.
            </p>
          </div>

          {benchmarkError && (
            <div className="flex items-start gap-3 rounded-[var(--radius-panel)] border border-[var(--danger)]/25 bg-[var(--danger-muted)] p-4">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--danger)]" />
              <p className="text-sm text-[var(--foreground)]">{benchmarkError}</p>
            </div>
          )}

          {/* Benchmark Profiles Grid */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {benchmarks.map((b) => {
              const isRunning = runningBenchmarkId === b.id
              return (
                <Card
                  key={b.id}
                  className="rounded-[var(--radius-panel)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none flex flex-col justify-between"
                >
                  <CardContent className="p-5 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider">{b.target}</span>
                        <span className="text-xs text-[var(--text-muted)]">{b.expectedDuration}</span>
                      </div>
                      <p className="mt-1 text-sm font-semibold">{b.name}</p>
                      <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{b.description}</p>
                    </div>

                    <Button
                      size="sm"
                      disabled={isRunning || runningBenchmarkId !== null}
                      onClick={() => void runBenchmark(b.id)}
                      className="w-full h-9 gap-1.5 rounded-[var(--radius-control)] bg-[var(--foreground)] text-xs font-medium text-[var(--background)] hover:opacity-90"
                    >
                      {isRunning ? <Loader2 className="size-3.5 animate-spin" /> : <Zap className="size-3.5" />}
                      <span>{isRunning ? "Benchmarking…" : "Run Benchmark"}</span>
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {/* Benchmark History */}
          <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
            <CardHeader className="p-5 sm:p-6">
              <CardTitle className="text-sm font-semibold">Benchmark History</CardTitle>
              <p className="mt-0.5 text-xs text-[var(--text-secondary)]">
                Historical run outcomes and recorded empirical scores.
              </p>
            </CardHeader>
            <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
              {benchmarkHistory.length === 0 ? (
                <div className="py-6 text-center text-xs text-[var(--text-muted)]">
                  No benchmark runs recorded yet. Trigger a profile above to evaluate system performance.
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {benchmarkHistory.map((item) => (
                    <div key={item.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-[var(--foreground)]">{item.name}</span>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              item.status === "completed"
                                ? "border-[var(--success)]/25 bg-[var(--success-muted)] text-[var(--success)]"
                                : "border-[var(--danger)]/25 bg-[var(--danger-muted)] text-[var(--danger)]",
                            )}
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)]">
                          {new Date(item.executedAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {item.score && (
                          <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                            {item.score}
                          </span>
                        )}
                        <span className="text-xs text-[var(--text-muted)] tabular-nums">{item.durationMs}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 5: DIAGNOSTIC SNAPSHOT */}
      {activeTab === "snapshot" && (
        <Card className="rounded-[var(--radius-surface)] border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] shadow-none">
          <CardHeader className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <CardTitle className="text-base font-semibold">Diagnostic Snapshot</CardTitle>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Raw JSON payload returned by authenticated control plane endpoints.
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => void copyReport()}
              disabled={!vmStatus}
              className="h-9 gap-2 rounded-[var(--radius-control)] border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--foreground)] hover:bg-[var(--surface-raised)]"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy report"}
            </Button>
          </CardHeader>
          <CardContent className="px-5 pb-5 sm:px-6 sm:pb-6">
            {vmStatus ? (
              <pre className="max-h-[440px] overflow-auto whitespace-pre-wrap break-words rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-4 font-mono text-xs leading-5 text-[var(--text-secondary)]">
                {report}
              </pre>
            ) : (
              <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-5 text-sm text-[var(--text-muted)]">
                {loading ? "Collecting diagnostic snapshot…" : "No diagnostic snapshot available yet."}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* APPROVAL MODAL FOR TASK RUNNER */}
      {approvalModalTask && (
        <Dialog open={Boolean(approvalModalTask)} onOpenChange={() => setApprovalModalTask(null)}>
          <DialogContent className="max-w-md border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Confirm Task Execution</DialogTitle>
              <DialogDescription className="text-xs text-[var(--text-secondary)]">
                This operation mutates VM service status. Please confirm you wish to execute it.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-3 text-xs">
                <p className="font-semibold text-[var(--foreground)]">{approvalModalTask.name}</p>
                <p className="mt-1 text-[var(--text-muted)]">{approvalModalTask.description}</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="confirm-approval"
                  checked={approvalConfirmed}
                  onChange={(e) => setApprovalConfirmed(e.target.checked)}
                  className="rounded border-[var(--border)]"
                />
                <label htmlFor="confirm-approval" className="text-xs text-[var(--foreground)] cursor-pointer">
                  I understand this command will run directly on the host VM.
                </label>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setApprovalModalTask(null)}
                className="border-[var(--border)] text-xs text-[var(--foreground)]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!approvalConfirmed}
                onClick={() => void runTask(approvalModalTask, true)}
                className="bg-[var(--foreground)] text-xs text-[var(--background)] hover:opacity-90"
              >
                Confirm & Run
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* APPROVAL MODAL FOR SELF-HEALING PROPOSAL */}
      {proposalApprovalModal && (
        <Dialog open={Boolean(proposalApprovalModal)} onOpenChange={() => setProposalApprovalModal(null)}>
          <DialogContent className="max-w-md border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold">Approve Self-Healing Repair</DialogTitle>
              <DialogDescription className="text-xs text-[var(--text-secondary)]">
                Approve and execute the proposed automated repair action for this anomaly.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface-muted)] p-3 space-y-1.5">
                <p className="font-semibold text-[var(--foreground)]">{proposalApprovalModal.title}</p>
                <p className="text-[var(--danger)]">
                  <span className="font-medium text-[var(--text-secondary)]">Issue: </span>
                  {proposalApprovalModal.issueSummary}
                </p>
                <p className="text-[var(--text-muted)]">
                  <span className="font-medium text-[var(--text-secondary)]">Fix: </span>
                  {proposalApprovalModal.recommendedFix}
                </p>
              </div>
              <div className="rounded-[var(--radius-panel)] border border-[var(--warning)]/20 bg-[var(--warning-muted)] p-2.5 text-[11px] text-[var(--text-secondary)]">
                Following execution, Astro will automatically trigger post-flight verification to confirm service recovery.
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setProposalApprovalModal(null)}
                className="border-[var(--border)] text-xs text-[var(--foreground)]"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void executeProposal(proposalApprovalModal)}
                className="bg-[var(--foreground)] text-xs text-[var(--background)] hover:opacity-90"
              >
                Approve & Execute
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
