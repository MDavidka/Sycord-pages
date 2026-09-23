"use client"

import React from "react"
import { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
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
  iconColor = "text-zinc-400",
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("bg-[#111111] border-[#27272a] text-zinc-100 shadow-sm rounded-xl py-0 gap-0", className)}>
      <CardContent className="p-4 sm:p-5 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-zinc-400">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-white mt-1">{value}</p>
          <p className="text-[11px] text-zinc-400 font-normal">{changeText}</p>
        </div>
        <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center shrink-0">
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </CardContent>
    </Card>
  )
}
