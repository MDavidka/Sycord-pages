"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import {
  Activity,
  CheckCircle2,
  Copy,
  Check,
  AlertTriangle,
  Server,
  Clock,
  Code,
} from "lucide-react"
import type { TelemetryEvent } from "@/app/api/moderator/telemetry/route"

interface TelemetryDetailsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: TelemetryEvent | null
  onResolve?: (eventId: string, status: "acknowledged" | "resolved") => void
}

export function TelemetryDetailsModal({
  open,
  onOpenChange,
  event,
  onResolve,
}: TelemetryDetailsModalProps) {
  const [copied, setCopied] = useState(false)

  if (!event) return null

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2))
    setCopied(true)
    toast.success("Event telemetry copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "critical":
      case "error":
        return "bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/20"
      case "warning":
        return "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
      case "info":
        return "bg-[var(--info-muted)] text-[var(--info)] border-[var(--info)]/20"
      default:
        return "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]"
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[var(--surface-raised)] border border-[var(--border-strong)] text-[var(--foreground)] rounded-[var(--radius-panel)] p-6 shadow-[var(--shadow-overlay)]">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                <Activity className="w-4 h-4 text-[var(--foreground)]" />
              </div>
              <DialogTitle className="text-base font-semibold">Telemetry Trace & Diagnostics</DialogTitle>
            </div>
            <Badge
              variant="outline"
              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-[var(--radius-full)] ${getSeverityBadgeClass(
                event.severity
              )}`}
            >
              {event.severity}
            </Badge>
          </div>
          <DialogDescription className="text-xs text-[var(--text-muted)]">
            Event ID: <span className="font-mono text-[var(--text-secondary)]">{event.event_id}</span> • Service:{" "}
            <span className="font-semibold text-[var(--foreground)]">{event.service}</span>
          </DialogDescription>
        </DialogHeader>

        {/* Quick Meta Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-3 border-y border-[var(--border-subtle)] my-2 text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">HTTP Status</span>
            <div className="font-mono font-semibold text-[var(--foreground)]">{event.http_status}</div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">Latency</span>
            <div className="font-mono text-[var(--foreground)]">{event.duration_ms} ms</div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">Region / Node</span>
            <div className="font-mono text-[var(--text-secondary)]">{event.region_id || "us-east-1"}</div>
          </div>
          <div className="space-y-0.5">
            <span className="text-[10px] text-[var(--text-muted)] uppercase">State</span>
            <div className="font-semibold capitalize text-[var(--foreground)]">{event.resolution_status}</div>
          </div>
        </div>

        {/* Message / Error Details */}
        <div className="space-y-2">
          <div className="text-xs font-semibold text-[var(--foreground)]">Operation & Message</div>
          <div className="p-3 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] leading-relaxed">
            <p className="font-mono text-[11px] text-[var(--foreground)] mb-1">{event.operation}</p>
            <p>{event.message}</p>
          </div>
        </div>

        {/* Raw JSON Payload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--foreground)] flex items-center gap-1.5">
              <Code className="w-3.5 h-3.5 text-[var(--text-muted)]" />
              Raw Telemetry Context
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopyJson}
              className="h-6 px-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)] gap-1"
            >
              {copied ? <Check className="w-3 h-3 text-[var(--success)]" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? "Copied" : "Copy JSON"}</span>
            </Button>
          </div>
          <pre className="p-3 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] text-[11px] font-mono text-[var(--text-secondary)] max-h-48 overflow-y-auto custom-scrollbar">
            {JSON.stringify(event, null, 2)}
          </pre>
        </div>

        <DialogFooter className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)]"
          >
            Close
          </Button>

          <div className="flex items-center gap-2">
            {event.resolution_status !== "acknowledged" && event.resolution_status !== "resolved" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onResolve?.(event.event_id, "acknowledged")
                  toast.success(`Event ${event.event_id} marked as acknowledged`)
                  onOpenChange(false)
                }}
                className="h-8 px-3 text-xs border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]"
              >
                Acknowledge
              </Button>
            )}

            {event.resolution_status !== "resolved" && (
              <Button
                size="sm"
                onClick={() => {
                  onResolve?.(event.event_id, "resolved")
                  toast.success(`Event ${event.event_id} marked as resolved`)
                  onOpenChange(false)
                }}
                className="h-8 px-3 text-xs bg-[var(--success)] text-[var(--background)] hover:opacity-90 font-medium"
              >
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                Resolve Incident
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
