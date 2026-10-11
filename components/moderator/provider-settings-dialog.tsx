"use client"

import React from "react"
import { Globe, Server, CheckCircle2, ShieldCheck, X } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ProviderLogo } from "./provider-logos"

export interface ProviderDetails {
  id: string
  name: string
  provider: string
  baseUrl: string
  apiType: string
  modelCount: number
  gatewayExposed: boolean
  validationState: "verified" | "configurable" | "local"
  description: string
}

interface ProviderSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  provider: ProviderDetails | null
}

export function ProviderSettingsDialog({
  open,
  onOpenChange,
  provider,
}: ProviderSettingsDialogProps) {
  if (!provider) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full bg-[var(--surface)] border-[var(--border-strong)] text-[var(--foreground)] rounded-[var(--radius-panel)] p-6 shadow-[var(--shadow-overlay)]">
        <DialogHeader className="space-y-1.5 pb-4 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center shrink-0">
              <ProviderLogo provider={provider.provider} size={20} />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-[var(--foreground)] leading-none">
                {provider.name} Settings
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--text-muted)] mt-1">
                Authoritative runtime routing and gateway publication
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 text-xs">
          {/* Base URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
              <span>Base URL / Endpoint</span>
            </label>
            <div className="p-2.5 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] font-mono text-[11px] break-all select-all text-[var(--foreground)]">
              {provider.baseUrl || "Default Platform Gateway Endpoint"}
            </div>
          </div>

          {/* API Type & Validation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                <span>Protocol / Type</span>
              </label>
              <div className="p-2 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] font-mono text-[11px] text-[var(--foreground)]">
                {provider.apiType}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-medium text-[var(--text-muted)] flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
                <span>Validation State</span>
              </label>
              <div className="p-2 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] flex items-center">
                <Badge
                  variant="outline"
                  className="bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] font-mono px-2 py-0 rounded-[var(--radius-full)]"
                >
                  {provider.validationState.toUpperCase()}
                </Badge>
              </div>
            </div>
          </div>

          {/* Gateway Exposure Status */}
          <div className="space-y-1.5 p-3 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)]">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[var(--foreground)] flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[var(--info)]" />
                Gateway Exposure
              </span>
              <Badge
                variant="outline"
                className={
                  provider.gatewayExposed
                    ? "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] font-mono px-2 py-0 rounded-[var(--radius-full)]"
                    : "bg-[var(--surface)] text-[var(--text-muted)] border-[var(--border)] text-[10px] font-mono px-2 py-0 rounded-[var(--radius-full)]"
                }
              >
                {provider.gatewayExposed ? "Platform Active" : "Private Scoped"}
              </Badge>
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">
              {provider.gatewayExposed
                ? "Exposed securely via /api/ai/omni to authenticated builder sessions. User-defined custom providers never leak into this scope."
                : "Confined to direct VM runtime execution and workspace sessions."}
            </p>
          </div>

          {/* Model Count & Description */}
          <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
            <span>Library Models Registered</span>
            <span className="font-mono tabular-nums text-[var(--foreground)] font-semibold">
              {provider.modelCount} models
            </span>
          </div>
        </div>

        <div className="pt-3 border-t border-[var(--border)] flex justify-end">
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="h-8 px-4 text-xs bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 rounded-[var(--radius-control)] font-medium"
          >
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
