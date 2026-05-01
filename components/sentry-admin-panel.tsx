"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Bot, ChevronDown, Loader2, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type SentryIssueSource = "vm-build" | "vm-deploy" | "ai-generation" | "website-runtime"

export interface DashboardSentryIssue {
  id: string
  projectId: string
  source: SentryIssueSource
  deploymentId?: string
  rawLog: string
  logHash: string
  status: "new" | "skipped" | "marked" | "fixed"
  aiDecision?: "skip" | "mark"
  errorName?: string
  description?: string
  fixSuggestion?: string
  affectedFile?: string
  createdAt: string
  updatedAt: string
}

type FilterId = "all" | "marked" | "skipped" | "vm-build" | "ai-generation" | "website-runtime"

const filters: Array<{ id: FilterId; label: string }> = [
  { id: "all", label: "All" },
  { id: "marked", label: "Marked" },
  { id: "skipped", label: "Skipped" },
  { id: "vm-build", label: "VM Build" },
  { id: "ai-generation", label: "AI Generation" },
  { id: "website-runtime", label: "Website" },
]

const sourceLabels: Record<SentryIssueSource, string> = {
  "vm-build": "VM Build",
  "vm-deploy": "VM Deploy",
  "ai-generation": "AI Generation",
  "website-runtime": "Website Runtime",
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Unknown"
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

export function SentryAdminPanel({
  issues,
  loading,
  rescanning,
  error,
  onRescan,
}: {
  issues: DashboardSentryIssue[]
  loading: boolean
  rescanning: boolean
  error: string | null
  onRescan: () => void
}) {
  const [filter, setFilter] = useState<FilterId>("all")
  const [openLogs, setOpenLogs] = useState<Set<string>>(new Set())

  const actionableCount = issues.filter((issue) => issue.aiDecision === "mark" || issue.status === "marked").length
  const filteredIssues = useMemo(() => {
    if (filter === "all") return issues
    if (filter === "marked") return issues.filter((issue) => issue.aiDecision === "mark" || issue.status === "marked")
    if (filter === "skipped") return issues.filter((issue) => issue.aiDecision === "skip" || issue.status === "skipped")
    if (filter === "vm-build") return issues.filter((issue) => issue.source === "vm-build" || issue.source === "vm-deploy")
    return issues.filter((issue) => issue.source === filter)
  }, [filter, issues])

  const toggleLog = (issueId: string) => {
    setOpenLogs((prev) => {
      const next = new Set(prev)
      if (next.has(issueId)) next.delete(issueId)
      else next.add(issueId)
      return next
    })
  }

  return (
    <div className="min-h-full rounded-[2rem] border border-white/10 bg-[#0d0f10] p-4 text-white shadow-2xl md:p-6 lg:p-8">
      <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            <Bot className="h-3.5 w-3.5" />
            OpenRouter AI auto-bug detection
          </div>
          <div>
            <h1 className="max-w-3xl text-3xl font-black tracking-tight text-white md:text-5xl">
              Sentry found <span className="text-emerald-400">{actionableCount}</span>{" "}
              {actionableCount === 1 ? "error" : "errors"} based on your activity
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-white/50 md:text-base">
              Failed deployments, AI builder diagnostics, and runtime support are deduped, redacted, classified one by one, and saved to this project.
            </p>
          </div>
        </div>

        <Button
          onClick={onRescan}
          disabled={rescanning}
          className="rounded-full bg-emerald-400 px-5 text-black hover:bg-emerald-300"
        >
          {rescanning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Re-scan activity
        </Button>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-semibold transition-colors",
              filter === item.id
                ? "border-emerald-400 bg-emerald-400 text-black"
                : "border-white/10 bg-white/[0.04] text-white/60 hover:bg-white/[0.08] hover:text-white",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex min-h-[320px] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.03]">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      ) : filteredIssues.length === 0 ? (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-dashed border-white/10 bg-white/[0.03] text-center">
          <AlertTriangle className="mb-4 h-10 w-10 text-white/25" />
          <p className="text-lg font-semibold text-white">No issues in this view</p>
          <p className="mt-2 max-w-md text-sm text-white/45">
            Successful builds and non-actionable logs stay out of the actionable count.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredIssues.map((issue) => {
            const isMarked = issue.aiDecision === "mark" || issue.status === "marked"
            const logOpen = openLogs.has(issue.id)
            return (
              <article
                key={issue.id}
                className="overflow-hidden rounded-3xl border border-white/10 bg-[#16191b] shadow-lg shadow-black/20"
              >
                <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={cn("rounded-full border px-2.5 py-1", isMarked ? "border-red-400/30 bg-red-400/15 text-red-200" : "border-white/10 bg-white/5 text-white/50")}>
                        [{isMarked ? "mark" : "skip"}]
                      </Badge>
                      <Badge variant="outline" className="rounded-full border-white/10 bg-white/[0.03] text-white/60">
                        {sourceLabels[issue.source]}
                      </Badge>
                      <span className="text-xs text-white/35">{formatDate(issue.createdAt)}</span>
                    </div>

                    <div>
                      <h2 className="text-xl font-bold text-white">
                        {issue.errorName || (isMarked ? "Detected issue" : "Skipped log")}
                      </h2>
                      <p className="mt-2 text-sm leading-6 text-white/60">
                        {issue.description || "No description returned yet."}
                      </p>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/30">Fix suggestion</p>
                        <p className="text-sm text-white/65">{issue.fixSuggestion || "No fix needed."}</p>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-white/30">Affected file</p>
                        <p className="break-all font-mono text-sm text-emerald-300">{issue.affectedFile || "Not visible in log"}</p>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleLog(issue.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm font-semibold text-white/60 hover:bg-white/[0.08] hover:text-white"
                  >
                    Raw log
                    <ChevronDown className={cn("h-4 w-4 transition-transform", logOpen && "rotate-180")} />
                  </button>
                </div>

                {logOpen && (
                  <pre className="max-h-96 overflow-auto border-t border-white/10 bg-black/45 p-5 text-xs leading-5 text-white/55">
                    {issue.rawLog}
                  </pre>
                )}
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}
