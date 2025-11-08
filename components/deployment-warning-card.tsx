"use client"

import { useState, useEffect } from "react"
import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface DeploymentWarningCardProps {
  subdomain: string
  reason: "curse_words" | "no_subdomain"
  deploymentId: string
  projectId: string
  onDelete: (deploymentId: string) => void
}

export function DeploymentWarningCard({
  subdomain,
  reason,
  deploymentId,
  projectId,
  onDelete,
}: DeploymentWarningCardProps) {
  const [timeLeft, setTimeLeft] = useState(300) // 5 minutes in seconds
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (dismissed) return

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Auto-delete after countdown
          handleAutoDelete()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [dismissed])

  const handleAutoDelete = async () => {
    try {
      await fetch(`/api/deployments?id=${deploymentId}`, {
        method: "DELETE",
      })
      onDelete(deploymentId)
    } catch (error) {
      console.error("[v0] Auto-delete failed:", error)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const percentage = (timeLeft / 300) * 100

  const getMessage = () => {
    if (reason === "curse_words") {
      return `Subdomain "${subdomain}" contains inappropriate content and will be deleted in ${formatTime(timeLeft)}`
    }
    return `Deployment has no subdomain and will be deleted in ${formatTime(timeLeft)}`
  }

  if (dismissed) return null

  return (
    <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-destructive">{getMessage()}</p>

          {/* Countdown Progress Bar */}
          <div className="mt-3 space-y-1">
            <div className="w-full h-2 bg-destructive/20 rounded-full overflow-hidden">
              <div className="h-full bg-destructive transition-all duration-1000" style={{ width: `${percentage}%` }} />
            </div>
            <p className="text-xs text-destructive/80 text-right font-mono">{formatTime(timeLeft)}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6 flex-shrink-0" onClick={() => setDismissed(true)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
