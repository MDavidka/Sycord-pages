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
  iconColor = "text-[#A7AAB0]",
  className,
}: MetricCardProps) {
  return (
    <Card className={cn("bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] shadow-sm rounded-xl", className)}>
      <CardContent className="p-4 flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-[#A7AAB0]">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-[#E5E7EB]">{value}</p>
          <p className="text-[11px] text-[#777B82] font-normal">{changeText}</p>
        </div>
        <div className="p-2 rounded-lg bg-[#242528] border border-[#2A2C30]/50 shrink-0">
          <Icon className={cn("w-4 h-4", iconColor)} />
        </div>
      </CardContent>
    </Card>
  )
}
