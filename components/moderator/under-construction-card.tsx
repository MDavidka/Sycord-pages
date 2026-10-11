"use client"

import React from "react"
import { LucideIcon, Construction, ArrowUpRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface UnderConstructionCardProps {
  title: string
  subtitle: string
  description: string
  icon: LucideIcon
  badgeText?: string
  targetRelease?: string
}

export function UnderConstructionCard({
  title,
  subtitle,
  description,
  icon: Icon,
  badgeText = "Under Construction",
  targetRelease = "Target Release: Q4 Unified Safety Overhaul",
}: UnderConstructionCardProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[480px] px-4 py-12 text-center animate-in fade-in duration-150">
      <div className="max-w-md w-full rounded-[var(--radius-surface)] border border-[var(--border)] bg-[var(--surface)] p-8 sm:p-10 shadow-[var(--shadow-card)] flex flex-col items-center">
        {/* Dual concentric icon container */}
        <div className="w-16 h-16 rounded-[var(--radius-panel)] bg-[var(--surface-raised)] border border-[var(--border-strong)] flex items-center justify-center mb-6 shadow-[var(--shadow-floating)]">
          <Icon className="w-8 h-8 text-[var(--foreground)]" />
        </div>

        <Badge
          variant="outline"
          className="mb-4 text-[11px] font-medium tracking-wide uppercase px-2.5 py-0.5 rounded-[var(--radius-full)] bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
        >
          <Construction className="w-3 h-3 mr-1.5" />
          {badgeText}
        </Badge>

        <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)] mb-1 font-[family-name:var(--font-display)]">
          {title}
        </h2>
        <p className="text-xs font-medium text-[var(--text-secondary)] mb-4">
          {subtitle}
        </p>

        <p className="text-xs text-[var(--text-muted)] leading-relaxed mb-6 max-w-sm">
          {description}
        </p>

        <div className="w-full pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>{targetRelease}</span>
          <span className="font-mono tabular-nums text-[var(--text-secondary)]">v2.4-mod</span>
        </div>
      </div>
    </div>
  )
}
