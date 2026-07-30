"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

export function StatusBadge() {
  const [isOperational, setIsOperational] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(true)

  useEffect(() => {
    fetch("/api/servers/status")
      .then((res) => {
        if (res.ok) return res.json()
        throw new Error("Failed to fetch status")
      })
      .then((data) => {
        setIsOperational(data.globalStatus !== "outage")
        setLoading(false)
      })
      .catch(() => {
        // Default to operational if status check fails to avoid alarming users
        setIsOperational(true)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-muted animate-pulse" />
        <span className="text-sm font-medium text-muted-foreground">Checking status...</span>
      </div>
    )
  }

  return (
    <Link href="/servers" className="flex items-center gap-3 transition-colors group">
      <div
        className={cn(
          "w-2 h-2 rounded-full transition-colors",
          isOperational ? "bg-[#00E599]" : "bg-red-500"
        )}
      />
      <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
        {isOperational ? "All service is operational" : "Service disruption detected"}
      </span>
    </Link>
  )
}
