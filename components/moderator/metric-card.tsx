"use client"

import React from "react"
import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: number | string
  changeText?: string
  icon: LucideIcon
  iconColor?: string
  className?: string
}

export function MetricCard({
  title,
  value,
  changeText = "— vs. last week",
  icon: Icon,
  iconColor = "text-muted-foreground",
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("bg-card/90 border-border text-card-foreground shadow-xs rounded-lg py-0 gap-0 hover:bg-card transition-colors", className)}>
      <CardContent className="p-3 sm:p-3.5 flex items-center justify-between gap-2">
        <div className="space-y-0.5 min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground truncate">{title}</p>
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg sm:text-xl font-bold tracking-tight text-foreground">{value}</span>
          </div>
          {changeText && (
            <p className="text-[10px] text-muted-foreground/80 font-normal truncate">{changeText}</p>
          )}
        </div>
        <div className="w-7 h-7 rounded-md bg-muted/60 border border-border/50 flex items-center justify-center shrink-0">
          <Icon className={cn("w-3.5 h-3.5", iconColor)} />
        </div>
      </CardContent>
    </Card>
  )
}

