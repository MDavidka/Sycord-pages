"use client"

import { AlertTriangle, CheckCircle2, FileWarning } from "lucide-react"
import type { BuildIssue } from "@/lib/builder/types"

interface BuildPanelProps {
  issues: BuildIssue[]
  logs: string[]
}

export function BuildPanel({ issues, logs }: BuildPanelProps) {
  if (logs.length === 0 && issues.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Build results will appear here after generation.
      </div>
    )
  }

  return (
    <div className="p-3 space-y-4">
      {issues.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>Build validation passed</span>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-yellow-600">
            <AlertTriangle className="h-4 w-4" />
            <span>{issues.length} issue{issues.length !== 1 ? "s" : ""} found</span>
          </div>
          {issues.map((issue, i) => (
            <div key={i} className="px-2.5 py-2 rounded-md border border-yellow-500/20 bg-yellow-500/5">
              <div className="flex items-start gap-1.5">
                <FileWarning className="h-3 w-3 mt-0.5 text-yellow-500 shrink-0" />
                <div className="min-w-0">
                  <span className="text-[11px] font-mono text-muted-foreground">{issue.file}{issue.line ? `:${issue.line}` : ""}</span>
                  <p className="text-xs mt-0.5">{issue.message}</p>
                  <span className="text-[10px] text-muted-foreground">{issue.category}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {logs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold mb-1.5">Build Logs</h4>
          <pre className="text-[11px] font-mono text-muted-foreground bg-muted/50 rounded-md p-2 whitespace-pre-wrap">
            {logs.join("\n")}
          </pre>
        </div>
      )}
    </div>
  )
}
