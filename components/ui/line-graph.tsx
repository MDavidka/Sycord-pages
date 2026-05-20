"use client"

import React from "react"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"

export interface LineGraphProps {
  data?: Array<{ name: string; value: number }>
  xKey?: string
  yKey?: string
  color?: string
  className?: string
}

const FALLBACK_DATA = [
  { name: "Mon", value: 40 },
  { name: "Tue", value: 55 },
  { name: "Wed", value: 48 },
  { name: "Thu", value: 70 },
  { name: "Fri", value: 62 },
]

export function LineGraph({ data, xKey = "name", yKey = "value", color = "hsl(var(--primary))", className }: LineGraphProps) {
  const chartData = data && data.length ? data : FALLBACK_DATA
  return (
    <div className={cn("h-48 w-full rounded-xl border bg-card p-4", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey={xKey} axisLine={false} tickLine={false} fontSize={12} />
          <YAxis hide />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
